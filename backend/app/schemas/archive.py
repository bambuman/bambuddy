from datetime import datetime
from pydantic import BaseModel


class ArchiveBase(BaseModel):
    print_name: str | None = None
    is_favorite: bool | None = None
    tags: str | None = None
    notes: str | None = None
    cost: float | None = None
    failure_reason: str | None = None


class ArchiveUpdate(ArchiveBase):
    printer_id: int | None = None


class ArchiveDuplicate(BaseModel):
    """Reference to a duplicate archive."""
    id: int
    print_name: str | None
    created_at: datetime
    match_type: str  # "exact" (hash match) or "similar" (name match)


class ArchiveResponse(BaseModel):
    id: int
    printer_id: int | None
    filename: str
    file_path: str
    file_size: int
    content_hash: str | None
    thumbnail_path: str | None
    timelapse_path: str | None

    # Duplicate detection
    duplicates: list[ArchiveDuplicate] | None = None
    duplicate_count: int = 0  # Quick count for list views

    print_name: str | None
    print_time_seconds: int | None  # Estimated time from slicer
    actual_time_seconds: int | None = None  # Computed from started_at/completed_at
    time_accuracy: float | None = None  # Percentage: 100 = perfect, >100 = faster than estimated
    filament_used_grams: float | None
    filament_type: str | None
    filament_color: str | None
    layer_height: float | None
    nozzle_diameter: float | None
    bed_temperature: int | None
    nozzle_temperature: int | None

    status: str
    started_at: datetime | None
    completed_at: datetime | None

    extra_data: dict | None

    makerworld_url: str | None
    designer: str | None

    is_favorite: bool
    tags: str | None
    notes: str | None
    cost: float | None
    photos: list | None
    failure_reason: str | None

    created_at: datetime

    class Config:
        from_attributes = True


class ArchiveStats(BaseModel):
    total_prints: int
    successful_prints: int
    failed_prints: int
    total_print_time_hours: float
    total_filament_grams: float
    total_cost: float
    prints_by_filament_type: dict
    prints_by_printer: dict
    # Time accuracy stats
    average_time_accuracy: float | None = None  # Average across all prints with data
    time_accuracy_by_printer: dict | None = None  # Per-printer accuracy


class ProjectPageImage(BaseModel):
    """Image embedded in 3MF project page."""
    name: str
    path: str  # Path within 3MF
    url: str  # API URL to fetch image


class ProjectPageResponse(BaseModel):
    """Project page data extracted from 3MF file."""
    # Model info
    title: str | None = None
    description: str | None = None  # HTML content
    designer: str | None = None
    designer_user_id: str | None = None
    license: str | None = None
    copyright: str | None = None
    creation_date: str | None = None
    modification_date: str | None = None
    origin: str | None = None  # "original" or "remix"

    # Profile info
    profile_title: str | None = None
    profile_description: str | None = None
    profile_cover: str | None = None
    profile_user_id: str | None = None
    profile_user_name: str | None = None

    # MakerWorld info
    design_model_id: str | None = None
    design_profile_id: str | None = None
    design_region: str | None = None

    # Images
    model_pictures: list[ProjectPageImage] = []
    profile_pictures: list[ProjectPageImage] = []
    thumbnails: list[ProjectPageImage] = []


class ProjectPageUpdate(BaseModel):
    """Update project page data in 3MF file."""
    title: str | None = None
    description: str | None = None
    designer: str | None = None
    license: str | None = None
    copyright: str | None = None
    profile_title: str | None = None
    profile_description: str | None = None
