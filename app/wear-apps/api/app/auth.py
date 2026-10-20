from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


def require_device_token(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.auth_configured:
        raise HTTPException(
            status_code=503,
            detail="DEVICE_API_TOKEN is not configured on the server.",
        )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing Bearer token.")
    if credentials.credentials != settings.device_api_token:
        raise HTTPException(status_code=401, detail="Invalid device token.")
