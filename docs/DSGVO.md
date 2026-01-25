# DSGVO-Konformität (EU-Datenschutz-Grundverordnung)

Dieses Dokument beschreibt die DSGVO-Konformität der SocialNet-Plattform und listet alle erforderlichen Maßnahmen für die rechtssichere Einhaltung der EU-Datenschutz-Grundverordnung auf.

## Inhaltsverzeichnis

1. [Rechtliche Grundlage](#rechtliche-grundlage)
2. [Implementierter Status](#implementierter-status)
3. [Erforderliche Maßnahmen](#erforderliche-maßnahmen)
4. [Technische Implementierung](#technische-implementierung)
5. [Compliance-Checkliste](#compliance-checkliste)
6. [Quellen](#quellen)

---

## Rechtliche Grundlage

Die DSGVO (GDPR) ist seit dem 25. Mai 2018 in Kraft und gilt für alle Organisationen, die personenbezogene Daten von EU-Bürgern verarbeiten. **Stand 2026**: Enforcement bleibt aggressiv mit €1,2 Milliarden Strafen in 2024 und kumulativen Strafen von €5,88 Milliarden seit 2018.

### Kernprinzipien

1. **Rechtmäßigkeit, Verarbeitung nach Treu und Glauben, Transparenz**
2. **Zweckbindung**
3. **Datenminimierung**
4. **Richtigkeit**
5. **Speicherbegrenzung**
6. **Integrität und Vertraulichkeit**
7. **Rechenschaftspflicht**

---

## Implementierter Status

### ✅ Bereits implementierte Features

| Feature | Status | Datei/Ort |
|---------|--------|-----------|
| **Account-Löschung (Art. 17 - Recht auf Vergessenwerden)** | ✅ Implementiert | `backend/app/api/users.py:646` |
| **Datenlöschung innerhalb 30 Tage** | ✅ Sofort | Account-Löschung erfolgt unmittelbar |
| **Passwort-Hashing (Datensicherheit)** | ✅ Bcrypt | `backend/app/services/auth_service.py` |
| **Opt-in E-Mail-Benachrichtigungen** | ✅ Default disabled | `backend/app/config.py:45` |
| **HTTPS-Unterstützung** | ⚠️ Deployment-abhängig | Reverse Proxy erforderlich |

### ❌ Fehlende DSGVO-Anforderungen

| Anforderung | Status | Priorität | Artikel |
|-------------|--------|-----------|---------|
| **Datenschutzerklärung** | ❌ Fehlt | HOCH | Art. 13, 14 |
| **Cookie-Banner mit Einwilligung** | ❌ Fehlt | HOCH | ePrivacy, Art. 6 |
| **Datenzugriff (Datenportabilität)** | ❌ Fehlt | MITTEL | Art. 20 |
| **Einwilligungs-Management (Consent)** | ❌ Fehlt | HOCH | Art. 6, 7 |
| **Impressum** | ❌ Fehlt | HOCH | TMG §5 |
| **Datenschutzbeauftragter (DSB)** | ❌ Optional | NIEDRIG | Art. 37 |
| **Datenverarbeitungsverzeichnis** | ❌ Fehlt | MITTEL | Art. 30 |
| **Datenschutz-Folgenabschätzung (DPIA)** | ❌ Optional | NIEDRIG | Art. 35 |
| **Audit Logging** | ⚠️ Teilweise | MITTEL | Art. 32 |

---

## Erforderliche Maßnahmen

### 1. Datenschutzerklärung (Privacy Policy) - PRIORITÄT: HOCH

**Artikel**: Art. 13 DSGVO

**Was muss enthalten sein:**

- Identität und Kontaktdaten des Verantwortlichen
- Kontaktdaten des Datenschutzbeauftragten (falls vorhanden)
- Zwecke und Rechtsgrundlage der Verarbeitung
- Berechtigte Interessen (falls zutreffend)
- Empfänger der personenbezogenen Daten
- Absicht der Datenübermittlung an Drittländer
- Speicherdauer der Daten
- Rechte der betroffenen Person (Auskunft, Berichtigung, Löschung, etc.)
- Widerrufsrecht der Einwilligung
- Beschwerderecht bei Aufsichtsbehörde
- Ob Bereitstellung gesetzlich/vertraglich vorgeschrieben ist
- Informationen über automatisierte Entscheidungsfindung (Profiling)

**Umsetzung:**
```
/frontend/src/app/components/privacy-policy/
/frontend/src/app/legal/privacy-policy.component.ts
Route: /privacy-policy
```

**Template verfügbar:** Siehe unten in Abschnitt "Datenschutzerklärung Template"

---

### 2. Cookie-Banner & Consent Management - PRIORITÄT: HOCH

**Artikel**: ePrivacy-Richtlinie, Art. 6 DSGVO

**Anforderungen:**
- ✅ Einwilligung VOR dem Setzen nicht-essenzieller Cookies
- ✅ Klare Information über verwendete Cookies
- ✅ Opt-in (nicht Opt-out!)
- ✅ Widerrufbarkeit der Einwilligung
- ✅ Granulare Kontrolle (nicht nur "Alle akzeptieren")

**Verwendete Cookies in SocialNet:**
- `auth_token`: Essenziell (Login-Session) - KEINE Einwilligung erforderlich
- Redis Session: Essenziell - KEINE Einwilligung erforderlich

**Da aktuell nur essenzielle Cookies verwendet werden, ist ein Cookie-Banner optional. Falls zukünftig Analytics/Tracking hinzugefügt wird, MUSS ein Banner implementiert werden.**

**Empfohlene Lösungen:**
- [Cookiebot](https://www.cookiebot.com/)
- [OneTrust](https://www.onetrust.com/)
- [Usercentrics](https://usercentrics.com/)
- Selbst-gehostet: [klaro!](https://github.com/kiprotect/klaro)

---

### 3. Datenauskunft & Datenportabilität - PRIORITÄT: MITTEL

**Artikel**: Art. 15, 20 DSGVO

**Anforderungen:**
- User muss alle seine Daten in maschinenlesbarem Format (JSON) herunterladen können
- Antwortfrist: **30 Tage** (verlängerbar auf 60 Tage bei Komplexität)

**Zu exportierende Daten:**
- Profildaten (Username, E-Mail, Name, Bio, etc.)
- Alle Posts (inkl. Media-URLs)
- Freundesliste
- Likes & Kommentare
- Benachrichtigungen
- Account-Erstellungsdatum

**Implementierung:**
```python
@router.get("/me/data-export")
async def export_user_data(current_user: dict = Depends(get_current_user)):
    """
    Exportiert alle personenbezogenen Daten des Users im JSON-Format.
    DSGVO Art. 20 - Recht auf Datenübertragbarkeit
    """
    # Sammle alle Daten
    # Gib als JSON zurück
```

---

### 4. Impressum - PRIORITÄT: HOCH

**Artikel**: § 5 TMG (Telemediengesetz)

**Pflichtangaben für Websites:**
- Name und Anschrift des Diensteanbieters
- Kontaktmöglichkeiten (E-Mail, Telefon)
- Handelsregistereintrag (bei Unternehmen)
- Umsatzsteuer-ID (bei Unternehmen)
- Vertretungsberechtigte (bei juristischen Personen)
- Zuständige Aufsichtsbehörde (bei genehmigungspflichtigen Tätigkeiten)

**Umsetzung:**
```
/frontend/src/app/legal/impressum.component.ts
Route: /impressum
```

---

### 5. Einwilligungsverwaltung (Consent Management) - PRIORITÄT: HOCH

**Artikel**: Art. 6, 7 DSGVO

**Anforderungen für gültige Einwilligung:**
- ✅ Freiwillig
- ✅ Für bestimmten Fall (zweckgebunden)
- ✅ Informiert
- ✅ Unmissverständlich
- ✅ Widerrufbar (ebenso einfach wie Erteilung)

**In SocialNet relevant für:**
- E-Mail-Benachrichtigungen (bereits Opt-in!)
- Newsletter (falls implementiert)
- Datenverarbeitung für KI-Moderation (DeepSeek)

**Implementierung:**
```python
# User-Settings erweitern
@router.patch("/me/settings/consents")
async def update_consents(
    email_notifications: bool,
    ai_moderation: bool,
    current_user: dict = Depends(get_current_user)
):
    # Speichere Einwilligungen mit Zeitstempel
```

**Speicherung:**
```sql
ALTER TABLE users ADD COLUMN consent_email_notifications BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN consent_ai_moderation BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN consent_timestamp TIMESTAMP;
```

---

### 6. Datenverarbeitungsverzeichnis - PRIORITÄT: MITTEL

**Artikel**: Art. 30 DSGVO

**Pflicht ab:**
- Mehr als 250 Mitarbeiter ODER
- Risikoreiche Verarbeitung ODER
- Nicht nur gelegentliche Verarbeitung

**Inhalt:**
- Name und Kontaktdaten des Verantwortlichen
- Zwecke der Verarbeitung
- Kategorien betroffener Personen
- Kategorien personenbezogener Daten
- Kategorien von Empfängern
- Übermittlung in Drittländer
- Fristen für Löschung
- Technische und organisatorische Maßnahmen (TOM)

**Umsetzung:** Internes Dokument (`docs/Verarbeitungsverzeichnis.md`)

---

### 7. Audit Logging - PRIORITÄT: MITTEL

**Artikel**: Art. 32 DSGVO (Sicherheit der Verarbeitung)

**Zu loggen:**
- Login-Versuche (erfolgreich/fehlgeschlagen)
- Account-Löschungen
- Datenzugriff durch Admins
- Änderungen an Benutzerrechten
- Export von Nutzerdaten

**NICHT loggen:**
- Passwörter (auch nicht gehashed in Logs!)
- Sensible Inhalte

**Implementierung:**
```python
# Zentraler Audit Logger
class AuditLogger:
    @staticmethod
    async def log_event(
        event_type: str,
        user_uid: int,
        details: dict,
        ip_address: str = None
    ):
        # In PostgreSQL audit_log Tabelle speichern
```

---

### 8. Datenschutz-Folgenabschätzung (DPIA) - PRIORITÄT: NIEDRIG

**Artikel**: Art. 35 DSGVO

**Wann erforderlich:**
- Umfangreiche automatisierte Verarbeitung (KI/Profiling)
- Systematische Überwachung öffentlicher Bereiche
- Verarbeitung sensibler Daten in großem Umfang

**Für SocialNet relevant:**
- DeepSeek AI-Moderation → Möglicherweise DPIA erforderlich

**Umsetzung:** Externes Dokument durch Datenschutzberater

---

## Technische Implementierung

### Bereits implementierte Sicherheitsmaßnahmen

| Maßnahme | Status | Details |
|----------|--------|---------|
| **Passwort-Hashing** | ✅ | Bcrypt mit Salt |
| **JWT-Token für Authentication** | ✅ | 24h Gültigkeit |
| **HTTPS** | ⚠️ | Reverse Proxy erforderlich |
| **Input-Validierung** | ✅ | Pydantic Models |
| **SQL-Injection-Schutz** | ✅ | Prepared Statements (psycopg) |
| **CSRF-Schutz** | ✅ | SameSite Cookies |
| **Datensparsamkeit** | ✅ | Nur notwendige Felder |
| **Account-Löschung** | ✅ | Vollständige Datenlöschung |
| **E-Mail Opt-in** | ✅ | Default: disabled |

### Notwendige Ergänzungen

#### Account-Löschung erweitern

```python
# In backend/app/api/users.py:delete_account erweitern

# Zusätzlich löschen:
await conn.execute("DELETE FROM notifications WHERE user_uid = %s OR actor_uid = %s", (user_uid, user_uid))
await conn.execute("DELETE FROM audit_log WHERE user_uid = %s", (user_uid,))

# Audit Log erstellen
await AuditLogger.log_event("account_deleted", user_uid, {"reason": "user_request"})
```

#### DSGVO-Endpoint für Datenexport

```python
@router.get("/me/data-export", response_class=JSONResponse)
async def export_user_data(current_user: dict = Depends(get_current_user)):
    """
    DSGVO Art. 20 - Recht auf Datenübertragbarkeit
    Exportiert alle personenbezogenen Daten als JSON
    """
    user_uid = current_user["uid"]

    # User-Daten
    user_data = {
        "account": {
            "uid": current_user["uid"],
            "username": current_user["username"],
            "email": current_user["email"],
            "first_name": current_user.get("first_name"),
            "last_name": current_user.get("last_name"),
            "bio": current_user.get("bio"),
            "role": current_user.get("role"),
            "created_at": current_user["created_at"]
        },
        "posts": await get_all_user_posts(user_uid),
        "friends": await get_friends(user_uid),
        "notifications": await get_user_notifications_export(user_uid),
        "export_date": datetime.utcnow().isoformat()
    }

    # Als Download-Datei zurückgeben
    headers = {
        "Content-Disposition": f"attachment; filename=socialnet_data_{user_uid}_{datetime.utcnow().strftime('%Y%m%d')}.json"
    }

    return JSONResponse(content=user_data, headers=headers)
```

---

## Compliance-Checkliste

### Vor Produktiv-Betrieb erforderlich:

- [ ] **Datenschutzerklärung** erstellt und verlinkt (Footer)
- [ ] **Impressum** erstellt und verlinkt (Footer)
- [ ] **Cookie-Banner** implementiert (falls nicht-essenzielle Cookies)
- [ ] **Datenexport-Funktion** implementiert (Art. 20)
- [ ] **Consent-Management** für E-Mail & AI-Moderation
- [ ] **HTTPS** aktiviert (SSL-Zertifikat)
- [ ] **Audit Logging** für Admin-Aktionen
- [ ] **Verarbeitungsverzeichnis** erstellt
- [ ] **Backup & Recovery** getestet
- [ ] **Security Headers** konfiguriert (CSP, HSTS, etc.)

### Empfohlen:

- [ ] **Datenschutzbeauftragter** bestellt (ab 20 Mitarbeiter oder risikoreiche Daten)
- [ ] **DPIA** durchgeführt (AI-Moderation)
- [ ] **AV-Vertrag** mit DeepSeek (Auftragsverarbeitungsvertrag)
- [ ] **Löschfristen** definiert und dokumentiert
- [ ] **Incident Response Plan** für Datenpannen (Art. 33)
- [ ] **Mitarbeiter-Schulung** zu Datenschutz

---

## Datenschutzerklärung Template

```markdown
# Datenschutzerklärung

Stand: [Datum]

## 1. Verantwortlicher

[Ihr Name/Firmenname]
[Adresse]
E-Mail: [E-Mail]
Telefon: [Telefon]

## 2. Welche Daten werden verarbeitet?

### 2.1 Registrierung
- Benutzername
- E-Mail-Adresse
- Passwort (verschlüsselt)
- Vor- und Nachname (optional)

### 2.2 Nutzung der Plattform
- Profil-Informationen (Bio, Profilbild)
- Posts und Kommentare
- Likes und Interaktionen
- Freundesliste
- Benachrichtigungen

### 2.3 Technische Daten
- IP-Adresse
- Browser-Informationen
- Login-Zeitpunkte

## 3. Rechtsgrundlage der Verarbeitung

- **Art. 6 Abs. 1 lit. b DSGVO**: Vertragserfüllung (Bereitstellung der Plattform)
- **Art. 6 Abs. 1 lit. a DSGVO**: Einwilligung (E-Mail-Benachrichtigungen)
- **Art. 6 Abs. 1 lit. f DSGVO**: Berechtigtes Interesse (Sicherheit, Spam-Schutz)

## 4. Weitergabe von Daten

Ihre Daten werden NICHT an Dritte weitergegeben, außer:
- DeepSeek API (Content-Moderation) - nur Textinhalt, KEINE persönlichen Daten
- Gesetzliche Verpflichtungen

## 5. Speicherdauer

- Account-Daten: Bis zur Löschung durch den Nutzer
- Posts: Bis zur Löschung durch den Nutzer
- Logs: 90 Tage

## 6. Ihre Rechte

- **Auskunft** (Art. 15 DSGVO)
- **Berichtigung** (Art. 16 DSGVO)
- **Löschung** (Art. 17 DSGVO)
- **Einschränkung** (Art. 18 DSGVO)
- **Datenübertragbarkeit** (Art. 20 DSGVO)
- **Widerspruch** (Art. 21 DSGVO)
- **Widerruf der Einwilligung** (Art. 7 DSGVO)

Kontakt: [E-Mail]

## 7. Beschwerderecht

Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren:
[Zuständige Behörde je nach Bundesland]

## 8. KI-Moderation

Wir nutzen DeepSeek AI zur automatischen Moderation von Inhalten (Hassrede-Erkennung).
Dabei werden NUR Textinhalte übertragen, KEINE persönlichen Daten wie Name oder E-Mail.
```

---

## Quellen

Die folgenden Quellen wurden für diese Dokumentation verwendet:

1. [DSGVO/GDPR: Der richtige Umgang mit sozialen Netzwerken](https://www.computerweekly.com/de/ratgeber/DSGVO-GDPR-Der-richtige-Umgang-mit-sozialen-Netzwerken) - Computer Weekly
2. [Datenschutz in sozialen Netzwerken](https://www.datenschutz.org/soziale-netzwerke/) - Datensicherheit 2025/2026
3. [Art. 17 GDPR – Right to erasure](https://gdpr-info.eu/art-17-gdpr/) - GDPR Info
4. [Right to be Forgotten: GDPR Erasure Rights Guide](https://complydog.com/blog/right-to-be-forgotten-gdpr-erasure-rights-guide) - ComplyDog
5. [Complete GDPR Compliance Guide (2026-Ready)](https://secureprivacy.ai/blog/gdpr-compliance-2026) - SecurePrivacy
6. [GDPR Compliance Checklist](https://secureframe.com/de-de/blog/gdpr-compliance-checklist) - Secureframe
7. [DSGVO: Leitlinien, Empfehlungen, bewährte Verfahren](https://www.edpb.europa.eu/our-work-tools/general-guidance/guidelines-recommendations-best-practices_en) - EDPB

**Stand der Informationen:** Januar 2026

---

## Kontakt für Datenschutzfragen

Bei Fragen zur DSGVO-Umsetzung oder zu diesem Dokument:
- E-Mail: datenschutz@socialnet.local
- Oder erstellen Sie ein Issue im Repository

---

**Disclaimer:** Dieses Dokument dient als technische Grundlage. Es ersetzt KEINE Rechtsberatung durch einen Fachanwalt für IT-Recht oder einen zertifizierten Datenschutzbeauftragten. Vor Produktivbetrieb MUSS eine juristische Prüfung erfolgen.
