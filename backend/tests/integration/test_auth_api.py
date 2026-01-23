"""Integration tests for Authentication API endpoints.

Tests the full request/response cycle for /api/v1/auth/ and /api/v1/users/ endpoints.
"""

import pytest
from httpx import AsyncClient


class TestAuthStatusAPI:
    """Integration tests for /api/v1/auth/status endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_auth_status_disabled(self, async_client: AsyncClient):
        """Verify auth status returns disabled when not configured."""
        response = await async_client.get("/api/v1/auth/status")

        assert response.status_code == 200
        result = response.json()
        assert "auth_enabled" in result
        assert result["auth_enabled"] is False
        assert result["requires_setup"] is True


class TestAuthSetupAPI:
    """Integration tests for /api/v1/auth/setup endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_setup_auth_disabled(self, async_client: AsyncClient):
        """Verify auth can be set up with auth disabled (no password required)."""
        response = await async_client.post(
            "/api/v1/auth/setup",
            json={"auth_enabled": False},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["auth_enabled"] is False
        assert result["admin_created"] is False

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_setup_auth_enabled_requires_credentials(self, async_client: AsyncClient):
        """Verify enabling auth requires admin username and password."""
        response = await async_client.post(
            "/api/v1/auth/setup",
            json={"auth_enabled": True},
        )

        assert response.status_code == 400
        assert "Admin username and password are required" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_setup_auth_enabled_with_credentials(self, async_client: AsyncClient):
        """Verify auth can be enabled with admin credentials."""
        response = await async_client.post(
            "/api/v1/auth/setup",
            json={
                "auth_enabled": True,
                "admin_username": "testadmin",
                "admin_password": "testpassword123",
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert result["auth_enabled"] is True
        assert result["admin_created"] is True


class TestAuthLoginAPI:
    """Integration tests for /api/v1/auth/login endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_login_auth_disabled(self, async_client: AsyncClient):
        """Verify login fails when auth is not enabled."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "password"},
        )

        assert response.status_code == 400
        assert "Authentication is not enabled" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_login_success(self, async_client: AsyncClient):
        """Verify login succeeds with valid credentials after setup."""
        # First enable auth
        await async_client.post(
            "/api/v1/auth/setup",
            json={
                "auth_enabled": True,
                "admin_username": "logintest",
                "admin_password": "loginpassword123",
            },
        )

        # Now login
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "logintest", "password": "loginpassword123"},
        )

        assert response.status_code == 200
        result = response.json()
        assert "access_token" in result
        assert result["token_type"] == "bearer"
        assert result["user"]["username"] == "logintest"
        assert result["user"]["role"] == "admin"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_login_invalid_credentials(self, async_client: AsyncClient):
        """Verify login fails with invalid credentials."""
        # First enable auth
        await async_client.post(
            "/api/v1/auth/setup",
            json={
                "auth_enabled": True,
                "admin_username": "invalidtest",
                "admin_password": "correctpassword",
            },
        )

        # Try login with wrong password
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "invalidtest", "password": "wrongpassword"},
        )

        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]


class TestAuthMeAPI:
    """Integration tests for /api/v1/auth/me endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_me_without_token(self, async_client: AsyncClient):
        """Verify /me fails without authentication token."""
        response = await async_client.get("/api/v1/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_me_with_valid_token(self, async_client: AsyncClient):
        """Verify /me returns user info with valid token."""
        # Setup and login
        await async_client.post(
            "/api/v1/auth/setup",
            json={
                "auth_enabled": True,
                "admin_username": "metest",
                "admin_password": "mepassword123",
            },
        )

        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "metest", "password": "mepassword123"},
        )
        token = login_response.json()["access_token"]

        # Get current user
        response = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["username"] == "metest"
        assert result["role"] == "admin"
        assert result["is_active"] is True


class TestUsersAPI:
    """Integration tests for /api/v1/users/ endpoints."""

    @pytest.fixture
    async def auth_token(self, async_client: AsyncClient):
        """Setup auth and return admin token."""
        await async_client.post(
            "/api/v1/auth/setup",
            json={
                "auth_enabled": True,
                "admin_username": "usersadmin",
                "admin_password": "adminpassword123",
            },
        )

        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "usersadmin", "password": "adminpassword123"},
        )
        return login_response.json()["access_token"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_list_users_requires_auth(self, async_client: AsyncClient):
        """Verify listing users requires authentication."""
        response = await async_client.get("/api/v1/users/")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_list_users_as_admin(self, async_client: AsyncClient, auth_token: str):
        """Verify admin can list users."""
        response = await async_client.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)
        assert len(result) >= 1  # At least the admin user

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_user(self, async_client: AsyncClient, auth_token: str):
        """Verify admin can create a new user."""
        response = await async_client.post(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "username": "newuser",
                "password": "newuserpassword",
                "role": "user",
            },
        )

        assert response.status_code == 201
        result = response.json()
        assert result["username"] == "newuser"
        assert result["role"] == "user"
        assert result["is_active"] is True

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_user_duplicate_username(self, async_client: AsyncClient, auth_token: str):
        """Verify creating user with duplicate username fails."""
        # Create first user
        await async_client.post(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "username": "duplicateuser",
                "password": "password123",
                "role": "user",
            },
        )

        # Try to create duplicate
        response = await async_client.post(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "username": "duplicateuser",
                "password": "password456",
                "role": "user",
            },
        )

        assert response.status_code == 400
        assert "Username already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_update_user(self, async_client: AsyncClient, auth_token: str):
        """Verify admin can update a user."""
        # Create user
        create_response = await async_client.post(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "username": "updateuser",
                "password": "password123",
                "role": "user",
            },
        )
        user_id = create_response.json()["id"]

        # Update user
        response = await async_client.patch(
            f"/api/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"role": "admin"},
        )

        assert response.status_code == 200
        assert response.json()["role"] == "admin"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_delete_user(self, async_client: AsyncClient, auth_token: str):
        """Verify admin can delete a user."""
        # Create user
        create_response = await async_client.post(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "username": "deleteuser",
                "password": "password123",
                "role": "user",
            },
        )
        user_id = create_response.json()["id"]

        # Delete user
        response = await async_client.delete(
            f"/api/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        assert response.status_code == 204


class TestAuthDisableAPI:
    """Integration tests for /api/v1/auth/disable endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_disable_auth(self, async_client: AsyncClient):
        """Verify admin can disable authentication."""
        # Setup auth
        await async_client.post(
            "/api/v1/auth/setup",
            json={
                "auth_enabled": True,
                "admin_username": "disableadmin",
                "admin_password": "adminpassword123",
            },
        )

        # Login to get token
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "disableadmin", "password": "adminpassword123"},
        )
        token = login_response.json()["access_token"]

        # Disable auth
        response = await async_client.post(
            "/api/v1/auth/disable",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["auth_enabled"] is False

        # Verify auth is now disabled
        status_response = await async_client.get("/api/v1/auth/status")
        assert status_response.json()["auth_enabled"] is False
