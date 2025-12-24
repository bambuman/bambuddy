"""Camera streaming API endpoints for Bambu Lab printers."""

import asyncio
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.printer import Printer
from backend.app.services.camera import (
    capture_camera_frame,
    get_camera_port,
    get_ffmpeg_path,
    is_low_fps_model,
    test_camera_connection,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/printers", tags=["camera"])

# Track active ffmpeg processes for cleanup
_active_streams: dict[str, asyncio.subprocess.Process] = {}

# Store last frame for each printer (for photo capture from active stream)
_last_frames: dict[int, bytes] = {}


def get_buffered_frame(printer_id: int) -> bytes | None:
    """Get the last buffered frame for a printer from an active stream.

    Returns the JPEG frame data if available, or None if no active stream.
    """
    return _last_frames.get(printer_id)


async def get_printer_or_404(printer_id: int, db: AsyncSession) -> Printer:
    """Get printer by ID or raise 404."""
    result = await db.execute(select(Printer).where(Printer.id == printer_id))
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    return printer


async def generate_mjpeg_stream(
    ip_address: str,
    access_code: str,
    model: str | None,
    fps: int = 10,
    stream_id: str | None = None,
    disconnect_event: asyncio.Event | None = None,
    printer_id: int | None = None,
) -> AsyncGenerator[bytes, None]:
    """Generate MJPEG stream from printer camera using ffmpeg.

    This captures frames continuously and yields them in MJPEG format.
    """
    ffmpeg = get_ffmpeg_path()
    if not ffmpeg:
        logger.error("ffmpeg not found - camera streaming requires ffmpeg")
        yield (b"--frame\r\n" b"Content-Type: text/plain\r\n\r\n" b"Error: ffmpeg not installed\r\n")
        return

    port = get_camera_port(model)
    camera_url = f"rtsps://bblp:{access_code}@{ip_address}:{port}/streaming/live/1"
    low_fps = is_low_fps_model(model)

    # For A1/P1 models, use lower FPS and longer timeouts
    # These models have more limited camera streaming capability
    effective_fps = min(fps, 5) if low_fps else fps

    # ffmpeg command to output MJPEG stream to stdout
    # -rtsp_transport tcp: Use TCP for reliability
    # -rtsp_flags prefer_tcp: Prefer TCP for RTSP
    # -f mjpeg: Output as MJPEG
    # -q:v 5: Quality (lower = better, 2-10 is good range)
    # -r: Output framerate
    cmd = [
        ffmpeg,
        "-rtsp_transport",
        "tcp",
        "-rtsp_flags",
        "prefer_tcp",
    ]

    # Add longer timeouts for A1/P1 models which may be slower to respond
    if low_fps:
        cmd.extend(
            [
                "-timeout",
                "10000000",  # 10 seconds in microseconds
                "-stimeout",
                "10000000",  # Socket timeout
                "-analyzeduration",
                "10000000",  # Longer analysis time
                "-probesize",
                "5000000",  # Larger probe size
            ]
        )

    cmd.extend(
        [
            "-i",
            camera_url,
            "-f",
            "mjpeg",
            "-q:v",
            "5",
            "-r",
            str(effective_fps),
            "-an",  # No audio
            "-",  # Output to stdout
        ]
    )

    logger.info(f"Starting camera stream for {ip_address} (stream_id={stream_id}, model={model}, fps={effective_fps})")
    if low_fps:
        logger.info(f"Using extended timeouts for {model} camera")
    logger.debug(f"ffmpeg command: {ffmpeg} ... (url hidden)")

    process = None
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Track active process for cleanup
        if stream_id:
            _active_streams[stream_id] = process

        # Give ffmpeg a moment to start and check for immediate failures
        # A1/P1 models may need longer to establish connection
        startup_wait = 2.0 if low_fps else 0.5
        await asyncio.sleep(startup_wait)
        if process.returncode is not None:
            stderr = await process.stderr.read()
            logger.error(f"ffmpeg failed immediately: {stderr.decode()}")
            yield (
                b"--frame\r\n"
                b"Content-Type: text/plain\r\n\r\n"
                b"Error: Camera connection failed. Check printer is on and camera is enabled.\r\n"
            )
            return

        # Read JPEG frames from ffmpeg output
        # JPEG images start with 0xFFD8 and end with 0xFFD9
        buffer = b""
        jpeg_start = b"\xff\xd8"
        jpeg_end = b"\xff\xd9"

        while True:
            # Check if client disconnected
            if disconnect_event and disconnect_event.is_set():
                logger.info(f"Client disconnected, stopping stream {stream_id}")
                break

            try:
                # Read chunk from ffmpeg
                # A1/P1 models may have longer gaps between frames
                read_timeout = 30.0 if low_fps else 10.0
                chunk = await asyncio.wait_for(process.stdout.read(8192), timeout=read_timeout)

                if not chunk:
                    logger.warning("Camera stream ended (no more data)")
                    break

                buffer += chunk

                # Find complete JPEG frames in buffer
                while True:
                    start_idx = buffer.find(jpeg_start)
                    if start_idx == -1:
                        # No start marker, clear buffer up to last 2 bytes
                        buffer = buffer[-2:] if len(buffer) > 2 else buffer
                        break

                    # Trim anything before the start marker
                    if start_idx > 0:
                        buffer = buffer[start_idx:]

                    end_idx = buffer.find(jpeg_end, 2)  # Skip first 2 bytes
                    if end_idx == -1:
                        # No end marker yet, wait for more data
                        break

                    # Extract complete frame
                    frame = buffer[: end_idx + 2]
                    buffer = buffer[end_idx + 2 :]

                    # Save frame to buffer for photo capture
                    if printer_id is not None:
                        _last_frames[printer_id] = frame

                    # Yield frame in MJPEG format
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: " + str(len(frame)).encode() + b"\r\n"
                        b"\r\n" + frame + b"\r\n"
                    )

            except TimeoutError:
                logger.warning("Camera stream read timeout")
                break
            except asyncio.CancelledError:
                logger.info(f"Camera stream cancelled (stream_id={stream_id})")
                break
            except GeneratorExit:
                logger.info(f"Camera stream generator exit (stream_id={stream_id})")
                break

    except FileNotFoundError:
        logger.error("ffmpeg not found - camera streaming requires ffmpeg")
        yield (b"--frame\r\n" b"Content-Type: text/plain\r\n\r\n" b"Error: ffmpeg not installed\r\n")
    except asyncio.CancelledError:
        logger.info(f"Camera stream task cancelled (stream_id={stream_id})")
    except GeneratorExit:
        logger.info(f"Camera stream generator closed (stream_id={stream_id})")
    except Exception as e:
        logger.exception(f"Camera stream error: {e}")
    finally:
        # Remove from active streams
        if stream_id and stream_id in _active_streams:
            del _active_streams[stream_id]

        # Clean up frame buffer
        if printer_id is not None and printer_id in _last_frames:
            del _last_frames[printer_id]

        if process and process.returncode is None:
            logger.info(f"Terminating ffmpeg process for stream {stream_id}")
            try:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=2.0)
                except TimeoutError:
                    logger.warning(f"ffmpeg didn't terminate gracefully, killing (stream_id={stream_id})")
                    process.kill()
                    await process.wait()
            except ProcessLookupError:
                pass  # Process already dead
            except Exception as e:
                logger.warning(f"Error terminating ffmpeg: {e}")
            logger.info(f"Camera stream stopped for {ip_address} (stream_id={stream_id})")


@router.get("/{printer_id}/camera/stream")
async def camera_stream(
    printer_id: int,
    request: Request,
    fps: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Stream live video from printer camera as MJPEG.

    This endpoint returns a multipart MJPEG stream that can be used directly
    in an <img> tag or video player.

    Args:
        printer_id: Printer ID
        fps: Target frames per second (default: 10, max: 30)
    """
    import uuid

    printer = await get_printer_or_404(printer_id, db)

    # Validate FPS
    fps = min(max(fps, 1), 30)

    # Generate unique stream ID for tracking
    stream_id = f"{printer_id}-{uuid.uuid4().hex[:8]}"

    # Create disconnect event that will be set when client disconnects
    disconnect_event = asyncio.Event()

    async def stream_with_disconnect_check():
        """Wrapper generator that monitors for client disconnect."""
        try:
            async for chunk in generate_mjpeg_stream(
                ip_address=printer.ip_address,
                access_code=printer.access_code,
                model=printer.model,
                fps=fps,
                stream_id=stream_id,
                disconnect_event=disconnect_event,
                printer_id=printer_id,
            ):
                # Check if client is still connected
                if await request.is_disconnected():
                    logger.info(f"Client disconnected detected for stream {stream_id}")
                    disconnect_event.set()
                    break
                yield chunk
        except asyncio.CancelledError:
            logger.info(f"Stream {stream_id} cancelled")
            disconnect_event.set()
        except GeneratorExit:
            logger.info(f"Stream {stream_id} generator closed")
            disconnect_event.set()
        finally:
            disconnect_event.set()
            # Give a moment for the inner generator to clean up
            await asyncio.sleep(0.1)

    return StreamingResponse(
        stream_with_disconnect_check(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.api_route("/{printer_id}/camera/stop", methods=["GET", "POST"])
async def stop_camera_stream(printer_id: int):
    """Stop all active camera streams for a printer.

    This can be called by the frontend when the camera window is closed.
    Accepts both GET and POST (POST for sendBeacon compatibility).
    """
    stopped = 0
    to_remove = []
    for stream_id, process in list(_active_streams.items()):
        if stream_id.startswith(f"{printer_id}-"):
            to_remove.append(stream_id)
            if process.returncode is None:
                try:
                    process.terminate()
                    stopped += 1
                    logger.info(f"Terminated ffmpeg process for stream {stream_id}")
                except Exception as e:
                    logger.warning(f"Error stopping stream {stream_id}: {e}")

    for stream_id in to_remove:
        _active_streams.pop(stream_id, None)

    logger.info(
        f"Stopped {stopped} camera stream(s) for printer {printer_id}, active streams remaining: {list(_active_streams.keys())}"
    )
    return {"stopped": stopped}


@router.get("/{printer_id}/camera/snapshot")
async def camera_snapshot(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Capture a single frame from the printer camera.

    Returns a JPEG image.
    """
    import tempfile
    from pathlib import Path

    printer = await get_printer_or_404(printer_id, db)

    # Create temporary file for the snapshot
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        temp_path = Path(f.name)

    try:
        success = await capture_camera_frame(
            ip_address=printer.ip_address,
            access_code=printer.access_code,
            model=printer.model,
            output_path=temp_path,
            timeout=15,
        )

        if not success:
            raise HTTPException(status_code=503, detail="Failed to capture camera frame. Is the printer powered on?")

        # Read and return the image
        with open(temp_path, "rb") as f:
            image_data = f.read()

        return Response(
            content=image_data,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Content-Disposition": f'inline; filename="snapshot_{printer_id}.jpg"',
            },
        )
    finally:
        # Clean up temp file
        if temp_path.exists():
            temp_path.unlink()


@router.get("/{printer_id}/camera/test")
async def test_camera(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Test camera connection for a printer.

    Returns success status and any error message.
    """
    printer = await get_printer_or_404(printer_id, db)

    result = await test_camera_connection(
        ip_address=printer.ip_address,
        access_code=printer.access_code,
        model=printer.model,
    )

    return result
