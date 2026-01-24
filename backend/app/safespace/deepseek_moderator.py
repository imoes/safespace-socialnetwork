import json
import re
from datetime import datetime
from typing import Optional

import httpx

from app.safespace.config import safespace_settings
from app.safespace.models import (
    PostMessage,
    ModerationResult,
    ModerationStatus,
    HateSpeechCategory
)


MODERATION_SYSTEM_PROMPT = """Du bist ein KI-Moderator für ein Social Network namens "SafeSpace". 
Deine Aufgabe ist es, Beiträge auf Hassrede zu analysieren und konstruktive Verbesserungsvorschläge zu machen.

## Kategorien von Hassrede:
- racism: Rassismus, Diskriminierung aufgrund von Hautfarbe/Ethnie
- sexism: Sexismus, Diskriminierung aufgrund des Geschlechts
- homophobia: Homophobie, Diskriminierung aufgrund sexueller Orientierung
- religious_hate: Religiöse Hetze, Diskriminierung aufgrund von Religion
- disability_hate: Ableismus, Diskriminierung aufgrund von Behinderungen
- xenophobia: Fremdenfeindlichkeit, Anti-Migranten-Hetze
- general_hate: Allgemeine Hassrede, Beleidigungen
- threat: Drohungen, Gewaltandrohungen
- harassment: Belästigung, Mobbing, persönliche Angriffe
- none: Keine Hassrede erkannt

## Deine Analyse soll folgendes enthalten:
1. Ist es Hassrede? (true/false)
2. Confidence Score (0.0 - 1.0)
3. Erkannte Kategorien
4. Erklärung warum es Hassrede ist (oder nicht)
5. Falls Hassrede: Ein konstruktiver Verbesserungsvorschlag, der die Kernaussage erhält aber respektvoll formuliert ist
6. Erklärung des Verbesserungsvorschlags

## Wichtige Regeln:
- Sei fair und berücksichtige Kontext
- Satire und Kritik sind erlaubt, solange sie nicht in Hassrede übergehen
- Bei Grenzfällen (Score 0.5-0.7): Erkläre den Kontext
- Der Verbesserungsvorschlag soll die ursprüngliche Meinung beibehalten, nur respektvoller formulieren
- Antworte NUR mit dem JSON-Objekt, keine zusätzlichen Erklärungen

## Ausgabeformat (JSON):
{
    "is_hate_speech": boolean,
    "confidence_score": float,
    "categories": ["category1", "category2"],
    "explanation": "string",
    "suggested_revision": "string oder null",
    "revision_explanation": "string oder null"
}"""


class DeepSeekModerator:
    """
    Moderations-Service der DeepSeek API nutzt um Posts auf Hassrede zu prüfen.
    """
    
    @classmethod
    async def moderate_post(cls, post: PostMessage) -> ModerationResult:
        """
        Analysiert einen Post mit DeepSeek und gibt Moderations-Ergebnis zurück.
        """
        
        # DeepSeek API aufrufen
        analysis = await cls._call_deepseek(post.content)
        
        # Status bestimmen
        status = cls._determine_status(
            analysis["is_hate_speech"],
            analysis["confidence_score"]
        )
        
        # Result erstellen
        result = ModerationResult(
            post_id=post.post_id,
            author_uid=post.author_uid,
            original_content=post.content,
            is_hate_speech=analysis["is_hate_speech"],
            confidence_score=analysis["confidence_score"],
            categories=[HateSpeechCategory(c) for c in analysis["categories"]],
            explanation=analysis["explanation"],
            suggested_revision=analysis.get("suggested_revision"),
            alternative_suggestions=analysis.get("alternative_suggestions"),
            revision_explanation=analysis.get("revision_explanation"),
            status=status,
            moderated_at=datetime.utcnow(),
            requires_human_review=cls._needs_human_review(analysis),
            auto_action_taken=cls._get_auto_action(status)
        )
        
        return result
    
    @classmethod
    async def _call_deepseek(cls, content: str) -> dict:
        """Ruft DeepSeek API auf"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{safespace_settings.deepseek_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {safespace_settings.deepseek_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": safespace_settings.deepseek_model,
                        "messages": [
                            {"role": "system", "content": MODERATION_SYSTEM_PROMPT},
                            {"role": "user", "content": f"Analysiere diesen Beitrag:\n\n{content}"}
                        ],
                        "temperature": 0.1,  # Niedrig für konsistente Ergebnisse
                        "max_tokens": 1000
                    }
                )

                response.raise_for_status()
                data = response.json()

                # Antwort parsen
                assistant_message = data["choices"][0]["message"]["content"]

                # JSON aus der Antwort extrahieren
                return cls._parse_response(assistant_message)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 402:
                print("⚠️  DeepSeek API: 402 Payment Required - Fallback auf SimpleModerator")
                # Fallback auf SimpleModerator
                from app.safespace.simple_moderator import SimpleModerator
                from app.safespace.models import PostMessage
                temp_post = PostMessage(
                    post_id=0,
                    author_uid=0,
                    author_username="",
                    content=content,
                    visibility="public",
                    created_at=datetime.utcnow()
                )
                result = await SimpleModerator.moderate_post(temp_post)
                return {
                    "is_hate_speech": result.is_hate_speech,
                    "confidence_score": result.confidence_score,
                    "categories": [c.value for c in result.categories],
                    "explanation": result.explanation,
                    "suggested_revision": result.suggested_revision,
                    "alternative_suggestions": result.alternative_suggestions,
                    "revision_explanation": result.revision_explanation
                }
            raise
    
    @classmethod
    def _parse_response(cls, response: str) -> dict:
        """Parst die DeepSeek Antwort und extrahiert JSON"""
        
        # Versuche JSON direkt zu parsen
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        # Versuche JSON aus Markdown Code Block zu extrahieren
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Fallback: Versuche JSON irgendwo im Text zu finden
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        # Wenn alles fehlschlägt: Default Response
        print(f"⚠️ Konnte DeepSeek Antwort nicht parsen: {response[:200]}")
        return {
            "is_hate_speech": False,
            "confidence_score": 0.0,
            "categories": ["none"],
            "explanation": "Analyse konnte nicht durchgeführt werden",
            "suggested_revision": None,
            "revision_explanation": None
        }
    
    @classmethod
    def _determine_status(cls, is_hate_speech: bool, confidence: float) -> ModerationStatus:
        """Bestimmt den Moderations-Status basierend auf Analyse"""
        
        if not is_hate_speech:
            return ModerationStatus.APPROVED
        
        if confidence >= safespace_settings.auto_block_threshold:
            return ModerationStatus.BLOCKED
        
        if confidence >= safespace_settings.auto_flag_threshold:
            return ModerationStatus.FLAGGED
        
        return ModerationStatus.PENDING
    
    @classmethod
    def _needs_human_review(cls, analysis: dict) -> bool:
        """Prüft ob menschliche Überprüfung nötig ist"""
        score = analysis["confidence_score"]
        
        # Grenzfälle brauchen Review
        if 0.4 <= score <= 0.8:
            return True
        
        # Bestimmte Kategorien immer reviewen
        high_risk_categories = {"threat", "harassment"}
        if any(c in high_risk_categories for c in analysis["categories"]):
            return True
        
        return False
    
    @classmethod
    def _get_auto_action(cls, status: ModerationStatus) -> Optional[str]:
        """Gibt die automatisch ausgeführte Aktion zurück"""
        actions = {
            ModerationStatus.BLOCKED: "Post wurde automatisch blockiert",
            ModerationStatus.FLAGGED: "Post wurde zur Überprüfung markiert",
            ModerationStatus.APPROVED: None,
            ModerationStatus.PENDING: None
        }
        return actions.get(status)
    
    @classmethod
    async def suggest_improvement(cls, content: str) -> str:
        """
        Generiert nur einen Verbesserungsvorschlag für existierenden Content.
        Kann vom User angefordert werden.
        """
        prompt = f"""Der folgende Beitrag wurde als potenziell problematisch markiert.
Bitte formuliere ihn so um, dass er die gleiche Meinung ausdrückt, aber respektvoller und konstruktiver ist.

Original:
{content}

Antworte NUR mit dem verbesserten Text, keine Erklärungen."""
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{safespace_settings.deepseek_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {safespace_settings.deepseek_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": safespace_settings.deepseek_model,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500
                }
            )
            
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
