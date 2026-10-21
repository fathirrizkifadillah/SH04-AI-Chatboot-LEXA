from core.database import (
    ChatSession,
    AdminUser,
    UnansweredQuery,
    ChatFeedback,
    get_all_sessions,
    get_session_history,
    set_human_handoff,
    delete_chat_session,
    resolve_unanswered_query,
    delete_unanswered_query,
    submit_feedback,
    get_feedback_stats,
    get_recent_feedback,
    get_analytics_metrics,
)


def test_chat_session_lifecycle(db_session):
    session_id = "test-session-123"
    # Create
    session = ChatSession(
        session_id=session_id,
        history=[{"role": "user", "content": "Halo apa kabar?"}, {"role": "assistant", "content": "Halo! Ada yang bisa dibantu?"}],
        is_human_handoff=False,
    )
    db_session.add(session)
    db_session.commit()

    # Read
    saved = get_session_history(session_id)
    assert saved is not None
    assert saved["session_id"] == session_id
    assert len(saved["history"]) == 2
    assert saved["is_human_handoff"] is False

    # Update handoff
    assert set_human_handoff(session_id, True) is True
    updated = get_session_history(session_id)
    assert updated["is_human_handoff"] is True

    # List sessions
    all_sess = get_all_sessions(limit=10, offset=0)
    assert all_sess["total"] >= 1
    found = any(s["session_id"] == session_id for s in all_sess["items"])
    assert found is True

    # Soft delete (archive)
    assert delete_chat_session(session_id) is True
    # Session is archived, so it shouldn't show in active inbox
    inbox = get_all_sessions(limit=10, offset=0)
    found_in_inbox = any(s["session_id"] == session_id for s in inbox["items"])
    assert found_in_inbox is False


def test_unanswered_query_crud(db_session):
    uq = UnansweredQuery(
        session_id="test-session-uq",
        user_query="Berapa diskon akhir tahun?",
        status="pending",
    )
    db_session.add(uq)
    db_session.commit()
    uq_id = uq.id

    assert uq_id is not None
    assert uq.status == "pending"

    # Resolve
    assert resolve_unanswered_query(uq_id) is True
    db_session.expire_all()
    refetched = db_session.query(UnansweredQuery).filter(UnansweredQuery.id == uq_id).first()
    assert refetched.status == "resolved"

    # Delete
    assert delete_unanswered_query(uq_id) is True
    db_session.expire_all()
    assert db_session.query(UnansweredQuery).filter(UnansweredQuery.id == uq_id).first() is None


def test_feedback_submission_and_stats(db_session):
    session_id = "test-feedback-session"

    # Submit thumbs up
    assert submit_feedback(session_id, message_index=1, rating="thumbs_up", comment="Sangat membantu!") is True
    # Submit thumbs down for another message
    assert submit_feedback(session_id, message_index=2, rating="thumbs_down", comment="Kurang akurat") is True

    stats = get_feedback_stats()
    assert stats["total"] >= 2
    assert stats["thumbs_up"] >= 1
    assert stats["thumbs_down"] >= 1

    recent = get_recent_feedback(limit=5)
    assert len(recent) >= 2


def test_analytics_metrics(db_session):
    metrics = get_analytics_metrics("7d")
    assert "total_conversations" in metrics
    assert "resolution_rate" in metrics
    assert "ai_auto_rate" in metrics
    assert "active_inbox_sessions" in metrics
