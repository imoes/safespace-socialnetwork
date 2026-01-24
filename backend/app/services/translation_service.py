from typing import Optional
import httpx


class TranslationService:
    """
    Service für die Übersetzung von Posts mit Google Translate API.
    Nutzt die öffentliche Google Translate API ohne API-Key für einfache Übersetzungen.
    """

    @classmethod
    async def translate_text(
        cls,
        text: str,
        target_lang: str = "de",
        source_lang: str = "auto"
    ) -> dict:
        """
        Übersetzt einen Text in die Zielsprache.

        Args:
            text: Der zu übersetzende Text
            target_lang: Zielsprache (ISO 639-1 Code, z.B. 'de', 'en', 'fr')
            source_lang: Quellsprache ('auto' für automatische Erkennung)

        Returns:
            dict mit übersetztem Text und erkannter Sprache
        """
        try:
            # Verwende die öffentliche Google Translate API
            # Für Production sollte die offizielle Cloud Translation API verwendet werden
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://translate.googleapis.com/translate_a/single",
                    params={
                        "client": "gtx",
                        "sl": source_lang,
                        "tl": target_lang,
                        "dt": "t",
                        "q": text
                    }
                )

                if response.status_code != 200:
                    raise Exception(f"Translation API returned status {response.status_code}")

                data = response.json()

                # Parse response - Format: [[[translated_text, original_text, ...]], ...]
                if data and len(data) > 0 and len(data[0]) > 0:
                    translated_parts = []
                    for item in data[0]:
                        if item and len(item) > 0:
                            translated_parts.append(item[0])

                    translated_text = "".join(translated_parts)

                    # Erkannte Sprache (falls vorhanden)
                    detected_lang = data[2] if len(data) > 2 else source_lang

                    return {
                        "translated_text": translated_text,
                        "detected_language": detected_lang,
                        "target_language": target_lang
                    }
                else:
                    raise Exception("Invalid response format from translation API")

        except Exception as e:
            print(f"Translation error: {e}")
            # Fallback: Originaler Text wenn Übersetzung fehlschlägt
            return {
                "translated_text": text,
                "detected_language": "unknown",
                "target_language": target_lang,
                "error": str(e)
            }

    @classmethod
    def get_supported_languages(cls) -> dict[str, str]:
        """
        Gibt eine Liste der unterstützten Sprachen zurück.
        """
        return {
            "de": "Deutsch",
            "en": "English",
            "es": "Español",
            "fr": "Français",
            "it": "Italiano",
            "pt": "Português",
            "ru": "Русский",
            "zh": "中文",
            "ja": "日本語",
            "ko": "한국어",
            "ar": "العربية",
            "tr": "Türkçe",
            "pl": "Polski",
            "nl": "Nederlands",
            "sv": "Svenska",
            "da": "Dansk",
            "no": "Norsk",
            "fi": "Suomi"
        }
