from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "CS Agent"


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    references: list = []


class WidgetConfig(BaseModel):
    welcome_message: str
    quick_replies: list[str]
    bot_name: str = "Lexa"
    bot_avatar: str = "\U0001f4ac"


class AdminReplyReq(BaseModel):
    session_id: str
    content: str
