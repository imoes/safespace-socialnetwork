import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

from app.config import settings


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
        birthday_age: Optional[int] = None
    ) -> bool:
        """
        Sendet eine Benachrichtigungs-E-Mail.

        Args:
            to_email: Empfänger E-Mail
            to_username: Empfänger Username
            actor_username: Username des Actors
            notification_type: Art der Benachrichtigung
            post_id: Post ID (optional)
            post_author_uid: Post Author UID (optional)
            comment_id: Comment ID (optional)
            post_content: Inhalt des betroffenen Posts (optional)
            comment_content: Inhalt des Kommentars (optional)
            birthday_age: Alter des Geburtstagskinds (optional)
        """
        subject, html_content, text_content = cls._build_notification_email(
            to_username, actor_username, notification_type, post_id,
            comment_id, post_content, comment_content, birthday_age
        )

        return await cls.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )

    @classmethod
    def _build_notification_email(
        cls,
        to_username: str,
        actor_username: str,
        notification_type: str,
        post_id: Optional[int],
        comment_id: Optional[int],
        post_content: Optional[str] = None,
        comment_content: Optional[str] = None,
        birthday_age: Optional[int] = None
    ) -> tuple[str, str, str]:
        """
        Erstellt Betreff und Inhalt für Benachrichtigungs-E-Mails.

        Returns:
            (subject, html_content, text_content)
        """
        post_link = f"http://localhost:3000/my-posts?highlight={post_id}" if post_id else ""

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
Dein SocialNet Team
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
Dein SocialNet Team
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
Dein SocialNet Team
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

Gratuliere jetzt auf SocialNet!

Viele Grüße,
Dein SocialNet Team
            """.strip()

            age_html = f"<p style='font-size: 24px; text-align: center; margin: 16px 0;'>🎉 <strong>{birthday_age} Jahre</strong> 🎉</p>" if birthday_age else ""
            html = cls._wrap_email_html(
                "🎂 Geburtstag!",
                f"""<p>Hallo <strong>{to_username}</strong>,</p>
                <p><strong>{actor_username}</strong> hat heute Geburtstag!</p>
                {age_html}
                <p>Gratuliere jetzt auf SocialNet!</p>"""
            )

        else:
            subject = f"🔔 Neue Benachrichtigung von {actor_username}"
            text = f"Hallo {to_username},\n\nDu hast eine neue Benachrichtigung erhalten.\n\nViele Grüße,\nDein SocialNet Team"
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
                <p>&copy; 2024 SocialNet - Dein sicherer Social Space</p>
            </div>
        </div>
    </div>
</body>
</html>
        """.strip()
