"""Birthday Notification Service - Prüft täglich um Mitternacht auf Geburtstage"""

import asyncio
from datetime import datetime, time, timedelta


async def send_birthday_notifications():
    """Sendet Geburtstags-Benachrichtigungen an alle Freunde des Geburtstagskinds"""
    from app.db.postgres import get_users_with_birthday_today, get_friends
    from app.db.notifications import create_notification

    birthday_users = await get_users_with_birthday_today()

    for birthday_user in birthday_users:
        birthday_uid = birthday_user["uid"]

        # Alle Freunde des Geburtstagskinds benachrichtigen
        friend_uids = await get_friends(birthday_uid)

        for friend_uid in friend_uids:
            try:
                await create_notification(
                    user_uid=friend_uid,
                    actor_uid=birthday_uid,
                    notification_type="birthday"
                )
            except Exception as e:
                print(f"Fehler beim Senden der Geburtstags-Benachrichtigung an {friend_uid}: {e}")

    if birthday_users:
        usernames = [u["username"] for u in birthday_users]
        print(f"🎂 Geburtstags-Benachrichtigungen gesendet für: {', '.join(usernames)}")


async def _run_birthday_scheduler():
    """Interner Scheduler, der täglich um Mitternacht läuft"""
    while True:
        now = datetime.now()
        # Nächste Mitternacht berechnen
        tomorrow = now.date() + timedelta(days=1)
        next_midnight = datetime.combine(tomorrow, time(0, 0, 0))
        seconds_until_midnight = (next_midnight - now).total_seconds()

        print(f"🎂 Birthday scheduler: nächste Prüfung in {seconds_until_midnight:.0f} Sekunden (um Mitternacht)")
        await asyncio.sleep(seconds_until_midnight)

        try:
            await send_birthday_notifications()
        except Exception as e:
            print(f"❌ Fehler im Birthday Scheduler: {e}")


def start_birthday_scheduler():
    """Startet den Birthday Scheduler als Background Task"""
    asyncio.create_task(_run_birthday_scheduler())
    print("✅ Birthday notification scheduler started")
