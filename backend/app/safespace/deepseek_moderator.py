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


def get_moderation_system_prompt(language: str = "de") -> str:
    """Generiert den System-Prompt in der gewünschten Sprache"""

    prompts = {
        "de": """Du bist ein KI-Moderator für ein Social Network namens "SafeSpace".
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
- Antworte ALLE Felder auf Deutsch
- Antworte NUR mit dem JSON-Objekt, keine zusätzlichen Erklärungen

## Ausgabeformat (JSON):
{
    "is_hate_speech": boolean,
    "confidence_score": float,
    "categories": ["category1", "category2"],
    "explanation": "string",
    "suggested_revision": "string oder null",
    "revision_explanation": "string oder null"
}""",

        "en": """You are an AI moderator for a social network called "SafeSpace".
Your task is to analyze posts for hate speech and provide constructive improvement suggestions.

## Hate Speech Categories:
- racism: Racism, discrimination based on skin color/ethnicity
- sexism: Sexism, discrimination based on gender
- homophobia: Homophobia, discrimination based on sexual orientation
- religious_hate: Religious hatred, discrimination based on religion
- disability_hate: Ableism, discrimination based on disabilities
- xenophobia: Xenophobia, anti-immigrant hatred
- general_hate: General hate speech, insults
- threat: Threats, violent threats
- harassment: Harassment, bullying, personal attacks
- none: No hate speech detected

## Your analysis should contain:
1. Is it hate speech? (true/false)
2. Confidence Score (0.0 - 1.0)
3. Detected categories
4. Explanation of why it is hate speech (or not)
5. If hate speech: A constructive improvement suggestion that preserves the core message but is respectfully formulated
6. Explanation of the improvement suggestion

## Important rules:
- Be fair and consider context
- Satire and criticism are allowed as long as they don't cross into hate speech
- For borderline cases (Score 0.5-0.7): Explain the context
- The improvement suggestion should preserve the original opinion, just formulated more respectfully
- Answer ALL fields in English
- Reply ONLY with the JSON object, no additional explanations

## Output format (JSON):
{
    "is_hate_speech": boolean,
    "confidence_score": float,
    "categories": ["category1", "category2"],
    "explanation": "string",
    "suggested_revision": "string or null",
    "revision_explanation": "string or null"
}""",

        "es": """Eres un moderador de IA para una red social llamada "SafeSpace".
Tu tarea es analizar publicaciones en busca de discurso de odio y proporcionar sugerencias constructivas de mejora.

## Categorías de discurso de odio:
- racism: Racismo, discriminación basada en color de piel/etnia
- sexism: Sexismo, discriminación basada en género
- homophobia: Homofobia, discriminación basada en orientación sexual
- religious_hate: Odio religioso, discriminación basada en religión
- disability_hate: Capacitismo, discriminación basada en discapacidades
- xenophobia: Xenofobia, odio anti-inmigrante
- general_hate: Discurso de odio general, insultos
- threat: Amenazas, amenazas violentas
- harassment: Acoso, bullying, ataques personales
- none: No se detectó discurso de odio

## Tu análisis debe contener:
1. ¿Es discurso de odio? (true/false)
2. Puntuación de confianza (0.0 - 1.0)
3. Categorías detectadas
4. Explicación de por qué es discurso de odio (o no)
5. Si es discurso de odio: Una sugerencia de mejora constructiva que preserve el mensaje central pero formulado respetuosamente
6. Explicación de la sugerencia de mejora

## Reglas importantes:
- Sé justo y considera el contexto
- La sátira y la crítica están permitidas siempre que no crucen al discurso de odio
- Para casos límite (Puntuación 0.5-0.7): Explica el contexto
- La sugerencia de mejora debe preservar la opinión original, solo formulada más respetuosamente
- Responde TODOS los campos en español
- Responde SOLO con el objeto JSON, sin explicaciones adicionales

## Formato de salida (JSON):
{
    "is_hate_speech": boolean,
    "confidence_score": float,
    "categories": ["category1", "category2"],
    "explanation": "string",
    "suggested_revision": "string o null",
    "revision_explanation": "string o null"
}""",

        "fr": """Tu es un modérateur IA pour un réseau social appelé "SafeSpace".
Ta tâche est d'analyser les publications pour détecter les discours haineux et de fournir des suggestions d'amélioration constructives.

## Catégories de discours haineux:
- racism: Racisme, discrimination basée sur la couleur de peau/l'ethnie
- sexism: Sexisme, discrimination basée sur le genre
- homophobia: Homophobie, discrimination basée sur l'orientation sexuelle
- religious_hate: Haine religieuse, discrimination basée sur la religion
- disability_hate: Capacitisme, discrimination basée sur les handicaps
- xenophobia: Xénophobie, haine anti-immigrés
- general_hate: Discours haineux général, insultes
- threat: Menaces, menaces violentes
- harassment: Harcèlement, intimidation, attaques personnelles
- none: Aucun discours haineux détecté

## Ton analyse doit contenir:
1. Est-ce un discours haineux? (true/false)
2. Score de confiance (0.0 - 1.0)
3. Catégories détectées
4. Explication de pourquoi c'est un discours haineux (ou non)
5. Si discours haineux: Une suggestion d'amélioration constructive qui préserve le message principal mais formulé respectueusement
6. Explication de la suggestion d'amélioration

## Règles importantes:
- Sois juste et considère le contexte
- La satire et la critique sont autorisées tant qu'elles ne basculent pas dans le discours haineux
- Pour les cas limites (Score 0.5-0.7): Explique le contexte
- La suggestion d'amélioration doit préserver l'opinion originale, juste formulée plus respectueusement
- Réponds à TOUS les champs en français
- Réponds UNIQUEMENT avec l'objet JSON, sans explications supplémentaires

## Format de sortie (JSON):
{
    "is_hate_speech": boolean,
    "confidence_score": float,
    "categories": ["category1", "category2"],
    "explanation": "string",
    "suggested_revision": "string ou null",
    "revision_explanation": "string ou null"
}""",

        "it": """Sei un moderatore AI per un social network chiamato "SafeSpace".
Il tuo compito è analizzare i post per rilevare discorsi d'odio e fornire suggerimenti di miglioramento costruttivi.

## Categorie di discorso d'odio:
- racism: Razzismo, discriminazione basata sul colore della pelle/etnia
- sexism: Sessismo, discriminazione basata sul genere
- homophobia: Omofobia, discriminazione basata sull'orientamento sessuale
- religious_hate: Odio religioso, discriminazione basata sulla religione
- disability_hate: Abilismo, discriminazione basata sulle disabilità
- xenophobia: Xenofobia, odio anti-immigrati
- general_hate: Discorso d'odio generale, insulti
- threat: Minacce, minacce violente
- harassment: Molestie, bullismo, attacchi personali
- none: Nessun discorso d'odio rilevato

## La tua analisi deve contenere:
1. È un discorso d'odio? (true/false)
2. Punteggio di confidenza (0.0 - 1.0)
3. Categorie rilevate
4. Spiegazione del perché è un discorso d'odio (o non lo è)
5. Se discorso d'odio: Un suggerimento di miglioramento costruttivo che preserva il messaggio centrale ma formulato rispettosamente
6. Spiegazione del suggerimento di miglioramento

## Regole importanti:
- Sii equo e considera il contesto
- Satira e critica sono permesse finché non sfociano in discorso d'odio
- Per casi limite (Punteggio 0.5-0.7): Spiega il contesto
- Il suggerimento di miglioramento deve preservare l'opinione originale, solo formulata più rispettosamente
- Rispondi a TUTTI i campi in italiano
- Rispondi SOLO con l'oggetto JSON, senza spiegazioni aggiuntive

## Formato di output (JSON):
{
    "is_hate_speech": boolean,
    "confidence_score": float,
    "categories": ["category1", "category2"],
    "explanation": "string",
    "suggested_revision": "string o null",
    "revision_explanation": "string o null"
}""",

        "ar": """أنت مشرف ذكاء اصطناعي لشبكة اجتماعية تسمى "SafeSpace".
مهمتك هي تحليل المنشورات للكشف عن خطاب الكراهية وتقديم اقتراحات بناءة للتحسين.

## فئات خطاب الكراهية:
- racism: العنصرية، التمييز على أساس لون البشرة/العرق
- sexism: التمييز الجنسي، التمييز على أساس الجنس
- homophobia: رهاب المثلية، التمييز على أساس التوجه الجنسي
- religious_hate: الكراهية الدينية، التمييز على أساس الدين
- disability_hate: التمييز على أساس الإعاقة
- xenophobia: كره الأجانب، الكراهية ضد المهاجرين
- general_hate: خطاب كراهية عام، إهانات
- threat: تهديدات، تهديدات عنيفة
- harassment: مضايقة، تنمر، هجمات شخصية
- none: لم يتم اكتشاف خطاب كراهية

## يجب أن يحتوي تحليلك على:
1. هل هو خطاب كراهية؟ (true/false)
2. درجة الثقة (0.0 - 1.0)
3. الفئات المكتشفة
4. شرح لماذا هو خطاب كراهية (أو ليس كذلك)
5. إذا كان خطاب كراهية: اقتراح تحسين بناء يحافظ على الرسالة الأساسية ولكن مصاغ باحترام
6. شرح اقتراح التحسين

## قواعد مهمة:
- كن عادلاً وضع في اعتبارك السياق
- السخرية والنقد مسموح بهما طالما أنهما لا يتحولان إلى خطاب كراهية
- للحالات الحدية (النتيجة 0.5-0.7): اشرح السياق
- يجب أن يحافظ اقتراح التحسين على الرأي الأصلي، فقط مصاغ بشكل أكثر احتراماً
- أجب على جميع الحقول بالعربية
- أجب فقط بكائن JSON، بدون شروحات إضافية

## تنسيق الإخراج (JSON):
{
    "is_hate_speech": boolean,
    "confidence_score": float,
    "categories": ["category1", "category2"],
    "explanation": "string",
    "suggested_revision": "string أو null",
    "revision_explanation": "string أو null"
}"""
    }

    # Fallback auf Deutsch wenn Sprache nicht unterstützt
    return prompts.get(language, prompts["de"])


class DeepSeekModerator:
    """
    Moderations-Service der DeepSeek API nutzt um Posts auf Hassrede zu prüfen.
    """
    
    @classmethod
    async def moderate_post(cls, post: PostMessage, language: str = "de") -> ModerationResult:
        """
        Analysiert einen Post mit DeepSeek und gibt Moderations-Ergebnis zurück.

        Args:
            post: Der zu moderierende Post
            language: Sprache für die Moderation (de, en, es, fr, it, ar)
        """

        # DeepSeek API aufrufen
        analysis = await cls._call_deepseek(post.content, language)
        
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
    async def _call_deepseek(cls, content: str, language: str = "de") -> dict:
        """Ruft DeepSeek API auf"""

        try:
            system_prompt = get_moderation_system_prompt(language)

            # Sprachspezifische User-Prompts
            user_prompts = {
                "de": f"Analysiere diesen Beitrag:\n\n{content}",
                "en": f"Analyze this post:\n\n{content}",
                "es": f"Analiza esta publicación:\n\n{content}",
                "fr": f"Analyse cette publication:\n\n{content}",
                "it": f"Analizza questo post:\n\n{content}",
                "ar": f"حلل هذا المنشور:\n\n{content}"
            }
            user_prompt = user_prompts.get(language, user_prompts["de"])

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
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
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
                result = await SimpleModerator.moderate_post(temp_post, language)
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
    async def suggest_improvement(cls, content: str, language: str = "de") -> str:
        """
        Generiert nur einen Verbesserungsvorschlag für existierenden Content.
        Kann vom User angefordert werden.

        Args:
            content: Der zu verbessernde Inhalt
            language: Sprache für den Vorschlag (de, en, es, fr, it, ar)
        """
        prompts = {
            "de": f"""Der folgende Beitrag wurde als potenziell problematisch markiert.
Bitte formuliere ihn so um, dass er die gleiche Meinung ausdrückt, aber respektvoller und konstruktiver ist.

Original:
{content}

Antworte NUR mit dem verbesserten Text, keine Erklärungen.""",

            "en": f"""The following post was flagged as potentially problematic.
Please rephrase it to express the same opinion, but in a more respectful and constructive way.

Original:
{content}

Reply ONLY with the improved text, no explanations.""",

            "es": f"""La siguiente publicación fue marcada como potencialmente problemática.
Por favor, reformúlala para expresar la misma opinión, pero de manera más respetuosa y constructiva.

Original:
{content}

Responde SOLO con el texto mejorado, sin explicaciones.""",

            "fr": f"""La publication suivante a été signalée comme potentiellement problématique.
Veuillez la reformuler pour exprimer la même opinion, mais de manière plus respectueuse et constructive.

Original:
{content}

Répondez UNIQUEMENT avec le texte amélioré, sans explications.""",

            "it": f"""Il seguente post è stato contrassegnato come potenzialmente problematico.
Per favore riformulalo per esprimere la stessa opinione, ma in modo più rispettoso e costruttivo.

Originale:
{content}

Rispondi SOLO con il testo migliorato, senza spiegazioni.""",

            "ar": f"""تم وضع علامة على المنشور التالي باعتباره مشكلة محتملة.
يرجى إعادة صياغته للتعبير عن نفس الرأي، ولكن بطريقة أكثر احتراماً وبناءة.

الأصلي:
{content}

أجب فقط بالنص المحسن، بدون شروحات."""
        }
        prompt = prompts.get(language, prompts["de"])
        
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
