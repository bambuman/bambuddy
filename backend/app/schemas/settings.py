from pydantic import BaseModel, Field


class AppSettings(BaseModel):
    """Application settings schema."""

    auto_archive: bool = Field(default=True, description="Automatically archive prints when completed")
    save_thumbnails: bool = Field(default=True, description="Extract and save preview images from 3MF files")
    capture_finish_photo: bool = Field(
        default=True, description="Capture photo from printer camera when print completes"
    )
    default_filament_cost: float = Field(default=25.0, description="Default filament cost per kg")
    currency: str = Field(default="USD", description="Currency for cost tracking")
    energy_cost_per_kwh: float = Field(default=0.15, description="Electricity cost per kWh for energy tracking")
    energy_tracking_mode: str = Field(
        default="total",
        description="Energy display mode on stats: 'print' shows sum of per-print energy, 'total' shows lifetime plug consumption",
    )

    # Spoolman integration
    spoolman_enabled: bool = Field(default=False, description="Enable Spoolman integration for filament tracking")
    spoolman_url: str = Field(default="", description="Spoolman server URL (e.g., http://localhost:7912)")
    spoolman_sync_mode: str = Field(
        default="auto", description="Sync mode: 'auto' syncs immediately, 'manual' requires button press"
    )

    # Updates
    check_updates: bool = Field(default=True, description="Automatically check for updates on startup")

    # Language
    notification_language: str = Field(default="en", description="Language for push notifications (en, de)")

    # AMS threshold settings for humidity and temperature coloring
    ams_humidity_good: int = Field(default=40, description="Humidity threshold for good (green): <= this value")
    ams_humidity_fair: int = Field(
        default=60, description="Humidity threshold for fair (orange): <= this value, > is red"
    )
    ams_temp_good: float = Field(default=28.0, description="Temperature threshold for good (blue): <= this value")
    ams_temp_fair: float = Field(
        default=35.0, description="Temperature threshold for fair (orange): <= this value, > is red"
    )
    ams_history_retention_days: int = Field(default=30, description="Number of days to keep AMS sensor history data")

    # Date/time display format
    date_format: str = Field(default="system", description="Date format: system, us, eu, iso")
    time_format: str = Field(default="system", description="Time format: system, 12h, 24h")

    # Default printer for operations
    default_printer_id: int | None = Field(default=None, description="Default printer ID for uploads, reprints, etc.")

    # Telemetry
    telemetry_enabled: bool = Field(default=True, description="Send anonymous usage data to help improve BamBuddy")

    # Virtual Printer
    virtual_printer_enabled: bool = Field(default=False, description="Enable virtual printer for slicer uploads")
    virtual_printer_access_code: str = Field(default="", description="Access code for virtual printer authentication")
    virtual_printer_mode: str = Field(default="immediate", description="Archive mode: 'immediate' or 'queue'")

    # Dark mode theme settings
    dark_style: str = Field(default="classic", description="Dark mode style: classic, glow, vibrant")
    dark_background: str = Field(
        default="neutral", description="Dark mode background: neutral, warm, cool, oled, slate, forest"
    )
    dark_accent: str = Field(default="green", description="Dark mode accent: green, teal, blue, orange, purple, red")

    # Light mode theme settings
    light_style: str = Field(default="classic", description="Light mode style: classic, glow, vibrant")
    light_background: str = Field(default="neutral", description="Light mode background: neutral, warm, cool")
    light_accent: str = Field(default="green", description="Light mode accent: green, teal, blue, orange, purple, red")


class AppSettingsUpdate(BaseModel):
    """Schema for updating settings (all fields optional)."""

    auto_archive: bool | None = None
    save_thumbnails: bool | None = None
    capture_finish_photo: bool | None = None
    default_filament_cost: float | None = None
    currency: str | None = None
    energy_cost_per_kwh: float | None = None
    energy_tracking_mode: str | None = None
    spoolman_enabled: bool | None = None
    spoolman_url: str | None = None
    spoolman_sync_mode: str | None = None
    check_updates: bool | None = None
    notification_language: str | None = None
    ams_humidity_good: int | None = None
    ams_humidity_fair: int | None = None
    ams_temp_good: float | None = None
    ams_temp_fair: float | None = None
    ams_history_retention_days: int | None = None
    date_format: str | None = None
    time_format: str | None = None
    default_printer_id: int | None = None
    telemetry_enabled: bool | None = None
    virtual_printer_enabled: bool | None = None
    virtual_printer_access_code: str | None = None
    virtual_printer_mode: str | None = None
    dark_style: str | None = None
    dark_background: str | None = None
    dark_accent: str | None = None
    light_style: str | None = None
    light_background: str | None = None
    light_accent: str | None = None
