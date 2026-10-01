import os
from datetime import datetime, timezone

import aiosqlite

from app.config import get_settings


def get_db_path() -> str:
    settings = get_settings()
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    return os.path.join(settings.DATA_DIR, "app.db")


async def init_db() -> None:
    db_path = get_db_path()
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS pages (
                page_id TEXT PRIMARY KEY,
                install_id TEXT NOT NULL,
                url TEXT NOT NULL,
                title TEXT,
                content_hash TEXT NOT NULL,
                markdown TEXT NOT NULL,
                token_estimate INTEGER NOT NULL,
                mode TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_accessed TEXT NOT NULL
            )
            """
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_pages_install_id ON pages(install_id)"
        )
        await db.commit()


async def get_page(page_id: str) -> dict | None:
    db_path = get_db_path()
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM pages WHERE page_id = ?", (page_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None


async def upsert_page(
    page_id: str,
    install_id: str,
    url: str,
    title: str,
    content_hash: str,
    markdown: str,
    token_estimate: int,
    mode: str,
) -> None:
    db_path = get_db_path()
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            INSERT INTO pages (page_id, install_id, url, title, content_hash, markdown, token_estimate, mode, created_at, last_accessed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(page_id) DO UPDATE SET
                title = excluded.title,
                content_hash = excluded.content_hash,
                markdown = excluded.markdown,
                token_estimate = excluded.token_estimate,
                mode = excluded.mode,
                last_accessed = excluded.last_accessed
            """,
            (
                page_id,
                install_id,
                url,
                title,
                content_hash,
                markdown,
                token_estimate,
                mode,
                now,
                now,
            ),
        )
        await db.commit()


async def touch_page(page_id: str) -> None:
    db_path = get_db_path()
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "UPDATE pages SET last_accessed = ? WHERE page_id = ?", (now, page_id)
        )
        await db.commit()


async def delete_page_db(page_id: str) -> None:
    db_path = get_db_path()
    async with aiosqlite.connect(db_path) as db:
        await db.execute("DELETE FROM pages WHERE page_id = ?", (page_id,))
        await db.commit()
