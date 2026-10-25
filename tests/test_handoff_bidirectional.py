import pytest
from core.database import (
    ChatSession,
    get_all_sessions,
)
from routers.chat import is_handoff_query, is_return_to_bot_query


def test_handoff_query_detection():
    assert is_handoff_query("mau ngobrol sama staf admin dong")
    assert is_handoff_query("hubungi customer service manusia")
    assert is_handoff_query("oper ke cs")
    assert not is_handoff_query("berapa harga paket pembuatan website?")


def test_return_to_bot_query_detection():
    assert is_return_to_bot_query("kembali ke bot")
    assert is_return_to_bot_query("balik ke chatbot")
    assert is_return_to_bot_query("mau ngobrol sama bot lagi")
    assert is_return_to_bot_query("kembali ke mode ai")
    assert not is_return_to_bot_query("terima kasih mas admin sudah dibantu")


def test_has_admin_replied_in_get_all_sessions(db_session):
    session_id_no_reply = "test-session-no-reply"
    session_id_with_reply = "test-session-with-reply"

    # 1. Sesi menunggu CS (belum ada admin reply)
    s1 = ChatSession(
        session_id=session_id_no_reply,
        is_human_handoff=True,
        history=[
            {"role": "user", "content": "Halo butuh CS", "timestamp": 1000},
        ]
    )
    db_session.add(s1)

    # 2. Sesi dengan CS aktif (admin sudah membalas)
    s2 = ChatSession(
        session_id=session_id_with_reply,
        is_human_handoff=True,
        history=[
            {"role": "user", "content": "Halo butuh CS", "timestamp": 1000},
            {"role": "admin", "content": "Halo saya staf CS, ada yang bisa dibantu?", "timestamp": 2000},
        ]
    )
    db_session.add(s2)
    db_session.commit()

    all_sess = get_all_sessions(limit=100)
    items_map = {item["session_id"]: item for item in all_sess["items"]}

    assert session_id_no_reply in items_map
    assert items_map[session_id_no_reply]["is_human_handoff"] is True
    assert items_map[session_id_no_reply]["has_admin_replied"] is False

    assert session_id_with_reply in items_map
    assert items_map[session_id_with_reply]["is_human_handoff"] is True
    assert items_map[session_id_with_reply]["has_admin_replied"] is True
