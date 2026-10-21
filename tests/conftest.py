import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ["ENVIRONMENT"] = "testing"
os.environ["JWT_SECRET"] = "test-jwt-secret-key-for-lexa-testing-purpose-12345"
os.environ["ADMIN_EMAIL"] = "admin@lexatech.id"
os.environ["ADMIN_PASSWORD"] = "testadminpass"

import pytest
import bcrypt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import core.database as db_module
from core.database import Base, AdminUser
from api import app

# StaticPool SQLite in-memory engine keeps DB alive and shared across test threads
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # Bind database module to in-memory test engine
    db_module.engine = test_engine
    db_module.SessionLocal = TestingSessionLocal
    Base.metadata.create_all(bind=test_engine)

    # Seed test admin user
    db = TestingSessionLocal()
    salt = bcrypt.gensalt()
    pwd_hash = bcrypt.hashpw(b"testadminpass", salt).decode("utf-8")
    admin = AdminUser(
        name="Test Super Admin",
        email="admin@lexatech.id",
        password_hash=pwd_hash,
        role="Super Admin",
    )
    db.add(admin)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client():
    # Ensure database module is still using test DB
    db_module.engine = test_engine
    db_module.SessionLocal = TestingSessionLocal
    return TestClient(app)
