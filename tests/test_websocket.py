"""
Tests untuk core/websocket.py
Cakupan: connection manager, personal message, broadcast, auto-prune dead connections
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from core.websocket import ConnectionManager


@pytest.mark.anyio
async def test_add_and_disconnect_client():
    manager = ConnectionManager()
    ws = MagicMock()

    manager.add_connection(ws, "session_123")
    assert "session_123" in manager.active_connections
    assert ws in manager.active_connections["session_123"]

    manager.disconnect(ws, "session_123")
    assert "session_123" not in manager.active_connections


@pytest.mark.anyio
async def test_connect_and_disconnect_admin():
    manager = ConnectionManager()
    ws = AsyncMock()

    await manager.connect_admin(ws)
    assert ws in manager.admin_connections

    manager.disconnect_admin(ws)
    assert ws not in manager.admin_connections


@pytest.mark.anyio
async def test_broadcast_prunes_dead_session_connections():
    manager = ConnectionManager()
    alive_ws = AsyncMock()
    dead_ws = AsyncMock()
    dead_ws.send_json.side_effect = Exception("Connection closed abruptly")

    manager.add_connection(alive_ws, "session_456")
    manager.add_connection(dead_ws, "session_456")
    assert len(manager.active_connections["session_456"]) == 2

    await manager.broadcast_to_session({"msg": "hello"}, "session_456")

    # Dead connection should be pruned automatically
    assert len(manager.active_connections["session_456"]) == 1
    assert alive_ws in manager.active_connections["session_456"]
    assert dead_ws not in manager.active_connections["session_456"]
    alive_ws.send_json.assert_awaited_once_with({"msg": "hello"})


@pytest.mark.anyio
async def test_broadcast_prunes_dead_admin_connections():
    manager = ConnectionManager()
    alive_admin = AsyncMock()
    dead_admin = AsyncMock()
    dead_admin.send_json.side_effect = Exception("Admin disconnected")

    manager.admin_connections.append(alive_admin)
    manager.admin_connections.append(dead_admin)
    assert len(manager.admin_connections) == 2

    await manager.broadcast_to_admins({"type": "ping"})

    # Dead admin connection should be pruned automatically
    assert len(manager.admin_connections) == 1
    assert alive_admin in manager.admin_connections
    assert dead_admin not in manager.admin_connections
    alive_admin.send_json.assert_awaited_once_with({"type": "ping"})
