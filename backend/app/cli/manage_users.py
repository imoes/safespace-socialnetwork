#!/usr/bin/env python3
"""
Admin/Moderator Management CLI

Verwendung:
    # Admin erstellen
    python -m app.cli.manage_users create-admin username email password
    
    # Moderator erstellen
    python -m app.cli.manage_users create-moderator username email password
    
    # Existierenden User zum Moderator machen
    python -m app.cli.manage_users promote username moderator
    
    # Alle Moderatoren/Admins auflisten
    python -m app.cli.manage_users list-staff
"""

import asyncio
import sys
from getpass import getpass

# Für direkten Import
sys.path.insert(0, '/app')

from app.db.postgres import PostgresDB, create_user, get_user_by_username
from app.services.auth_service import get_password_hash


async def create_staff_user(username: str, email: str, password: str, role: str):
    """Erstellt einen neuen User mit Staff-Rolle"""
    await PostgresDB.init_pool()
    
    try:
        # Prüfen ob User existiert
        existing = await get_user_by_username(username)
        if existing:
            print(f"❌ User '{username}' existiert bereits!")
            return False
        
        # User erstellen
        password_hash = get_password_hash(password)
        user = await create_user(username, email, password_hash)
        
        # Rolle setzen
        async with PostgresDB.connection() as conn:
            await conn.execute(
                "UPDATE users SET role = %s WHERE uid = %s",
                (role, user["uid"])
            )
            await conn.commit()
        
        print(f"✅ {role.capitalize()} '{username}' erstellt (UID: {user['uid']})")
        return True
        
    finally:
        await PostgresDB.close_pool()


async def promote_user(username: str, role: str):
    """Befördert existierenden User zu Moderator/Admin"""
    await PostgresDB.init_pool()
    
    try:
        user = await get_user_by_username(username)
        if not user:
            print(f"❌ User '{username}' nicht gefunden!")
            return False
        
        async with PostgresDB.connection() as conn:
            await conn.execute(
                "UPDATE users SET role = %s WHERE uid = %s",
                (role, user["uid"])
            )
            await conn.commit()
        
        print(f"✅ User '{username}' ist jetzt {role}")
        return True
        
    finally:
        await PostgresDB.close_pool()


async def demote_user(username: str):
    """Degradiert User zurück zu normalem User"""
    await PostgresDB.init_pool()
    
    try:
        user = await get_user_by_username(username)
        if not user:
            print(f"❌ User '{username}' nicht gefunden!")
            return False
        
        async with PostgresDB.connection() as conn:
            await conn.execute(
                "UPDATE users SET role = 'user' WHERE uid = %s",
                (user["uid"],)
            )
            await conn.commit()
        
        print(f"✅ User '{username}' ist jetzt normaler User")
        return True
        
    finally:
        await PostgresDB.close_pool()


async def list_staff():
    """Listet alle Moderatoren und Admins"""
    await PostgresDB.init_pool()
    
    try:
        async with PostgresDB.connection() as conn:
            result = await conn.execute(
                """SELECT uid, username, email, role, created_at 
                   FROM users WHERE role IN ('moderator', 'admin')
                   ORDER BY role DESC, username"""
            )
            users = await result.fetchall()
        
        if not users:
            print("Keine Moderatoren oder Admins gefunden.")
            print("\nErstelle einen Admin mit:")
            print("  python -m app.cli.manage_users create-admin admin admin@example.com")
            return
        
        print("\n👥 Staff-Mitglieder:")
        print("-" * 60)
        for user in users:
            role_emoji = "👑" if user["role"] == "admin" else "🛡️"
            print(f"  {role_emoji} {user['username']:20} {user['role']:12} {user['email']}")
        print("-" * 60)
        print(f"Gesamt: {len(users)}")
        
    finally:
        await PostgresDB.close_pool()


async def interactive_create():
    """Interaktive Erstellung eines Staff-Users"""
    print("\n🛡️  Staff-User erstellen")
    print("-" * 40)
    
    role = input("Rolle (admin/moderator): ").strip().lower()
    if role not in ("admin", "moderator"):
        print("❌ Ungültige Rolle!")
        return
    
    username = input("Username: ").strip()
    email = input("Email: ").strip()
    password = getpass("Passwort: ")
    password_confirm = getpass("Passwort bestätigen: ")
    
    if password != password_confirm:
        print("❌ Passwörter stimmen nicht überein!")
        return
    
    if len(password) < 6:
        print("❌ Passwort muss mindestens 6 Zeichen haben!")
        return
    
    await create_staff_user(username, email, password, role)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1]
    
    if command == "create-admin":
        if len(sys.argv) < 4:
            print("Usage: create-admin <username> <email> [password]")
            return
        username, email = sys.argv[2], sys.argv[3]
        password = sys.argv[4] if len(sys.argv) > 4 else getpass("Passwort: ")
        asyncio.run(create_staff_user(username, email, password, "admin"))
    
    elif command == "create-moderator":
        if len(sys.argv) < 4:
            print("Usage: create-moderator <username> <email> [password]")
            return
        username, email = sys.argv[2], sys.argv[3]
        password = sys.argv[4] if len(sys.argv) > 4 else getpass("Passwort: ")
        asyncio.run(create_staff_user(username, email, password, "moderator"))
    
    elif command == "promote":
        if len(sys.argv) < 4:
            print("Usage: promote <username> <role>")
            return
        username, role = sys.argv[2], sys.argv[3]
        if role not in ("moderator", "admin"):
            print("Role must be 'moderator' or 'admin'")
            return
        asyncio.run(promote_user(username, role))
    
    elif command == "demote":
        if len(sys.argv) < 3:
            print("Usage: demote <username>")
            return
        asyncio.run(demote_user(sys.argv[2]))
    
    elif command == "list-staff":
        asyncio.run(list_staff())
    
    elif command == "interactive":
        asyncio.run(interactive_create())
    
    else:
        print(f"Unbekannter Befehl: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
