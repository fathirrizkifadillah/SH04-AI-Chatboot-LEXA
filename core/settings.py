import json
import os
from core.config import Config

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "settings.json")

DEFAULT_SETTINGS = {
    "welcome_message": Config.WELCOME_MESSAGE,
    "quick_replies": Config.QUICK_REPLIES,
    "system_prompt": "Anda adalah Lexa, asisten AI untuk LEXA Software House. Tugas Anda adalah membantu pelanggan, menjawab pertanyaan, dan memberikan informasi seputar layanan perusahaan dengan ramah dan profesional."
}

class SettingsManager:
    @staticmethod
    def get_settings():
        if not os.path.exists(SETTINGS_FILE):
            os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
            SettingsManager.save_settings(DEFAULT_SETTINGS)
            return DEFAULT_SETTINGS
        
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                settings = json.load(f)
                # Ensure all default keys exist
                for key, value in DEFAULT_SETTINGS.items():
                    if key not in settings:
                        settings[key] = value
                return settings
        except Exception:
            return DEFAULT_SETTINGS

    @staticmethod
    def save_settings(new_settings):
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        # Merge with existing
        current = SettingsManager.get_settings() if os.path.exists(SETTINGS_FILE) else DEFAULT_SETTINGS.copy()
        current.update(new_settings)
        
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=4, ensure_ascii=False)
        return current
