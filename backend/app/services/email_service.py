import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from app.config import settings
from app.db.site_settings import get_site_url


class EmailService:
    """
    Service für das Versenden von E-Mails über SMTP.
    Konfiguriert über Umgebungsvariablen in docker-compose.yml.
    """

    @classmethod
    async def send_email(
        cls,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Sendet eine E-Mail.

        Args:
            to_email: Empfänger E-Mail
            subject: Betreff
            html_content: HTML Inhalt
            text_content: Plain-Text Alternative (optional)

        Returns:
            bool: True wenn erfolgreich, False bei Fehler
        """
        # Wenn Email disabled ist, skip
        if not settings.email_enabled:
            print(f"📧 Email disabled - Would send to {to_email}: {subject}")
            return False

        try:
            # E-Mail erstellen
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            msg['Date'] = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')

            # Text-Version hinzufügen (Fallback)
            if text_content:
                part1 = MIMEText(text_content, 'plain', 'utf-8')
                msg.attach(part1)

            # HTML-Version hinzufügen
            part2 = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(part2)

            # SMTP-Verbindung aufbauen und senden
            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
                server.starttls()
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)

            # Login falls Credentials vorhanden
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)

            # E-Mail senden
            server.send_message(msg)
            server.quit()

            print(f"✅ Email sent to {to_email}: {subject}")
            return True

        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {e}")
            return False

    @classmethod
    async def send_notification_email(
        cls,
        to_email: str,
        to_username: str,
        actor_username: str,
        notification_type: str,
        post_id: Optional[int] = None,
        post_author_uid: Optional[int] = None,
        comment_id: Optional[int] = None,
        post_content: Optional[str] = None,
        comment_content: Optional[str] = None,
        birthday_age: Optional[int] = None,
        user_language: str = "de",
        group_id: Optional[int] = None,
        group_name: Optional[str] = None
    ) -> bool:
        """
        Sendet eine Benachrichtigungs-E-Mail.
        Verwendet gespeicherte Templates falls vorhanden, sonst Standard-Templates.
        """
        # Site URL aus Einstellungen laden
        try:
            site_url = await get_site_url()
        except Exception:
            site_url = "http://localhost:4200"

        # Betreff und Nachricht basierend auf Typ
        subject, html_content, text_content = cls._build_notification_email(
            to_username, actor_username, notification_type, post_id, comment_id, site_url,
            post_content=post_content, comment_content=comment_content, birthday_age=birthday_age,
            group_id=group_id, group_name=group_name
        )

        return await cls.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )

    @classmethod
    def _build_from_template(
        cls,
        template: dict,
        to_username: str,
        actor_username: str,
        post_id: Optional[int],
        post_content: Optional[str] = None,
        comment_content: Optional[str] = None,
        birthday_age: Optional[int] = None,
        site_url: str = "http://localhost:4200"
    ) -> tuple[str, str, str]:
        """Erstellt E-Mail aus gespeichertem Template mit Platzhalter-Ersetzung."""
        import html as html_module
        import re

        post_link = f"{site_url}/my-posts?highlight={post_id}" if post_id else ""

        # Post-Inhalt Block
        post_content_html = ""
        if post_content:
            truncated = post_content[:300] + ("..." if len(post_content) > 300 else "")
            safe_content = html_module.escape(truncated)
            post_content_html = f'<div style="background: #f0f2f5; border-left: 4px solid #1877f2; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">{safe_content}</div>'

        # Kommentar Block
        comment_content_html = ""
        if comment_content:
            truncated_comment = comment_content[:300] + ("..." if len(comment_content) > 300 else "")
            safe_comment = html_module.escape(truncated_comment)
            comment_content_html = f'<div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">{safe_comment}</div>'

        # Action Button
        action_button_html = ""
        if post_link:
            action_button_html = f"<a href='{post_link}' class='button'>Post ansehen</a>"

        # Birthday Age Block
        birthday_age_html = ""
        if birthday_age:
            birthday_age_html = f'<p style="font-size: 24px; text-align: center; margin: 16px 0;">🎉 <strong>{birthday_age}</strong> 🎉</p>'

        # Platzhalter ersetzen
        subject = template["subject"]
        subject = subject.replace("{{username}}", to_username)
        subject = subject.replace("{{actor}}", actor_username)

        body = template["body"]
        body = body.replace("{{username}}", to_username)
        body = body.replace("{{actor}}", actor_username)
        body = body.replace("{{post_content}}", post_content_html)
        body = body.replace("{{comment_content}}", comment_content_html)
        body = body.replace("{{action_button}}", action_button_html)
        body = body.replace("{{birthday_age}}", birthday_age_html)

        html = cls._wrap_email_html("🔔", body)

        # Einfache Text-Version
        text = re.sub(r'<[^>]+>', '', body)
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")

        return subject, html, text

    @classmethod
    def _build_notification_email(
        cls,
        to_username: str,
        actor_username: str,
        notification_type: str,
        post_id: Optional[int],
        comment_id: Optional[int],
        site_url: str = "http://localhost:4200",
        post_content: Optional[str] = None,
        comment_content: Optional[str] = None,
        birthday_age: Optional[int] = None,
        group_id: Optional[int] = None,
        group_name: Optional[str] = None
    ) -> tuple[str, str, str]:
        """
        Erstellt Betreff und Inhalt für Benachrichtigungs-E-Mails.

        Returns:
            (subject, html_content, text_content)
        """
        # Post-Link (wenn verfügbar) - verwendet konfigurierte Site-URL
        post_link = f"{site_url}/my-posts?highlight={post_id}" if post_id else ""

        # Post-Inhalt HTML-Block (wird bei post_liked, post_commented, comment_liked verwendet)
        post_content_html = ""
        post_content_text = ""
        if post_content:
            # Inhalt auf 300 Zeichen kürzen für E-Mail
            truncated = post_content[:300] + ("..." if len(post_content) > 300 else "")
            import html as html_module
            safe_content = html_module.escape(truncated)
            post_content_html = f"""
                <div style="background: #f0f2f5; border-left: 4px solid #1877f2; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">
                    <strong>Dein Post:</strong><br>{safe_content}
                </div>"""
            post_content_text = f"\n\nDein Post:\n\"{truncated}\"\n"

        # Kommentar-Inhalt HTML-Block
        comment_content_html = ""
        comment_content_text = ""
        if comment_content:
            truncated_comment = comment_content[:300] + ("..." if len(comment_content) > 300 else "")
            import html as html_module
            safe_comment = html_module.escape(truncated_comment)
            comment_content_html = f"""
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; color: #333;">
                    <strong>Kommentar von {actor_username}:</strong><br>{safe_comment}
                </div>"""
            comment_content_text = f"\n\nKommentar von {actor_username}:\n\"{truncated_comment}\"\n"

        if notification_type == "post_liked":
            subject = f"🎉 {actor_username} hat deinen Post geliked!"
            text = f"""
Hallo {to_username},

{actor_username} hat einen deiner Posts geliked!
{post_content_text}
Sieh dir deinen Post an: {post_link}

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            html = cls._wrap_email_html(
                "🎉 Neue Benachrichtigung",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> hat einen deiner Posts geliked!</p>
                {post_content_html}
                {"<a href='" + post_link + "' class='button'>Post ansehen</a>" if post_link else ""}"""
            )

        elif notification_type == "post_commented":
            subject = f"💬 {actor_username} hat deinen Post kommentiert!"
            text = f"""
Hallo {to_username},

{actor_username} hat deinen Post kommentiert!
{post_content_text}{comment_content_text}
Sieh dir den Kommentar an: {post_link}

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            html = cls._wrap_email_html(
                "💬 Neuer Kommentar",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> hat deinen Post kommentiert!</p>
                {post_content_html}
                {comment_content_html}
                {"<a href='" + post_link + "' class='button'>Kommentar ansehen</a>" if post_link else ""}"""
            )

        elif notification_type == "comment_liked":
            subject = f"👍 {actor_username} hat deinen Kommentar geliked!"
            text = f"""
Hallo {to_username},

{actor_username} hat deinen Kommentar geliked!
{post_content_text}
{"Sieh dir den Post an: " + post_link if post_link else ""}

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            html = cls._wrap_email_html(
                "👍 Kommentar geliked",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> hat deinen Kommentar geliked!</p>
                {post_content_html}
                {"<a href='" + post_link + "' class='button'>Post ansehen</a>" if post_link else ""}"""
            )

        elif notification_type == "birthday":
            age_text = f" und ist heute {birthday_age} Jahre alt geworden" if birthday_age else ""
            subject = f"🎂 {actor_username} hat heute Geburtstag!"
            text = f"""
Hallo {to_username},

{actor_username} hat heute Geburtstag{age_text}!

Gratuliere jetzt auf SafeSpace!

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            age_html = f"<p style='font-size: 24px; text-align: center; margin: 16px 0;'>🎉 <strong>{birthday_age} Jahre</strong> 🎉</p>" if birthday_age else ""
            html = cls._wrap_email_html(
                "🎂 Geburtstag!",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> hat heute Geburtstag!</p>
                {age_html}
                <p>Gratuliere jetzt auf SafeSpace!</p>"""
            )

        elif notification_type == "group_join_request":
            group_link = f"{site_url}/groups/{group_id}" if group_id else ""
            group_display_name = group_name or "einer Gruppe"
            subject = f"👥 {actor_username} möchte deiner Gruppe beitreten!"
            text = f"""
Hallo {to_username},

{actor_username} möchte der Gruppe "{group_display_name}" beitreten.

Bitte überprüfe die Anfrage und entscheide, ob du sie annehmen oder ablehnen möchtest.

{f"Gruppe ansehen: {group_link}" if group_link else ""}

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            html = cls._wrap_email_html(
                "👥 Neue Beitrittsanfrage",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> möchte der Gruppe <strong>"{group_display_name}"</strong> beitreten.</p>
                <p>Bitte überprüfe die Anfrage und entscheide, ob du sie annehmen oder ablehnen möchtest.</p>
                {"<a href='" + group_link + "' class='button'>Anfrage überprüfen</a>" if group_link else ""}"""
            )

        elif notification_type == "friend_request":
            profile_link = f"{site_url}/profile/{actor_username}"
            subject = f"👋 {actor_username} möchte mit dir befreundet sein!"
            text = f"""
Hallo {to_username},

{actor_username} hat dir eine Freundschaftsanfrage gesendet!

Sieh dir das Profil an: {profile_link}

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            html = cls._wrap_email_html(
                "👋 Neue Freundschaftsanfrage",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> hat dir eine Freundschaftsanfrage gesendet!</p>
                <a href='{profile_link}' class='button'>Profil ansehen</a>"""
            )

        elif notification_type == "friend_request_accepted":
            profile_link = f"{site_url}/profile/{actor_username}"
            subject = f"🎉 {actor_username} hat deine Freundschaftsanfrage angenommen!"
            text = f"""
Hallo {to_username},

{actor_username} hat deine Freundschaftsanfrage angenommen! Ihr seid jetzt Freunde.

Sieh dir das Profil an: {profile_link}

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            html = cls._wrap_email_html(
                "🎉 Freundschaftsanfrage angenommen",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> hat deine Freundschaftsanfrage angenommen! Ihr seid jetzt Freunde.</p>
                <a href='{profile_link}' class='button'>Profil ansehen</a>"""
            )

        elif notification_type == "welcome":
            subject = f"🎉 Willkommen bei SafeSpace, {to_username}!"
            text = f"""
Hallo {to_username},

Willkommen bei SafeSpace! Wir freuen uns, dass du dabei bist.

Entdecke deine Timeline, finde Freunde und teile deine Gedanken.
SafeSpace ist dein Raum — sicher, respektvoll und einladend.

Starte jetzt: {site_url}

Viele Grüße,
Dein SafeSpace Team
            """.strip()

            html = cls._wrap_email_html(
                "🎉 Willkommen bei SafeSpace!",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p>Willkommen bei SafeSpace! Wir freuen uns, dass du dabei bist.</p>
                <p>Entdecke deine Timeline, finde Freunde und teile deine Gedanken.
                SafeSpace ist dein Raum &mdash; sicher, respektvoll und einladend.</p>
                <a href='{site_url}' class='button'>Jetzt loslegen</a>"""
            )

        else:
            subject = f"🔔 Neue Benachrichtigung von {actor_username}"
            text = f"Hallo {to_username},\n\nDu hast eine neue Benachrichtigung erhalten.\n\nViele Grüße,\nDein SafeSpace Team"
            html = cls._wrap_email_html(
                "🔔 Neue Benachrichtigung",
                f"<p>Hallo <strong>{to_username}</strong>,</p><p>Du hast eine neue Benachrichtigung erhalten.</p>"
            )

        return subject, html, text

    @classmethod
    def _wrap_email_html(cls, header_title: str, body_content: str) -> str:
        """Wraps email body content in the standard HTML template."""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #1877f2, #42b72a); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .notification {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .button {{ display: inline-block; padding: 12px 30px; background: #1877f2; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
        .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{header_title}</h1>
        </div>
        <div class="content">
            <div class="notification">
                {body_content}
            </div>
            <div class="footer">
                <p>Du erhältst diese E-Mail, weil du Benachrichtigungen aktiviert hast.</p>
                <p>&copy; 2024 SafeSpace - Dein sicheres Social Network</p>
            </div>
        </div>
    </div>
</body>
</html>
        """.strip()
