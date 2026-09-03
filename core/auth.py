import os
from datetime import datetime, timedelta
from functools import wraps

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Generate default JWT secret if not provided (for development only)
# In production, set JWT_SECRET in .env file
JWT_SECRET: str = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # Default secret for development - should be replaced in production
    JWT_SECRET = "lexa-dev-secret-key-change-in-production"
    print("[WARNING] JWT_SECRET not set! Using development default. Set JWT_SECRET in .env for production.")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()


def create_jwt_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(*allowed_roles):
    """Dependency factory untuk role-based access control."""
    def role_checker(payload: dict = Depends(verify_jwt)):
        user_role = payload.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Akses ditolak. Role tidak mencukupi.")
        return payload
    return role_checker
