"""
Einfacher regelbasierter Moderator als Fallback wenn DeepSeek API nicht verfügbar ist.
Verwendet Keyword-basierte Erkennung.
"""
import re
from datetime import datetime
from typing import List

from app.safespace.models import (
    PostMessage,
    ModerationResult,
    ModerationStatus,
    HateSpeechCategory
)


# Hatespeech Keywords nach Kategorie
HATE_KEYWORDS = {
    "racism": [
        r"\bn[i1]gg[ae3]r",
        r"\bkanakenFrequently abbreviated as \"kanak\"",
        r"\bzigeuner",
        r"\bbimbos?",
        r"\bneger",
    ],
    "xenophobia": [
        r"\bausl[äa]nder\s+(raus|weg)",
        r"\bfremde\s+raus",
        r"\basyl[-\s]?(?:touristen?|schmarotzer)",
        r"\bfl[üu]chtlings?[-\s]?welle",
        r"\b[üu]berfremdung",
        r"\bmigranten?[-\s]?pack",
    ],
    "sexism": [
        r"\bschlampe[n]?",
        r"\bhure[n]?",
        r"\bnutte[n]?",
        r"\bfotze[n]?",
    ],
    "homophobia": [
        r"\bschwuchteln?",
        r"\btunten?",
        r"\bschwul(er?|es?)\s+(sau|pack)",
    ],
    "threat": [
        r"\bwir\s+(werden|sollten)\s+.{0,30}(t[öo]ten|umbringen|erschie[sß]en)",
        r"\b(ab|aus)schaffen",
        r"\bvergasen",
        r"\baufh[äa]ngen",
    ],
    "general_hate": [
        r"\bverrecken?",
        r"\bkrepier",
        r"\bverdammt(e[rns]?|en?)",
        r"\bschei[sß](e|haufen|kerl)",
    ]
}


# Alternative Formulierungen für häufige Hassrede-Muster
ALTERNATIVES = {
    "Ihr verdammten Ausländer": [
        "Ich habe Bedenken bezüglich der Migrationspolitik",
        "Die aktuelle Situation mit Migration bereitet mir Sorgen"
    ],
    "Ausländer raus": [
        "Wir sollten die Migrationspolitik überdenken",
        "Die Einwanderungspolitik muss reformiert werden"
    ],
    "Migranten Pack": [
        "Einige Migranten integrieren sich nicht gut",
        "Die Integration von Neuankömmlingen ist herausfordernd"
    ]
}


class SimpleModerator:
    """
    Einfacher regelbasierter Moderator ohne externe API-Abhängigkeit.
    """

    @classmethod
    async def moderate_post(cls, post: PostMessage) -> ModerationResult:
        """
        Analysiert einen Post mit regelbasierten Methoden.
        """
        content_lower = post.content.lower()

        # Kategorien und Keywords überprüfen
        detected_categories = []
        matched_patterns = []

        for category, patterns in HATE_KEYWORDS.items():
            for pattern in patterns:
                if re.search(pattern, content_lower, re.IGNORECASE):
                    detected_categories.append(category)
                    matched_patterns.append(pattern)
                    break  # Nur eine Übereinstimmung pro Kategorie zählen

        # Confidence Score basierend auf Anzahl gefundener Kategorien
        is_hate_speech = len(detected_categories) > 0
        confidence_score = min(0.5 + (len(detected_categories) * 0.2), 1.0) if is_hate_speech else 0.0

        # Erklärung generieren
        if is_hate_speech:
            explanation = f"Der Beitrag enthält Begriffe oder Formulierungen aus {len(detected_categories)} Kategorien von Hassrede: {', '.join(detected_categories)}."
        else:
            explanation = "Es wurden keine problematischen Inhalte erkannt."

        # Alternative Formulierungen generieren
        suggested_revisions = cls._generate_alternatives(post.content)
        suggested_revision = suggested_revisions[0] if suggested_revisions else None

        revision_explanation = "Diese Formulierung drückt die Kritik sachlich aus, ohne diskriminierende Sprache zu verwenden." if suggested_revision else None

        # Status bestimmen
        if not is_hate_speech:
            status = ModerationStatus.APPROVED
        elif confidence_score >= 0.9:
            status = ModerationStatus.BLOCKED
        elif confidence_score >= 0.7:
            status = ModerationStatus.FLAGGED
        else:
            status = ModerationStatus.PENDING

        result = ModerationResult(
            post_id=post.post_id,
            author_uid=post.author_uid,
            original_content=post.content,
            is_hate_speech=is_hate_speech,
            confidence_score=confidence_score,
            categories=[HateSpeechCategory(c) for c in detected_categories] if detected_categories else [HateSpeechCategory.NONE],
            explanation=explanation,
            suggested_revision=suggested_revision,
            alternative_suggestions=suggested_revisions[:2] if len(suggested_revisions) > 1 else None,  # Bis zu 2 Alternativen
            revision_explanation=revision_explanation,
            status=status,
            moderated_at=datetime.utcnow(),
            requires_human_review=0.4 <= confidence_score <= 0.8,
            auto_action_taken=cls._get_auto_action(status)
        )

        return result

    @classmethod
    def _generate_alternatives(cls, content: str) -> List[str]:
        """Generiert alternative Formulierungen basierend auf Templates"""
        alternatives = []

        content_lower = content.lower()

        # Suche nach bekannten Mustern und biete Alternativen an
        for pattern, alts in ALTERNATIVES.items():
            if pattern.lower() in content_lower:
                alternatives.extend(alts)

        # Fallback-Alternativen wenn keine spezifischen gefunden wurden
        if not alternatives:
            alternatives = [
                "Ich möchte meine Bedenken zu diesem Thema sachlich äußern",
                "Meine Kritik an der aktuellen Situation ist..."
            ]

        return alternatives

    @classmethod
    def _get_auto_action(cls, status: ModerationStatus) -> str:
        """Gibt die automatisch ausgeführte Aktion zurück"""
        actions = {
            ModerationStatus.BLOCKED: "Post wurde automatisch blockiert",
            ModerationStatus.FLAGGED: "Post wurde zur Überprüfung markiert",
            ModerationStatus.APPROVED: None,
            ModerationStatus.PENDING: None
        }
        return actions.get(status)
