"""Site-weite Einstellungen (JSON-basiert)"""

import json
from pathlib import Path

SETTINGS_FILE = Path("/data/site_settings.json")

DEFAULT_SETTINGS = {
    "site_title": "SocialNet"
}


def _load_settings() -> dict:
    """Lädt die Settings aus der JSON-Datei"""
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return dict(DEFAULT_SETTINGS)
    return dict(DEFAULT_SETTINGS)


def _save_settings(settings: dict) -> None:
    """Speichert die Settings in die JSON-Datei"""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(settings, indent=2))


async def get_site_title() -> str:
    """Gibt den aktuellen Site-Titel zurück"""
    settings = _load_settings()
    return settings.get("site_title", DEFAULT_SETTINGS["site_title"])


async def set_site_title(title: str) -> str:
    """Setzt den Site-Titel"""
    settings = _load_settings()
    settings["site_title"] = title
    _save_settings(settings)
    return title


async def get_all_site_settings() -> dict:
    """Gibt alle Site-Settings zurück"""
    return _load_settings()
