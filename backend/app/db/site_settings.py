"""Site Settings - Admin-konfigurierbare Einstellungen"""

from app.db.postgres import PostgresDB


async def init_site_settings_table():
    """Erstellt die site_settings Tabelle"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS site_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.commit()


async def get_site_setting(key: str, default: str = "") -> str:
    """Holt eine Einstellung"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT value FROM site_settings WHERE key = %s",
            (key,)
        )
        row = await result.fetchone()
        return row["value"] if row else default


async def set_site_setting(key: str, value: str) -> None:
    """Setzt eine Einstellung (Insert oder Update)"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            INSERT INTO site_settings (key, value, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        """, (key, value))
        await conn.commit()


async def get_all_site_settings() -> dict:
    """Holt alle Einstellungen als Dictionary"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute("SELECT key, value FROM site_settings")
        rows = await result.fetchall()
        return {row["key"]: row["value"] for row in rows}


async def get_site_url() -> str:
    """Holt die Site-URL Einstellung"""
    return await get_site_setting("site_url", "http://localhost:4200")


async def get_site_title() -> str:
    """Holt den Site-Titel"""
    return await get_site_setting("site_title", "SafeSpace")
