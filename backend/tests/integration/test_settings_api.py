"""Integration tests for Settings API endpoints.

Tests the full request/response cycle for /api/v1/settings/ endpoints.
"""

import pytest
from httpx import AsyncClient


class TestSettingsAPI:
    """Integration tests for /api/v1/settings/ endpoints."""

    # ========================================================================
    # Get settings
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_settings(self, async_client: AsyncClient):
        """Verify settings can be retrieved."""
        response = await async_client.get("/api/v1/settings/")

        assert response.status_code == 200
        result = response.json()
        # Check for actual settings fields
        assert "auto_archive" in result
        assert "currency" in result
        assert "date_format" in result

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_settings_has_defaults(self, async_client: AsyncClient):
        """Verify default settings values are returned."""
        response = await async_client.get("/api/v1/settings/")

        assert response.status_code == 200
        result = response.json()
        # Verify some default values
        assert isinstance(result["auto_archive"], bool)
        assert isinstance(result["currency"], str)

    # ========================================================================
    # Update settings
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_auto_archive(self, async_client: AsyncClient):
        """Verify auto_archive can be updated."""
        # First get current value
        response = await async_client.get("/api/v1/settings/")
        original = response.json()["auto_archive"]

        # Update to opposite value
        new_value = not original
        response = await async_client.put("/api/v1/settings/", json={"auto_archive": new_value})

        assert response.status_code == 200
        assert response.json()["auto_archive"] == new_value

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_currency(self, async_client: AsyncClient):
        """Verify currency can be updated."""
        response = await async_client.put("/api/v1/settings/", json={"currency": "EUR"})

        assert response.status_code == 200
        assert response.json()["currency"] == "EUR"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_date_format(self, async_client: AsyncClient):
        """Verify date format can be updated."""
        response = await async_client.put("/api/v1/settings/", json={"date_format": "eu"})

        assert response.status_code == 200
        assert response.json()["date_format"] == "eu"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_time_format(self, async_client: AsyncClient):
        """Verify time format can be updated."""
        response = await async_client.put("/api/v1/settings/", json={"time_format": "24h"})

        assert response.status_code == 200
        assert response.json()["time_format"] == "24h"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_filament_cost(self, async_client: AsyncClient):
        """Verify default filament cost can be updated."""
        response = await async_client.put("/api/v1/settings/", json={"default_filament_cost": 30.0})

        assert response.status_code == 200
        assert response.json()["default_filament_cost"] == 30.0

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_energy_cost(self, async_client: AsyncClient):
        """Verify energy cost can be updated."""
        response = await async_client.put("/api/v1/settings/", json={"energy_cost_per_kwh": 0.20})

        assert response.status_code == 200
        assert response.json()["energy_cost_per_kwh"] == 0.20

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_multiple_settings(self, async_client: AsyncClient):
        """Verify multiple settings can be updated at once."""
        response = await async_client.put(
            "/api/v1/settings/",
            json={
                "currency": "GBP",
                "date_format": "iso",
                "time_format": "12h",
                "save_thumbnails": False,
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["currency"] == "GBP"
        assert result["date_format"] == "iso"
        assert result["time_format"] == "12h"
        assert result["save_thumbnails"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_spoolman_settings(self, async_client: AsyncClient):
        """Verify Spoolman settings can be updated."""
        response = await async_client.put(
            "/api/v1/settings/",
            json={
                "spoolman_enabled": True,
                "spoolman_url": "http://localhost:7912",
                "spoolman_sync_mode": "manual",
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["spoolman_enabled"] is True
        assert result["spoolman_url"] == "http://localhost:7912"
        assert result["spoolman_sync_mode"] == "manual"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_ams_thresholds(self, async_client: AsyncClient):
        """Verify AMS threshold settings can be updated."""
        response = await async_client.put(
            "/api/v1/settings/",
            json={
                "ams_humidity_good": 35,
                "ams_humidity_fair": 55,
                "ams_temp_good": 25.0,
                "ams_temp_fair": 32.0,
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["ams_humidity_good"] == 35
        assert result["ams_humidity_fair"] == 55
        assert result["ams_temp_good"] == 25.0
        assert result["ams_temp_fair"] == 32.0

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_notification_language(self, async_client: AsyncClient):
        """Verify notification language can be updated."""
        response = await async_client.put("/api/v1/settings/", json={"notification_language": "de"})

        assert response.status_code == 200
        assert response.json()["notification_language"] == "de"

    # ========================================================================
    # Settings persistence tests
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_theme_settings(self, async_client: AsyncClient):
        """Verify theme settings can be updated."""
        response = await async_client.put(
            "/api/v1/settings/",
            json={
                "dark_style": "glow",
                "dark_background": "forest",
                "dark_accent": "teal",
                "light_style": "vibrant",
                "light_background": "warm",
                "light_accent": "blue",
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["dark_style"] == "glow"
        assert result["dark_background"] == "forest"
        assert result["dark_accent"] == "teal"
        assert result["light_style"] == "vibrant"
        assert result["light_background"] == "warm"
        assert result["light_accent"] == "blue"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_settings_persist_after_update(self, async_client: AsyncClient):
        """CRITICAL: Verify settings changes persist across requests."""
        # Update settings
        await async_client.put("/api/v1/settings/", json={"currency": "JPY", "check_updates": False})

        # Verify persistence in new request
        response = await async_client.get("/api/v1/settings/")
        result = response.json()
        assert result["currency"] == "JPY"
        assert result["check_updates"] is False
