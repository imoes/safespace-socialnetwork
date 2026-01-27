"""E-Mail-Templates Verwaltung (JSON-basiert, mehrsprachig)"""

import json
from pathlib import Path
from typing import Optional

TEMPLATES_FILE = Path("/data/email_templates.json")

# Notification-Typen mit Standard-Templates
NOTIFICATION_TYPES = ["post_liked", "post_commented", "comment_liked", "birthday", "group_post"]

DEFAULT_TEMPLATES = {
    "post_liked": {
        "de": {
            "subject": "🎉 {{actor}} hat deinen Post geliked!",
            "body": "<p>Hallo <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> hat einen deiner Posts geliked!</p>{{post_content}}{{action_button}}"
        },
        "en": {
            "subject": "🎉 {{actor}} liked your post!",
            "body": "<p>Hello <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> liked one of your posts!</p>{{post_content}}{{action_button}}"
        }
    },
    "post_commented": {
        "de": {
            "subject": "💬 {{actor}} hat deinen Post kommentiert!",
            "body": "<p>Hallo <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> hat deinen Post kommentiert!</p>{{post_content}}{{comment_content}}{{action_button}}"
        },
        "en": {
            "subject": "💬 {{actor}} commented on your post!",
            "body": "<p>Hello <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> commented on your post!</p>{{post_content}}{{comment_content}}{{action_button}}"
        }
    },
    "comment_liked": {
        "de": {
            "subject": "👍 {{actor}} hat deinen Kommentar geliked!",
            "body": "<p>Hallo <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> hat deinen Kommentar geliked!</p>{{post_content}}{{action_button}}"
        },
        "en": {
            "subject": "👍 {{actor}} liked your comment!",
            "body": "<p>Hello <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> liked your comment!</p>{{post_content}}{{action_button}}"
        }
    },
    "birthday": {
        "de": {
            "subject": "🎂 {{actor}} hat heute Geburtstag!",
            "body": "<p>Hallo <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> hat heute Geburtstag!</p>{{birthday_age}}<p>Gratuliere jetzt!</p>"
        },
        "en": {
            "subject": "🎂 {{actor}} has a birthday today!",
            "body": "<p>Hello <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> has a birthday today!</p>{{birthday_age}}<p>Send your congratulations!</p>"
        }
    },
    "group_post": {
        "de": {
            "subject": "📝 {{actor}} hat in einer Gruppe gepostet!",
            "body": "<p>Hallo <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> hat einen neuen Beitrag in einer deiner Gruppen veröffentlicht!</p>{{post_content}}{{action_button}}"
        },
        "en": {
            "subject": "📝 {{actor}} posted in a group!",
            "body": "<p>Hello <strong>{{username}}</strong>,</p><p><strong>{{actor}}</strong> posted in one of your groups!</p>{{post_content}}{{action_button}}"
        }
    }
}


def _load_templates() -> dict:
    """Lädt die Templates aus der JSON-Datei"""
    if TEMPLATES_FILE.exists():
        try:
            return json.loads(TEMPLATES_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return dict(DEFAULT_TEMPLATES)
    return dict(DEFAULT_TEMPLATES)


def _save_templates(templates: dict) -> None:
    """Speichert die Templates in die JSON-Datei"""
    TEMPLATES_FILE.parent.mkdir(parents=True, exist_ok=True)
    TEMPLATES_FILE.write_text(json.dumps(templates, indent=2, ensure_ascii=False))


async def get_all_templates() -> dict:
    """Gibt alle E-Mail-Templates zurück"""
    return _load_templates()


async def get_template(notification_type: str, language: str = "de") -> Optional[dict]:
    """Gibt ein spezifisches Template zurück"""
    templates = _load_templates()
    type_templates = templates.get(notification_type, {})
    return type_templates.get(language)


async def save_template(notification_type: str, language: str, subject: str, body: str) -> dict:
    """Speichert ein E-Mail-Template"""
    templates = _load_templates()
    if notification_type not in templates:
        templates[notification_type] = {}
    templates[notification_type][language] = {
        "subject": subject,
        "body": body
    }
    _save_templates(templates)
    return templates[notification_type][language]


async def get_notification_types() -> list[str]:
    """Gibt die verfügbaren Notification-Typen zurück"""
    return NOTIFICATION_TYPES
