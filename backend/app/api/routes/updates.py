"""Update checking and management routes."""

import asyncio
import logging
import subprocess
import sys
from pathlib import Path

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import APP_VERSION, GITHUB_REPO, settings
from backend.app.core.database import get_db
from backend.app.api.routes.settings import get_setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/updates", tags=["updates"])

# Global state for update progress
_update_status = {
    "status": "idle",  # idle, checking, downloading, installing, complete, error
    "progress": 0,
    "message": "",
    "error": None,
}


def parse_version(version: str) -> tuple[int, ...]:
    """Parse version string into tuple for comparison."""
    # Remove 'v' prefix if present
    version = version.lstrip("v")
    # Split and convert to integers
    parts = []
    for part in version.split("."):
        try:
            parts.append(int(part))
        except ValueError:
            # Handle pre-release versions like "1.0.0-beta"
            num = "".join(c for c in part if c.isdigit())
            parts.append(int(num) if num else 0)
    return tuple(parts)


def is_newer_version(latest: str, current: str) -> bool:
    """Check if latest version is newer than current."""
    try:
        return parse_version(latest) > parse_version(current)
    except Exception:
        return False


@router.get("/version")
async def get_version():
    """Get current application version."""
    return {
        "version": APP_VERSION,
        "repo": GITHUB_REPO,
    }


@router.get("/check")
async def check_for_updates(db: AsyncSession = Depends(get_db)):
    """Check GitHub for available updates."""
    global _update_status

    _update_status = {
        "status": "checking",
        "progress": 0,
        "message": "Checking for updates...",
        "error": None,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10.0,
            )

            if response.status_code == 404:
                # No releases yet
                _update_status = {
                    "status": "idle",
                    "progress": 100,
                    "message": "No releases found",
                    "error": None,
                }
                return {
                    "update_available": False,
                    "current_version": APP_VERSION,
                    "latest_version": None,
                    "message": "No releases found",
                }

            response.raise_for_status()
            release_data = response.json()

            latest_version = release_data.get("tag_name", "").lstrip("v")
            release_name = release_data.get("name", latest_version)
            release_notes = release_data.get("body", "")
            release_url = release_data.get("html_url", "")
            published_at = release_data.get("published_at", "")

            update_available = is_newer_version(latest_version, APP_VERSION)

            _update_status = {
                "status": "idle",
                "progress": 100,
                "message": "Update available" if update_available else "Up to date",
                "error": None,
            }

            return {
                "update_available": update_available,
                "current_version": APP_VERSION,
                "latest_version": latest_version,
                "release_name": release_name,
                "release_notes": release_notes,
                "release_url": release_url,
                "published_at": published_at,
            }

    except httpx.HTTPError as e:
        logger.error(f"Failed to check for updates: {e}")
        _update_status = {
            "status": "error",
            "progress": 0,
            "message": "Failed to check for updates",
            "error": str(e),
        }
        return {
            "update_available": False,
            "current_version": APP_VERSION,
            "latest_version": None,
            "error": str(e),
        }


async def _perform_update():
    """Perform the actual update using git pull."""
    global _update_status

    try:
        _update_status = {
            "status": "downloading",
            "progress": 20,
            "message": "Pulling latest changes...",
            "error": None,
        }

        # Run git pull in the project directory
        base_dir = settings.base_dir
        process = await asyncio.create_subprocess_exec(
            "git", "pull", "--rebase",
            cwd=str(base_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Git pull failed"
            logger.error(f"Git pull failed: {error_msg}")
            _update_status = {
                "status": "error",
                "progress": 0,
                "message": "Failed to pull updates",
                "error": error_msg,
            }
            return

        _update_status = {
            "status": "installing",
            "progress": 50,
            "message": "Installing dependencies...",
            "error": None,
        }

        # Install Python dependencies
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "-q",
            cwd=str(base_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            logger.warning(f"pip install warning: {stderr.decode() if stderr else 'unknown'}")

        _update_status = {
            "status": "installing",
            "progress": 70,
            "message": "Building frontend...",
            "error": None,
        }

        # Build frontend
        frontend_dir = base_dir / "frontend"
        if frontend_dir.exists():
            # npm install
            process = await asyncio.create_subprocess_exec(
                "npm", "install",
                cwd=str(frontend_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await process.communicate()

            # npm run build
            process = await asyncio.create_subprocess_exec(
                "npm", "run", "build",
                cwd=str(frontend_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                logger.warning(f"Frontend build warning: {stderr.decode() if stderr else 'unknown'}")

        _update_status = {
            "status": "complete",
            "progress": 100,
            "message": "Update complete! Please restart the application.",
            "error": None,
        }

        logger.info("Update completed successfully")

    except Exception as e:
        logger.error(f"Update failed: {e}")
        _update_status = {
            "status": "error",
            "progress": 0,
            "message": "Update failed",
            "error": str(e),
        }


@router.post("/apply")
async def apply_update(background_tasks: BackgroundTasks):
    """Apply available update (git pull + rebuild)."""
    global _update_status

    if _update_status["status"] in ["downloading", "installing"]:
        return {
            "success": False,
            "message": "Update already in progress",
            "status": _update_status,
        }

    # Start update in background
    background_tasks.add_task(_perform_update)

    _update_status = {
        "status": "downloading",
        "progress": 10,
        "message": "Starting update...",
        "error": None,
    }

    return {
        "success": True,
        "message": "Update started",
        "status": _update_status,
    }


@router.get("/status")
async def get_update_status():
    """Get current update status."""
    return _update_status
