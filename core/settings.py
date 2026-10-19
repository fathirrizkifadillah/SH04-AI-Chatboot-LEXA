import json
import os
from core.config import Config

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "settings.json")

DEFAULT_SETTINGS = {
    "welcome_message": Config.WELCOME_MESSAGE,
    "quick_replies": Config.QUICK_REPLIES,
    "system_prompt": (
        "Anda adalah Lexa, asisten AI resmi untuk LEXA Software House (perusahaan pengembang solusi teknologi dan software). "
        "Tugas Anda adalah membantu pengunjung dan calon klien, menjawab pertanyaan, dan memberikan informasi seputar profil dan layanan perusahaan secara ramah, profesional, dan akurat.\n\n"
        "PEDOMAN UTAMA:\n"
        "1. Layanan resmi LEXA Software House terdiri dari: Web Development, Mobile Development, System Development, UI/UX Design, IT Consulting, dan Maintenance & Support.\n"
        "2. Grounding Informasi: Berikan informasi faktual sesuai dokumen Knowledge Base resmi LEXA. Jangan mengarang layanan baru, paket fitur teknis fiktif, harga paket yang tidak terdaftar, atau alamat kantor spesifik yang tidak tercatat. Jika informasi belum tersedia di knowledge base, sampaikan dengan jujur bahwa informasi tersebut belum tercantum dan sarankan menghubungi kami di email info@lexatech.id atau WhatsApp/telepon +62 853 2013 2014.\n"
        "3. Permintaan Berbicara dengan CS / Manusia: Jika pengguna ingin berbicara, mengobrol, berkonsultasi langsung, atau meminta disambungkan dengan staf CS, admin, atau manusia, sambut dengan hangat dan konfirmasikan bahwa percakapan segera disambungkan ke staf Customer Service kami."
    )
}

class SettingsManager:
    @staticmethod
    def get_settings():
        # 1. Coba baca dari Database (PostgreSQL / SQLite) terlebih dahulu
        try:
            from core.database import SessionLocal, SystemSetting
            db = SessionLocal()
            try:
                rows = db.query(SystemSetting).all()
                if rows:
                    db_settings = {}
                    for r in rows:
                        try:
                            db_settings[r.key] = json.loads(r.value)
                        except Exception:
                            db_settings[r.key] = r.value
                    # Pastikan seluruh default key tersedia
                    for key, value in DEFAULT_SETTINGS.items():
                        if key not in db_settings:
                            db_settings[key] = value
                    return db_settings
            finally:
                db.close()
        except Exception:
            pass

        # 2. Fallback baca dari file lokal jika database belum terisi atau sedang offline
        if not os.path.exists(SETTINGS_FILE):
            os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
            SettingsManager.save_settings(DEFAULT_SETTINGS)
            return DEFAULT_SETTINGS
        
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                settings = json.load(f)
                for key, value in DEFAULT_SETTINGS.items():
                    if key not in settings:
                        settings[key] = value
                return settings
        except Exception:
            return DEFAULT_SETTINGS

    @staticmethod
    def save_settings(new_settings):
        # Merge dengan data saat ini
        current = SettingsManager.get_settings()
        current.update(new_settings)
        
        # 1. Simpan permanen ke Database
        try:
            from core.database import SessionLocal, SystemSetting
            db = SessionLocal()
            try:
                for k, v in current.items():
                    val_str = json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else str(v)
                    setting = db.query(SystemSetting).filter(SystemSetting.key == k).first()
                    if setting:
                        setting.value = val_str
                    else:
                        db.add(SystemSetting(key=k, value=val_str))
                db.commit()
            finally:
                db.close()
        except Exception:
            pass

        # 2. Simpan juga ke file lokal sebagai cadangan
        try:
            os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(current, f, indent=4, ensure_ascii=False)
        except Exception:
            pass

        return current
