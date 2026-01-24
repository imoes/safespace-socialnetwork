from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.services.auth_service import get_current_user
from app.services.translation_service import TranslationService


class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "de"
    source_lang: str = "auto"


router = APIRouter(prefix="/translate", tags=["Translation"])


@router.post("")
async def translate_text(
    request: TranslateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Übersetzt einen Text in die Zielsprache.

    - **text**: Der zu übersetzende Text
    - **target_lang**: Zielsprache (ISO 639-1, z.B. 'de', 'en', 'fr')
    - **source_lang**: Quellsprache ('auto' für automatische Erkennung)
    """
    if not request.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text darf nicht leer sein"
        )

    result = await TranslationService.translate_text(
        text=request.text,
        target_lang=request.target_lang,
        source_lang=request.source_lang
    )

    return result


@router.get("/languages")
async def get_supported_languages(
    current_user: dict = Depends(get_current_user)
):
    """
    Gibt eine Liste der unterstützten Sprachen zurück.
    """
    return {
        "languages": TranslationService.get_supported_languages()
    }
