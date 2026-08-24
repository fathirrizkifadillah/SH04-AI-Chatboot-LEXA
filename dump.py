from core.database import SessionLocal, ChatSession
db = SessionLocal()
sessions = db.query(ChatSession).all()
for s in sessions:
    print(f"--- Session: {s.session_id} ---")
    for msg in s.history:
        print(f"[{msg.get('role')}]: {msg.get('content')}")
