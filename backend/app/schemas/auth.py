from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class SetupRequest(BaseModel):
    auth_enabled: bool
    admin_username: str | None = None
    admin_password: str | None = None


class SetupResponse(BaseModel):
    auth_enabled: bool
    admin_created: bool | None = None
