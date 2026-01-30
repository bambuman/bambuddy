"""Integration tests for Smart Plugs API endpoints.

Tests the full request/response cycle for /api/v1/smart-plugs/ endpoints.
"""

import pytest
from httpx import AsyncClient


class TestSmartPlugsAPI:
    """Integration tests for /api/v1/smart-plugs/ endpoints."""

    # ========================================================================
    # List endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_list_smart_plugs_empty(self, async_client: AsyncClient):
        """Verify empty list is returned when no plugs exist."""
        response = await async_client.get("/api/v1/smart-plugs/")

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_list_smart_plugs_with_data(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify list returns existing plugs."""
        await smart_plug_factory(name="Test Plug 1")

        response = await async_client.get("/api/v1/smart-plugs/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(p["name"] == "Test Plug 1" for p in data)

    # ========================================================================
    # Create endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_smart_plug(self, async_client: AsyncClient):
        """Verify smart plug can be created."""
        data = {
            "name": "New Plug",
            "ip_address": "192.168.1.100",
            "enabled": True,
            "auto_on": True,
            "auto_off": False,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "New Plug"
        assert result["ip_address"] == "192.168.1.100"
        assert result["auto_off"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_smart_plug_with_printer(self, async_client: AsyncClient, printer_factory, db_session):
        """Verify smart plug can be linked to a printer."""
        printer = await printer_factory(name="Test Printer")

        data = {
            "name": "Printer Plug",
            "ip_address": "192.168.1.101",
            "printer_id": printer.id,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 200
        result = response.json()
        assert result["printer_id"] == printer.id

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_plug_with_invalid_printer_id(self, async_client: AsyncClient):
        """Verify creating plug with non-existent printer fails."""
        data = {
            "name": "Test Plug",
            "ip_address": "192.168.1.100",
            "printer_id": 9999,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 400
        assert "Printer not found" in response.json()["detail"]

    # ========================================================================
    # Get single endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_smart_plug(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify single plug can be retrieved."""
        plug = await smart_plug_factory(name="Get Test Plug")

        response = await async_client.get(f"/api/v1/smart-plugs/{plug.id}")

        assert response.status_code == 200
        result = response.json()
        assert result["id"] == plug.id
        assert result["name"] == "Get Test Plug"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_smart_plug_not_found(self, async_client: AsyncClient):
        """Verify 404 for non-existent plug."""
        response = await async_client.get("/api/v1/smart-plugs/9999")

        assert response.status_code == 404

    # ========================================================================
    # Update endpoints (CRITICAL - toggle persistence)
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_auto_off_toggle(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """CRITICAL: Verify auto_off toggle persists correctly.

        This tests the regression scenario where toggling auto_off
        wasn't being saved properly.
        """
        # Create plug with auto_off=True
        plug = await smart_plug_factory(auto_off=True)

        # Verify initial state
        response = await async_client.get(f"/api/v1/smart-plugs/{plug.id}")
        assert response.status_code == 200
        assert response.json()["auto_off"] is True

        # Toggle auto_off to False
        response = await async_client.patch(f"/api/v1/smart-plugs/{plug.id}", json={"auto_off": False})

        assert response.status_code == 200
        assert response.json()["auto_off"] is False

        # Verify change persisted by fetching again
        response = await async_client.get(f"/api/v1/smart-plugs/{plug.id}")
        assert response.json()["auto_off"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_auto_on_toggle(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify auto_on toggle persists correctly."""
        plug = await smart_plug_factory(auto_on=True)

        response = await async_client.patch(f"/api/v1/smart-plugs/{plug.id}", json={"auto_on": False})

        assert response.status_code == 200
        assert response.json()["auto_on"] is False

        # Verify persistence
        response = await async_client.get(f"/api/v1/smart-plugs/{plug.id}")
        assert response.json()["auto_on"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_enabled_toggle(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify enabled toggle persists correctly."""
        plug = await smart_plug_factory(enabled=True)

        response = await async_client.patch(f"/api/v1/smart-plugs/{plug.id}", json={"enabled": False})

        assert response.status_code == 200
        assert response.json()["enabled"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_off_delay_mode(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify off_delay_mode can be changed."""
        plug = await smart_plug_factory(off_delay_mode="time")

        response = await async_client.patch(
            f"/api/v1/smart-plugs/{plug.id}", json={"off_delay_mode": "temperature", "off_temp_threshold": 50}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["off_delay_mode"] == "temperature"
        assert result["off_temp_threshold"] == 50

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_schedule_settings(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify schedule settings can be updated."""
        plug = await smart_plug_factory(schedule_enabled=False)

        response = await async_client.patch(
            f"/api/v1/smart-plugs/{plug.id}",
            json={
                "schedule_enabled": True,
                "schedule_on_time": "08:00",
                "schedule_off_time": "22:00",
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["schedule_enabled"] is True
        assert result["schedule_on_time"] == "08:00"
        assert result["schedule_off_time"] == "22:00"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_multiple_fields(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify multiple fields can be updated at once."""
        plug = await smart_plug_factory(
            name="Old Name",
            auto_on=True,
            auto_off=True,
        )

        response = await async_client.patch(
            f"/api/v1/smart-plugs/{plug.id}",
            json={
                "name": "New Name",
                "auto_on": False,
                "auto_off": False,
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "New Name"
        assert result["auto_on"] is False
        assert result["auto_off"] is False

    # ========================================================================
    # Control endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_control_smart_plug_on(
        self, async_client: AsyncClient, smart_plug_factory, mock_tasmota_service, db_session
    ):
        """Verify smart plug can be turned on."""
        plug = await smart_plug_factory()

        response = await async_client.post(f"/api/v1/smart-plugs/{plug.id}/control", json={"action": "on"})

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["action"] == "on"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_control_smart_plug_off(
        self, async_client: AsyncClient, smart_plug_factory, mock_tasmota_service, db_session
    ):
        """Verify smart plug can be turned off."""
        plug = await smart_plug_factory()

        response = await async_client.post(f"/api/v1/smart-plugs/{plug.id}/control", json={"action": "off"})

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["action"] == "off"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_control_smart_plug_toggle(
        self, async_client: AsyncClient, smart_plug_factory, mock_tasmota_service, db_session
    ):
        """Verify smart plug can be toggled."""
        plug = await smart_plug_factory()

        response = await async_client.post(f"/api/v1/smart-plugs/{plug.id}/control", json={"action": "toggle"})

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["action"] == "toggle"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_control_invalid_action(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify invalid action returns error."""
        plug = await smart_plug_factory()

        response = await async_client.post(f"/api/v1/smart-plugs/{plug.id}/control", json={"action": "invalid"})

        # FastAPI returns 422 for pydantic validation errors
        assert response.status_code == 422

    # ========================================================================
    # Status endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_smart_plug_status(
        self, async_client: AsyncClient, smart_plug_factory, mock_tasmota_service, db_session
    ):
        """Verify smart plug status can be retrieved."""
        plug = await smart_plug_factory()

        response = await async_client.get(f"/api/v1/smart-plugs/{plug.id}/status")

        assert response.status_code == 200
        result = response.json()
        assert result["state"] == "ON"
        assert result["reachable"] is True

    # ========================================================================
    # Delete endpoint
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_delete_smart_plug(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify smart plug can be deleted."""
        plug = await smart_plug_factory()
        plug_id = plug.id

        response = await async_client.delete(f"/api/v1/smart-plugs/{plug_id}")

        assert response.status_code == 200

        # Verify deleted
        response = await async_client.get(f"/api/v1/smart-plugs/{plug_id}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_delete_nonexistent_plug(self, async_client: AsyncClient):
        """Verify deleting non-existent plug returns 404."""
        response = await async_client.delete("/api/v1/smart-plugs/9999")

        assert response.status_code == 404

    # ========================================================================
    # Switchbar visibility
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_show_in_switchbar(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify show_in_switchbar toggle persists correctly."""
        plug = await smart_plug_factory(show_in_switchbar=False)

        response = await async_client.patch(f"/api/v1/smart-plugs/{plug.id}", json={"show_in_switchbar": True})

        assert response.status_code == 200
        assert response.json()["show_in_switchbar"] is True

        # Verify persistence
        response = await async_client.get(f"/api/v1/smart-plugs/{plug.id}")
        assert response.json()["show_in_switchbar"] is True

    # ========================================================================
    # Tasmota Discovery endpoints
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tasmota_discovery_scan(self, async_client: AsyncClient):
        """Verify Tasmota discovery scan can be started."""
        response = await async_client.post("/api/v1/smart-plugs/discover/scan")

        assert response.status_code == 200
        data = response.json()
        assert "running" in data
        assert "scanned" in data
        assert "total" in data

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tasmota_discovery_status(self, async_client: AsyncClient):
        """Verify Tasmota discovery status endpoint works."""
        response = await async_client.get("/api/v1/smart-plugs/discover/status")

        assert response.status_code == 200
        data = response.json()
        assert "running" in data
        assert "scanned" in data
        assert "total" in data

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tasmota_discovery_devices(self, async_client: AsyncClient):
        """Verify Tasmota discovered devices endpoint works."""
        response = await async_client.get("/api/v1/smart-plugs/discover/devices")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_tasmota_discovery_stop(self, async_client: AsyncClient):
        """Verify Tasmota discovery can be stopped."""
        response = await async_client.post("/api/v1/smart-plugs/discover/stop")

        assert response.status_code == 200
        data = response.json()
        assert "running" in data

    # ========================================================================
    # Home Assistant Integration tests
    # ========================================================================

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_homeassistant_plug(self, async_client: AsyncClient):
        """Verify Home Assistant plug can be created."""
        data = {
            "name": "HA Plug",
            "plug_type": "homeassistant",
            "ha_entity_id": "switch.printer_plug",
            "enabled": True,
            "auto_on": True,
            "auto_off": False,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "HA Plug"
        assert result["plug_type"] == "homeassistant"
        assert result["ha_entity_id"] == "switch.printer_plug"
        assert result["ip_address"] is None

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_homeassistant_plug_missing_entity_id(self, async_client: AsyncClient):
        """Verify creating HA plug without entity_id fails."""
        data = {
            "name": "HA Plug",
            "plug_type": "homeassistant",
            # Missing ha_entity_id
            "enabled": True,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_tasmota_plug_missing_ip(self, async_client: AsyncClient):
        """Verify creating Tasmota plug without IP fails."""
        data = {
            "name": "Tasmota Plug",
            "plug_type": "tasmota",
            # Missing ip_address
            "enabled": True,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ha_entities_endpoint_not_configured(self, async_client: AsyncClient):
        """Verify HA entities endpoint returns error when not configured."""
        response = await async_client.get("/api/v1/smart-plugs/ha/entities")

        assert response.status_code == 400
        assert "not configured" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_plug_type(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify plug_type can be updated."""
        plug = await smart_plug_factory(plug_type="tasmota", ip_address="192.168.1.100")

        response = await async_client.patch(
            f"/api/v1/smart-plugs/{plug.id}",
            json={
                "plug_type": "homeassistant",
                "ha_entity_id": "switch.test",
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["plug_type"] == "homeassistant"
        assert result["ha_entity_id"] == "switch.test"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_control_homeassistant_plug(
        self, async_client: AsyncClient, smart_plug_factory, mock_homeassistant_service, db_session
    ):
        """Verify HA smart plug can be controlled."""
        plug = await smart_plug_factory(plug_type="homeassistant", ha_entity_id="switch.test")

        response = await async_client.post(f"/api/v1/smart-plugs/{plug.id}/control", json={"action": "on"})

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["action"] == "on"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_homeassistant_plug_status(
        self, async_client: AsyncClient, smart_plug_factory, mock_homeassistant_service, db_session
    ):
        """Verify HA smart plug status can be retrieved."""
        plug = await smart_plug_factory(plug_type="homeassistant", ha_entity_id="switch.test")

        response = await async_client.get(f"/api/v1/smart-plugs/{plug.id}/status")

        assert response.status_code == 200
        result = response.json()
        assert result["state"] == "ON"
        assert result["reachable"] is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_homeassistant_plug_with_energy_sensors(self, async_client: AsyncClient):
        """Verify HA plug can be created with energy sensor entities."""
        data = {
            "name": "HA Plug with Energy",
            "plug_type": "homeassistant",
            "ha_entity_id": "switch.printer_plug",
            "ha_power_entity": "sensor.printer_power",
            "ha_energy_today_entity": "sensor.printer_energy_today",
            "ha_energy_total_entity": "sensor.printer_energy_total",
            "enabled": True,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 200
        result = response.json()
        assert result["ha_power_entity"] == "sensor.printer_power"
        assert result["ha_energy_today_entity"] == "sensor.printer_energy_today"
        assert result["ha_energy_total_entity"] == "sensor.printer_energy_total"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_ha_energy_sensor_entities(self, async_client: AsyncClient, smart_plug_factory, db_session):
        """Verify HA energy sensor entities can be updated."""
        plug = await smart_plug_factory(plug_type="homeassistant", ha_entity_id="switch.test")

        response = await async_client.patch(
            f"/api/v1/smart-plugs/{plug.id}",
            json={
                "ha_power_entity": "sensor.new_power",
                "ha_energy_today_entity": "sensor.new_today",
                "ha_energy_total_entity": "sensor.new_total",
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["ha_power_entity"] == "sensor.new_power"
        assert result["ha_energy_today_entity"] == "sensor.new_today"
        assert result["ha_energy_total_entity"] == "sensor.new_total"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_ha_sensors_endpoint_not_configured(self, async_client: AsyncClient):
        """Verify HA sensors endpoint returns error when not configured."""
        response = await async_client.get("/api/v1/smart-plugs/ha/sensors")

        assert response.status_code == 400
        assert "not configured" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_homeassistant_script_plug(self, async_client: AsyncClient):
        """Verify Home Assistant script entity can be created as a plug.

        Scripts allow users to trigger HA automations that control multiple devices
        (e.g., turn on printer + fan together). Scripts can only be triggered (turn_on),
        not turned off.
        """
        data = {
            "name": "Turn On Printer Setup",
            "plug_type": "homeassistant",
            "ha_entity_id": "script.turn_on_printer_and_fan",
            "enabled": True,
            "auto_on": True,
            "auto_off": False,  # Scripts don't support auto_off
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Turn On Printer Setup"
        assert result["plug_type"] == "homeassistant"
        assert result["ha_entity_id"] == "script.turn_on_printer_and_fan"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_control_homeassistant_script(
        self, async_client: AsyncClient, smart_plug_factory, mock_homeassistant_service, db_session
    ):
        """Verify HA script entity can be triggered via control endpoint."""
        plug = await smart_plug_factory(plug_type="homeassistant", ha_entity_id="script.turn_on_printer")

        # Scripts use "on" action to trigger
        response = await async_client.post(f"/api/v1/smart-plugs/{plug.id}/control", json={"action": "on"})

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["action"] == "on"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_invalid_ha_entity_domain(self, async_client: AsyncClient):
        """Verify invalid HA entity domains are rejected."""
        data = {
            "name": "Invalid Entity",
            "plug_type": "homeassistant",
            "ha_entity_id": "sensor.some_sensor",  # sensor domain not allowed
            "enabled": True,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=data)

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_script_can_coexist_with_regular_plug(
        self, async_client: AsyncClient, smart_plug_factory, printer_factory, db_session
    ):
        """Verify HA scripts can be assigned to printers that already have a regular plug.

        Scripts are for multi-device control (e.g., turn on printer + fan together),
        so they should coexist with the main power plug.
        """
        # Create a printer
        printer = await printer_factory(name="Test Printer")

        # Create a regular Tasmota plug assigned to the printer
        main_plug = await smart_plug_factory(
            name="Main Power Plug",
            plug_type="tasmota",
            ip_address="192.168.1.100",
            printer_id=printer.id,
        )
        assert main_plug.printer_id == printer.id

        # Now try to create a script also assigned to the same printer
        script_data = {
            "name": "Turn On Everything",
            "plug_type": "homeassistant",
            "ha_entity_id": "script.turn_on_printer_setup",
            "printer_id": printer.id,
            "enabled": True,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=script_data)

        # Should succeed - scripts can coexist with regular plugs
        assert response.status_code == 200
        result = response.json()
        assert result["printer_id"] == printer.id
        assert result["ha_entity_id"] == "script.turn_on_printer_setup"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_regular_plug_blocked_when_another_exists(
        self, async_client: AsyncClient, smart_plug_factory, printer_factory, db_session
    ):
        """Verify regular plugs cannot be assigned if printer already has one."""
        # Create a printer
        printer = await printer_factory(name="Test Printer")

        # Create a regular plug assigned to the printer
        await smart_plug_factory(
            name="Main Power Plug",
            plug_type="tasmota",
            ip_address="192.168.1.100",
            printer_id=printer.id,
        )

        # Try to create another regular plug for the same printer
        another_plug = {
            "name": "Second Plug",
            "plug_type": "homeassistant",
            "ha_entity_id": "switch.another_plug",
            "printer_id": printer.id,
            "enabled": True,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=another_plug)

        # Should fail - only one regular plug per printer
        assert response.status_code == 400
        assert "already has a smart plug" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_scripts_by_printer_filters_by_show_on_printer_card(
        self, async_client: AsyncClient, smart_plug_factory, printer_factory, db_session
    ):
        """Verify scripts endpoint only returns scripts with show_on_printer_card=True."""
        printer = await printer_factory(name="Test Printer")

        # Create a script with show_on_printer_card=True (default)
        visible_script = await smart_plug_factory(
            name="Visible Script",
            plug_type="homeassistant",
            ha_entity_id="script.visible_script",
            printer_id=printer.id,
            show_on_printer_card=True,
        )

        # Create a script with show_on_printer_card=False
        await smart_plug_factory(
            name="Hidden Script",
            plug_type="homeassistant",
            ha_entity_id="script.hidden_script",
            printer_id=printer.id,
            show_on_printer_card=False,
        )

        response = await async_client.get(f"/api/v1/smart-plugs/by-printer/{printer.id}/scripts")

        assert response.status_code == 200
        scripts = response.json()
        # Should only return the visible script
        assert len(scripts) == 1
        assert scripts[0]["id"] == visible_script.id
        assert scripts[0]["name"] == "Visible Script"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_script_auto_on_auto_off_fields(
        self, async_client: AsyncClient, smart_plug_factory, printer_factory, db_session
    ):
        """Verify scripts can have auto_on and auto_off set for automation triggers."""
        printer = await printer_factory(name="Test Printer")

        # Create a script with custom auto_on/auto_off settings
        script_data = {
            "name": "Fan Control Script",
            "plug_type": "homeassistant",
            "ha_entity_id": "script.fan_control",
            "printer_id": printer.id,
            "auto_on": True,
            "auto_off": False,
            "show_on_printer_card": True,
        }

        response = await async_client.post("/api/v1/smart-plugs/", json=script_data)

        assert response.status_code == 200
        result = response.json()
        assert result["auto_on"] is True
        assert result["auto_off"] is False
        assert result["show_on_printer_card"] is True

        # Update the script's auto_off setting
        update_response = await async_client.patch(f"/api/v1/smart-plugs/{result['id']}", json={"auto_off": True})

        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["auto_off"] is True
