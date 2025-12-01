from pathlib import Path
from pydantic_settings import BaseSettings

# Application version - single source of truth
APP_VERSION = "0.1.4"
GITHUB_REPO = "maziggy/bambusy"


class Settings(BaseSettings):
    app_name: str = "BambuTrack"
    debug: bool = False  # Default to production mode

    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent.parent.parent
    archive_dir: Path = base_dir / "archive"
    static_dir: Path = base_dir / "static"
    log_dir: Path = base_dir / "logs"
    database_url: str = f"sqlite+aiosqlite:///{base_dir}/bambutrack.db"

    # Logging
    log_level: str = "INFO"  # Override with LOG_LEVEL env var or DEBUG=true
    log_to_file: bool = True  # Set to false to disable file logging

    # API
    api_prefix: str = "/api/v1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure directories exist
settings.archive_dir.mkdir(exist_ok=True)
settings.static_dir.mkdir(exist_ok=True)
if settings.log_to_file:
    settings.log_dir.mkdir(exist_ok=True)
