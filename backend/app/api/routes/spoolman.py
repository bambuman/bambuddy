"""Spoolman integration API routes."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.models.printer import Printer
from backend.app.models.settings import Settings
from backend.app.services.spoolman import (
    SpoolmanClient,
    get_spoolman_client,
    init_spoolman_client,
    close_spoolman_client,
)
from backend.app.services.printer_manager import printer_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/spoolman", tags=["spoolman"])


class SpoolmanStatus(BaseModel):
    """Spoolman connection status."""

    enabled: bool
    connected: bool
    url: str | None


class SyncResult(BaseModel):
    """Result of a Spoolman sync operation."""

    success: bool
    synced_count: int
    errors: list[str]


async def get_spoolman_settings(db: AsyncSession) -> tuple[bool, str, str]:
    """Get Spoolman settings from database.

    Returns:
        Tuple of (enabled, url, sync_mode)
    """
    enabled = False
    url = ""
    sync_mode = "auto"

    result = await db.execute(select(Settings))
    for setting in result.scalars().all():
        if setting.key == "spoolman_enabled":
            enabled = setting.value.lower() == "true"
        elif setting.key == "spoolman_url":
            url = setting.value
        elif setting.key == "spoolman_sync_mode":
            sync_mode = setting.value

    return enabled, url, sync_mode


@router.get("/status", response_model=SpoolmanStatus)
async def get_spoolman_status(db: AsyncSession = Depends(get_db)):
    """Get Spoolman integration status."""
    enabled, url, _ = await get_spoolman_settings(db)

    client = await get_spoolman_client()
    connected = False
    if client:
        connected = await client.health_check()

    return SpoolmanStatus(
        enabled=enabled,
        connected=connected,
        url=url if url else None,
    )


@router.post("/connect")
async def connect_spoolman(db: AsyncSession = Depends(get_db)):
    """Connect to Spoolman server using configured URL."""
    enabled, url, _ = await get_spoolman_settings(db)

    if not enabled:
        raise HTTPException(status_code=400, detail="Spoolman integration is not enabled")

    if not url:
        raise HTTPException(status_code=400, detail="Spoolman URL is not configured")

    try:
        client = await init_spoolman_client(url)
        connected = await client.health_check()

        if not connected:
            raise HTTPException(
                status_code=503,
                detail=f"Could not connect to Spoolman at {url}",
            )

        return {"success": True, "message": f"Connected to Spoolman at {url}"}
    except Exception as e:
        logger.error(f"Failed to connect to Spoolman: {e}")
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/disconnect")
async def disconnect_spoolman():
    """Disconnect from Spoolman server."""
    await close_spoolman_client()
    return {"success": True, "message": "Disconnected from Spoolman"}


@router.post("/sync/{printer_id}", response_model=SyncResult)
async def sync_printer_ams(
    printer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Sync AMS data from a specific printer to Spoolman."""
    # Check if Spoolman is enabled and connected
    enabled, url, _ = await get_spoolman_settings(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Spoolman integration is not enabled")

    client = await get_spoolman_client()
    if not client:
        # Try to connect
        if url:
            client = await init_spoolman_client(url)
        else:
            raise HTTPException(status_code=400, detail="Spoolman URL is not configured")

    if not await client.health_check():
        raise HTTPException(status_code=503, detail="Spoolman is not reachable")

    # Get printer info
    result = await db.execute(select(Printer).where(Printer.id == printer_id))
    printer = result.scalar_one_or_none()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")

    # Get current printer state with AMS data
    state = printer_manager.get_status(printer_id)
    if not state:
        raise HTTPException(status_code=404, detail="Printer not connected")

    if not state.raw_data:
        raise HTTPException(status_code=400, detail="No AMS data available")

    ams_data = state.raw_data.get("ams")
    if not ams_data:
        raise HTTPException(
            status_code=400,
            detail="No AMS data in printer state. Try triggering a slot re-read on the printer.",
        )

    # Sync each AMS tray to Spoolman
    synced = 0
    errors = []

    # Handle different AMS data structures
    # Traditional AMS: list of {"id": N, "tray": [...]} dicts
    # H2D/newer printers: dict with different structure
    ams_units = []
    if isinstance(ams_data, list):
        ams_units = ams_data
    elif isinstance(ams_data, dict):
        # H2D format: check for "ams" key containing list, or "tray" key directly
        if "ams" in ams_data and isinstance(ams_data["ams"], list):
            ams_units = ams_data["ams"]
        elif "tray" in ams_data:
            # Single AMS unit format - wrap in list
            ams_units = [{"id": 0, "tray": ams_data.get("tray", [])}]
        else:
            logger.info(f"AMS dict keys for debugging: {list(ams_data.keys())}")

    if not ams_units:
        raise HTTPException(
            status_code=400,
            detail=f"AMS data format not supported. Keys: {list(ams_data.keys()) if isinstance(ams_data, dict) else type(ams_data).__name__}",
        )

    for ams_unit in ams_units:
        if not isinstance(ams_unit, dict):
            continue

        ams_id = int(ams_unit.get("id", 0))
        trays = ams_unit.get("tray", [])

        for tray_data in trays:
            if not isinstance(tray_data, dict):
                continue

            tray = client.parse_ams_tray(ams_id, tray_data)
            if not tray:
                continue  # Empty tray

            # Skip non-Bambu Lab spools (SpoolEase/third-party) - this is not an error
            if not client.is_bambu_lab_spool(tray.tray_uuid):
                continue

            try:
                sync_result = await client.sync_ams_tray(tray, printer.name)
                if sync_result:
                    synced += 1
                    logger.info(
                        f"Synced {tray.tray_sub_brands} from {printer.name} AMS {ams_id} tray {tray.tray_id}"
                    )
                else:
                    # Bambu Lab spool that wasn't synced (not found in Spoolman)
                    errors.append(f"Spool not found in Spoolman: AMS {ams_id}:{tray.tray_id}")
            except Exception as e:
                error_msg = f"Error syncing AMS {ams_id} tray {tray.tray_id}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)

    return SyncResult(
        success=len(errors) == 0,
        synced_count=synced,
        errors=errors,
    )


@router.post("/sync-all", response_model=SyncResult)
async def sync_all_printers(db: AsyncSession = Depends(get_db)):
    """Sync AMS data from all connected printers to Spoolman."""
    # Check if Spoolman is enabled
    enabled, url, _ = await get_spoolman_settings(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Spoolman integration is not enabled")

    client = await get_spoolman_client()
    if not client:
        if url:
            client = await init_spoolman_client(url)
        else:
            raise HTTPException(status_code=400, detail="Spoolman URL is not configured")

    if not await client.health_check():
        raise HTTPException(status_code=503, detail="Spoolman is not reachable")

    # Get all active printers
    result = await db.execute(select(Printer).where(Printer.is_active == True))
    printers = result.scalars().all()

    total_synced = 0
    all_errors = []

    for printer in printers:
        state = printer_manager.get_status(printer.id)
        if not state or not state.raw_data:
            continue

        ams_data = state.raw_data.get("ams")
        if not ams_data:
            continue

        # Handle different AMS data structures
        # Traditional AMS: list of {"id": N, "tray": [...]} dicts
        # H2D/newer printers: dict with different structure
        ams_units = []
        if isinstance(ams_data, list):
            ams_units = ams_data
        elif isinstance(ams_data, dict):
            # H2D format: check for "ams" key containing list, or "tray" key directly
            if "ams" in ams_data and isinstance(ams_data["ams"], list):
                ams_units = ams_data["ams"]
            elif "tray" in ams_data:
                # Single AMS unit format - wrap in list
                ams_units = [{"id": 0, "tray": ams_data.get("tray", [])}]
            else:
                logger.debug(f"Printer {printer.name} AMS dict keys: {list(ams_data.keys())}")

        if not ams_units:
            logger.debug(f"Printer {printer.name} has no AMS units to sync (type: {type(ams_data).__name__})")
            continue

        for ams_unit in ams_units:
            if not isinstance(ams_unit, dict):
                logger.debug(f"Skipping non-dict AMS unit: {type(ams_unit)}")
                continue

            ams_id = int(ams_unit.get("id", 0))
            trays = ams_unit.get("tray", [])

            for tray_data in trays:
                if not isinstance(tray_data, dict):
                    continue

                tray = client.parse_ams_tray(ams_id, tray_data)
                if not tray:
                    continue

                # Skip non-Bambu Lab spools (SpoolEase/third-party) - this is not an error
                if not client.is_bambu_lab_spool(tray.tray_uuid):
                    continue

                try:
                    sync_result = await client.sync_ams_tray(tray, printer.name)
                    if sync_result:
                        total_synced += 1
                except Exception as e:
                    all_errors.append(f"{printer.name} AMS {ams_id}:{tray.tray_id}: {e}")

    return SyncResult(
        success=len(all_errors) == 0,
        synced_count=total_synced,
        errors=all_errors,
    )


@router.get("/spools")
async def get_spools(db: AsyncSession = Depends(get_db)):
    """Get all spools from Spoolman."""
    enabled, url, _ = await get_spoolman_settings(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Spoolman integration is not enabled")

    client = await get_spoolman_client()
    if not client:
        if url:
            client = await init_spoolman_client(url)
        else:
            raise HTTPException(status_code=400, detail="Spoolman URL is not configured")

    if not await client.health_check():
        raise HTTPException(status_code=503, detail="Spoolman is not reachable")

    spools = await client.get_spools()
    return {"spools": spools}


@router.get("/filaments")
async def get_filaments(db: AsyncSession = Depends(get_db)):
    """Get all filaments from Spoolman."""
    enabled, url, _ = await get_spoolman_settings(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="Spoolman integration is not enabled")

    client = await get_spoolman_client()
    if not client:
        if url:
            client = await init_spoolman_client(url)
        else:
            raise HTTPException(status_code=400, detail="Spoolman URL is not configured")

    if not await client.health_check():
        raise HTTPException(status_code=503, detail="Spoolman is not reachable")

    filaments = await client.get_filaments()
    return {"filaments": filaments}
