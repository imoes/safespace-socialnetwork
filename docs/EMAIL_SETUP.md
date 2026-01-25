# E-Mail-Benachrichtigungen Einrichtung

## Übersicht

Das System unterstützt E-Mail-Benachrichtigungen für wichtige Ereignisse wie:
- 🎉 Jemand liked deinen Post
- 💬 Jemand kommentiert deinen Post
- 👍 Jemand liked deinen Kommentar

## Konfiguration

E-Mail-Benachrichtigungen werden über SMTP-Umgebungsvariablen in der `docker-compose.yml` konfiguriert.

### 1. Umgebungsvariablen setzen

Kopiere `.env.example` zu `.env` und setze die SMTP-Werte:

```bash
cp .env.example .env
```

Bearbeite die `.env` Datei:

```env
# E-Mail aktivieren
EMAIL_ENABLED=true

# SMTP Server Einstellungen
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@socialnet.local
SMTP_FROM_NAME=SocialNet
SMTP_USE_TLS=true
```

### 2. Provider-spezifische Konfiguration

#### Gmail

1. Aktiviere 2-Faktor-Authentifizierung in deinem Google-Konto
2. Erstelle ein App-Passwort: https://myaccount.google.com/apppasswords
3. Verwende dieses App-Passwort als `SMTP_PASSWORD`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_USE_TLS=true
```

#### Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_USE_TLS=true
```

#### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_USE_TLS=true
```

#### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-smtp-username
SMTP_PASSWORD=your-mailgun-smtp-password
SMTP_USE_TLS=true
```

### 3. Container neu starten

Nach der Konfiguration starte die Container neu:

```bash
docker-compose down
docker-compose up -d
```

## E-Mail-Templates

E-Mails werden mit HTML-Templates versendet und beinhalten:
- Farbiges Header-Design
- Benutzerfreundliche Buttons
- Direkte Links zu Posts
- Plain-Text Alternative für ältere E-Mail-Clients

## Benachrichtigungstypen

| Typ | Trigger | E-Mail Subject |
|-----|---------|---------------|
| `post_liked` | User liked deinen Post | 🎉 {username} hat deinen Post geliked! |
| `post_commented` | User kommentiert deinen Post | 💬 {username} hat deinen Post kommentiert! |
| `comment_liked` | User liked deinen Kommentar | 👍 {username} hat deinen Kommentar geliked! |

## Troubleshooting

### E-Mails werden nicht versendet

1. **Prüfe `EMAIL_ENABLED`**: Muss auf `true` gesetzt sein
2. **Prüfe Logs**: `docker-compose logs backend | grep Email`
3. **Teste SMTP-Verbindung**:
   ```bash
   docker exec -it socialnet-backend python -c "
   import smtplib
   server = smtplib.SMTP('smtp.gmail.com', 587)
   server.starttls()
   server.login('your-email@gmail.com', 'your-password')
   print('✅ SMTP Connection successful')
   server.quit()
   "
   ```

### Gmail: "Authentication failed"

- Stelle sicher, dass du ein **App-Passwort** verwendest (nicht dein normales Passwort)
- 2-Faktor-Authentifizierung muss aktiviert sein
- "Weniger sichere Apps" ist veraltet und funktioniert nicht mehr

### Port 587 blockiert

Einige Netzwerke blockieren Port 587. Versuche:
- Port 465 (SSL) statt 587 (TLS)
- `SMTP_USE_TLS=false` und direktes SSL verwenden

### E-Mails landen im Spam

- Setze `SMTP_FROM_EMAIL` auf eine echte Domain
- Konfiguriere SPF/DKIM Records für deine Domain
- Verwende einen dedizierten E-Mail-Service (SendGrid, Mailgun)

## Entwicklung / Testing

Für lokales Testen ohne echten SMTP-Server kannst du **MailHog** verwenden:

```yaml
# In docker-compose.yml hinzufügen:
  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
```

Dann in `.env`:
```env
EMAIL_ENABLED=true
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_USE_TLS=false
```

Web UI: http://localhost:8025

## Sicherheit

⚠️ **Wichtig:**
- Committen Sie **NIEMALS** echte SMTP-Passwörter in Git
- Verwenden Sie `.env` (ist in `.gitignore`)
- Für Produktion: Verwenden Sie Secrets Management (Docker Secrets, Kubernetes Secrets, etc.)
- Verwenden Sie App-Passwörter statt echte Account-Passwörter

## Performance

E-Mails werden asynchron versendet (`asyncio.create_task`), sodass:
- API-Requests nicht blockiert werden
- Benachrichtigungen sofort erstellt werden
- E-Mail-Fehler keine API-Fehler verursachen

Bei Massenbenachrichtigungen empfiehlt sich:
- Rate Limiting im SMTP-Service
- Queue-basierter Versand (z.B. Celery + Redis)
- Batch-Versand über E-Mail-Provider-APIs
