from fastapi import APIRouter

from core.schemas import WidgetConfig
from core.settings import SettingsManager

router = APIRouter()


@router.get("/config")
async def get_widget_config():
    settings = SettingsManager.get_settings()
    return WidgetConfig(
        welcome_message=settings.get("welcome_message", "Halo!"),
        quick_replies=settings.get("quick_replies", []),
    )
