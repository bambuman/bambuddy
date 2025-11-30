from pydantic import BaseModel, Field


class AppSettings(BaseModel):
    """Application settings schema."""

    auto_archive: bool = Field(default=True, description="Automatically archive prints when completed")
    save_thumbnails: bool = Field(default=True, description="Extract and save preview images from 3MF files")
    capture_finish_photo: bool = Field(default=True, description="Capture photo from printer camera when print completes")
    default_filament_cost: float = Field(default=25.0, description="Default filament cost per kg")
    currency: str = Field(default="USD", description="Currency for cost tracking")
    energy_cost_per_kwh: float = Field(default=0.15, description="Electricity cost per kWh for energy tracking")
    energy_tracking_mode: str = Field(default="total", description="Energy display mode on stats: 'print' shows sum of per-print energy, 'total' shows lifetime plug consumption")

    # Spoolman integration
    spoolman_enabled: bool = Field(default=False, description="Enable Spoolman integration for filament tracking")
    spoolman_url: str = Field(default="", description="Spoolman server URL (e.g., http://localhost:7912)")
    spoolman_sync_mode: str = Field(default="auto", description="Sync mode: 'auto' syncs immediately, 'manual' requires button press")


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
