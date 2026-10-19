from fastapi import APIRouter, Response

from core.schemas import WidgetConfig
from core.settings import SettingsManager

router = APIRouter()


@router.get("/config")
async def get_widget_config(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    settings = SettingsManager.get_settings()
    return WidgetConfig(
        welcome_message=settings.get("welcome_message", "Halo!"),
        quick_replies=settings.get("quick_replies", []),
    )
