"""
Tests untuk core/database.py
Cakupan: CRUD functions, analytics metrics, chart data, feedback, session history
"""
import os

TEST_DB_PATH = os.path.abspath("tests/test_database_funcs.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-db-tests-minimum-32-bytes-long"

import pytest
from datetime import datetime, timedelta, timezone

from core.database import (
    init_database,
    SessionLocal,
    ChatSession,
    AdminUser,
    UnansweredQuery,
    ChatFeedback,
    get_analytics_metrics,
    get_analytics_chart_data,
    get_recent_unanswered_queries,
    get_all_sessions,
    get_session_history,
    set_human_handoff,
    get_all_users,
    delete_user,
    seed_default_admin,
    submit_feedback,
    get_feedback_stats,
    get_recent_feedback,
)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_database()
    yield
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clean_tables():
    """Bersihkan data sebelum setiap test untuk isolasi."""
    db = SessionLocal()
    try:
        db.query(ChatFeedback).delete()
        db.query(UnansweredQuery).delete()
        db.query(ChatSession).delete()
        db.query(AdminUser).delete()
        db.commit()
    finally:
        db.close()
    yield


# ─── ChatSession CRUD ──────────────────────────────────

class TestChatSessionCRUD:
    def test_create_session(self):
        db = SessionLocal()
        try:
            s = ChatSession(
                session_id="crud-1",
                history=[{"role": "user", "content": "Halo"}],
            )
            db.add(s)
            db.commit()

            result = db.query(ChatSession).filter(ChatSession.session_id == "crud-1").first()
            assert result is not None
            assert result.history[0]["content"] == "Halo"
        finally:
            db.close()

    def test_update_session_history(self):
        db = SessionLocal()
        try:
            s = ChatSession(session_id="crud-2", history=[])
            db.add(s)
            db.commit()

            s.history = [{"role": "user", "content": "Updated"}]
            db.commit()

            result = db.query(ChatSession).filter(ChatSession.session_id == "crud-2").first()
            assert len(result.history) == 1
            assert result.history[0]["content"] == "Updated"
        finally:
            db.close()

    def test_session_default_values(self):
        db = SessionLocal()
        try:
            s = ChatSession(session_id="crud-3", history=[])
            db.add(s)
            db.commit()

            result = db.query(ChatSession).filter(ChatSession.session_id == "crud-3").first()
            assert result.is_human_handoff is False or result.is_human_handoff is None
            assert result.created_at is not None
        finally:
            db.close()


# ─── get_session_history ────────────────────────────────

class TestGetSessionHistory:
    def test_existing_session(self):
        db = SessionLocal()
        try:
            s = ChatSession(
                session_id="hist-1",
                history=[
                    {"role": "user", "content": "Test"},
                    {"role": "assistant", "content": "Reply"},
                ],
                is_human_handoff=False,
            )
            db.add(s)
            db.commit()
        finally:
            db.close()

        result = get_session_history("hist-1")
        assert result is not None
        assert result["session_id"] == "hist-1"
        assert len(result["history"]) == 2
        assert result["is_human_handoff"] is False

    def test_nonexistent_session(self):
        result = get_session_history("does-not-exist")
        assert result is None


# ─── set_human_handoff ──────────────────────────────────

class TestSetHumanHandoff:
    def test_set_handoff_true(self):
        db = SessionLocal()
        try:
            s = ChatSession(session_id="handoff-1", history=[], is_human_handoff=False)
            db.add(s)
            db.commit()
        finally:
            db.close()

        assert set_human_handoff("handoff-1", True) is True

        db = SessionLocal()
        try:
            result = db.query(ChatSession).filter(ChatSession.session_id == "handoff-1").first()
            assert result.is_human_handoff is True
        finally:
            db.close()

    def test_set_handoff_false(self):
        db = SessionLocal()
        try:
            s = ChatSession(session_id="handoff-2", history=[], is_human_handoff=True)
            db.add(s)
            db.commit()
        finally:
            db.close()

        assert set_human_handoff("handoff-2", False) is True

    def test_nonexistent_session(self):
        assert set_human_handoff("not-real", True) is False


# ─── get_all_sessions ──────────────────────────────────

class TestGetAllSessions:
    def test_empty(self):
        result = get_all_sessions()
        assert result["total"] == 0
        assert result["items"] == []

    def test_with_sessions(self):
        db = SessionLocal()
        try:
            for i in range(3):
                db.add(ChatSession(
                    session_id=f"list-{i}",
                    history=[{"role": "user", "content": f"Msg {i}"}],
                ))
            db.commit()
        finally:
            db.close()

        result = get_all_sessions(limit=10)
        assert result["total"] == 3
        assert len(result["items"]) == 3

    def test_pagination(self):
        db = SessionLocal()
        try:
            for i in range(5):
                db.add(ChatSession(session_id=f"page-{i}", history=[]))
            db.commit()
        finally:
            db.close()

        result = get_all_sessions(limit=2, offset=0)
        assert len(result["items"]) == 2
        assert result["total"] == 5

    def test_last_message_truncation(self):
        db = SessionLocal()
        try:
            long_msg = "A" * 100
            db.add(ChatSession(
                session_id="truncate-test",
                history=[{"role": "user", "content": long_msg}],
            ))
            db.commit()
        finally:
            db.close()

        result = get_all_sessions()
        item = result["items"][0]
        assert len(item["last_message"]) <= 53  # 50 + "..."


# ─── get_all_users ─────────────────────────────────────

class TestGetAllUsers:
    def test_empty(self):
        result = get_all_users()
        assert result["total"] == 0

    def test_with_users(self):
        db = SessionLocal()
        try:
            db.add(AdminUser(name="User A", email="a@test.com", role="CS Agent"))
            db.add(AdminUser(name="User B", email="b@test.com", role="Super Admin"))
            db.commit()
        finally:
            db.close()

        result = get_all_users()
        assert result["total"] == 2
        assert len(result["items"]) == 2

    def test_user_fields(self):
        db = SessionLocal()
        try:
            db.add(AdminUser(name="Check Fields", email="fields@test.com", role="Editor (Knowledge Base)"))
            db.commit()
        finally:
            db.close()

        result = get_all_users()
        user = result["items"][0]
        assert "id" in user
        assert "name" in user
        assert "email" in user
        assert "role" in user
        # password_hash TIDAK boleh di-expose
        assert "password_hash" not in user


# ─── delete_user ───────────────────────────────────────

class TestDeleteUser:
    def test_delete_existing(self):
        db = SessionLocal()
        try:
            u = AdminUser(name="Del Me", email="del@test.com", role="CS Agent")
            db.add(u)
            db.commit()
            uid = u.id
        finally:
            db.close()

        assert delete_user(uid) is True

        db = SessionLocal()
        try:
            assert db.query(AdminUser).filter(AdminUser.id == uid).first() is None
        finally:
            db.close()

    def test_delete_nonexistent(self):
        assert delete_user(99999) is False


# ─── submit_feedback ───────────────────────────────────

class TestSubmitFeedback:
    def test_new_feedback(self):
        result = submit_feedback("fb-session", 0, "thumbs_up", "Bagus!")
        assert result is True

        db = SessionLocal()
        try:
            fb = db.query(ChatFeedback).filter(ChatFeedback.session_id == "fb-session").first()
            assert fb is not None
            assert fb.rating == "thumbs_up"
            assert fb.comment == "Bagus!"
        finally:
            db.close()

    def test_update_existing_feedback(self):
        submit_feedback("fb-update", 0, "thumbs_up")
        submit_feedback("fb-update", 0, "thumbs_down", "Berubah pikiran")

        db = SessionLocal()
        try:
            items = db.query(ChatFeedback).filter(
                ChatFeedback.session_id == "fb-update",
                ChatFeedback.message_index == 0,
            ).all()
            assert len(items) == 1  # Harus update, bukan insert baru
            assert items[0].rating == "thumbs_down"
            assert items[0].comment == "Berubah pikiran"
        finally:
            db.close()

    def test_feedback_without_comment(self):
        result = submit_feedback("fb-nocomment", 1, "thumbs_up")
        assert result is True


# ─── get_feedback_stats ────────────────────────────────

class TestGetFeedbackStats:
    def test_empty_feedback(self):
        stats = get_feedback_stats()
        assert stats["total"] == 0
        assert stats["thumbs_up"] == 0
        assert stats["thumbs_down"] == 0

    def test_with_feedback(self):
        db = SessionLocal()
        try:
            db.add(ChatFeedback(session_id="s1", message_index=0, rating="thumbs_up"))
            db.add(ChatFeedback(session_id="s1", message_index=1, rating="thumbs_up"))
            db.add(ChatFeedback(session_id="s2", message_index=0, rating="thumbs_down"))
            db.commit()
        finally:
            db.close()

        stats = get_feedback_stats()
        assert stats["total"] == 3
        assert stats["thumbs_up"] == 2
        assert stats["thumbs_down"] == 1
        assert "66.7%" in stats["satisfaction_rate"]


# ─── get_recent_feedback ───────────────────────────────

class TestGetRecentFeedback:
    def test_recent_feedback(self):
        db = SessionLocal()
        try:
            for i in range(5):
                db.add(ChatFeedback(session_id=f"recent-{i}", message_index=0, rating="thumbs_up"))
            db.commit()
        finally:
            db.close()

        result = get_recent_feedback(limit=3)
        assert len(result) == 3
        assert "id" in result[0]
        assert "rating" in result[0]


# ─── get_analytics_metrics ─────────────────────────────

class TestAnalyticsMetrics:
    def test_empty_database(self):
        metrics = get_analytics_metrics()
        assert metrics["total_conversations"] == 0
        assert metrics["unanswered_queries"] == 0
        assert metrics["active_users_30min"] == 0

    def test_with_data(self):
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            # Session aktif (updated baru)
            db.add(ChatSession(
                session_id="metric-1",
                history=[
                    {"role": "user", "content": "Hi", "timestamp": 1000000},
                    {"role": "assistant", "content": "Hello", "timestamp": 1002000},
                ],
                updated_at=now,
                created_at=now,
            ))
            # Session lama
            db.add(ChatSession(
                session_id="metric-2",
                history=[],
                updated_at=now - timedelta(hours=2),
                created_at=now - timedelta(days=1),
            ))
            # Unanswered query
            db.add(UnansweredQuery(session_id="metric-1", user_query="Apa itu Lexa?"))
            db.commit()
        finally:
            db.close()

        metrics = get_analytics_metrics()
        assert metrics["total_conversations"] == 2
        assert metrics["unanswered_queries"] == 1
        assert metrics["active_users_30min"] >= 1

    def test_avg_response_time(self):
        db = SessionLocal()
        try:
            now_ms = datetime.now(timezone.utc).timestamp() * 1000
            db.add(ChatSession(
                session_id="avg-rt",
                history=[
                    {"role": "user", "content": "Q1", "timestamp": now_ms},
                    {"role": "assistant", "content": "A1", "timestamp": now_ms + 3000},  # 3 detik
                    {"role": "user", "content": "Q2", "timestamp": now_ms + 5000},
                    {"role": "assistant", "content": "A2", "timestamp": now_ms + 7000},  # 2 detik
                ],
                updated_at=datetime.now(timezone.utc),
            ))
            db.commit()
        finally:
            db.close()

        metrics = get_analytics_metrics()
        assert metrics["avg_response_time"] != "N/A"
        assert "s" in metrics["avg_response_time"]  # e.g. "2.5s"


# ─── get_analytics_chart_data ──────────────────────────

class TestAnalyticsChartData:
    def test_returns_7_days(self):
        chart = get_analytics_chart_data()
        assert len(chart) == 7

    def test_chart_structure(self):
        chart = get_analytics_chart_data()
        for day in chart:
            assert "name" in day
            assert "chats" in day
            assert "percakapan" in day
            assert "unresolved" in day

    def test_chart_with_data(self):
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            db.add(ChatSession(session_id="chart-1", history=[], created_at=now))
            db.add(ChatSession(session_id="chart-2", history=[], created_at=now))
            db.add(UnansweredQuery(session_id="chart-1", user_query="Q?", created_at=now))
            db.commit()
        finally:
            db.close()

        chart = get_analytics_chart_data()
        today_label = datetime.now(timezone.utc).strftime("%d/%m")
        today_data = [d for d in chart if d["name"] == today_label]
        assert len(today_data) == 1
        assert today_data[0]["chats"] >= 2
        assert today_data[0]["unresolved"] >= 1


# ─── get_recent_unanswered_queries ─────────────────────

class TestUnansweredQueries:
    def test_empty(self):
        result = get_recent_unanswered_queries()
        assert result == []

    def test_with_queries(self):
        db = SessionLocal()
        try:
            for i in range(3):
                db.add(UnansweredQuery(session_id=f"uq-{i}", user_query=f"Question {i}?"))
            db.commit()
        finally:
            db.close()

        result = get_recent_unanswered_queries(limit=2)
        assert len(result) == 2
        assert "id" in result[0]
        assert "query" in result[0]
        assert "created_at" in result[0]


# ─── seed_default_admin ────────────────────────────────

class TestSeedDefaultAdmin:
    def test_seeds_when_no_users(self):
        seed_default_admin()

        db = SessionLocal()
        try:
            admin = db.query(AdminUser).filter(
                AdminUser.email == os.getenv("ADMIN_EMAIL", "admin@lexatech.id")
            ).first()
            assert admin is not None
            assert admin.role == "Super Admin"
            assert admin.password_hash is not None
        finally:
            db.close()

    def test_does_not_duplicate_admin_when_already_exists(self):
        # Initial seed
        seed_default_admin()

        # Re-run seed: harus sinkronkan tanpa menduplikasi admin
        seed_default_admin()

        db = SessionLocal()
        try:
            admin_email = os.getenv("ADMIN_EMAIL", "admin@lexatech.id").strip()
            admins = db.query(AdminUser).filter(AdminUser.email == admin_email).all()
            assert len(admins) == 1
        finally:
            db.close()

    def test_seeds_admin_when_other_users_exist(self):
        db = SessionLocal()
        try:
            db.add(AdminUser(name="Existing", email="existing@test.com", role="CS Agent"))
            db.commit()
        finally:
            db.close()

        seed_default_admin()

        db = SessionLocal()
        try:
            # Memastikan super admin tetap dijamin dibuat meskipun ada user lain
            count = db.query(AdminUser).count()
            assert count == 2
            admin = db.query(AdminUser).filter(
                AdminUser.email == os.getenv("ADMIN_EMAIL", "admin@lexatech.id").strip()
            ).first()
            assert admin is not None
        finally:
            db.close()
