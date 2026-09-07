"""Хранилище состояния бота (SQLite).

Отдельная база от сайта: у бота своя модель — язык, премиум, расписание.
Связь с веб-аккаунтом идёт через telegram_id, который сайт кладёт в users.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BotUser:
    telegram_id: int
    lang: str
    is_premium: bool
    city_name: str | None
    city_lat: float | None
    city_lon: float | None
    timezone: str | None
    times: list[str]
    schedule_on: bool


DEFAULT_TIMES = ["07:30", "13:00", "20:00"]


class Storage:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._init()

    def _init(self) -> None:
        self._db.executescript(
            """
            PRAGMA journal_mode = WAL;
            PRAGMA busy_timeout = 5000;

            CREATE TABLE IF NOT EXISTS users (
                telegram_id INTEGER PRIMARY KEY,
                lang        TEXT    NOT NULL DEFAULT 'ru',
                is_premium  INTEGER NOT NULL DEFAULT 0,
                city_name   TEXT,
                city_lat    REAL,
                city_lon    REAL,
                timezone    TEXT,
                times       TEXT    NOT NULL DEFAULT '[]',
                schedule_on INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS payments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER NOT NULL,
                provider    TEXT    NOT NULL,
                amount      TEXT    NOT NULL,
                external_id TEXT,
                status      TEXT    NOT NULL DEFAULT 'pending',
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        self._db.commit()

    # ---------- пользователи ----------

    def ensure(self, telegram_id: int, lang: str = "ru") -> BotUser:
        self._db.execute(
            "INSERT OR IGNORE INTO users (telegram_id, lang, times) VALUES (?, ?, ?)",
            (telegram_id, lang, json.dumps(DEFAULT_TIMES)),
        )
        self._db.commit()
        return self.get(telegram_id)

    def get(self, telegram_id: int) -> BotUser:
        row = self._db.execute(
            "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
        if row is None:
            return self.ensure(telegram_id)
        try:
            times = json.loads(row["times"]) or DEFAULT_TIMES
        except json.JSONDecodeError:
            times = DEFAULT_TIMES
        return BotUser(
            telegram_id=row["telegram_id"],
            lang=row["lang"],
            is_premium=bool(row["is_premium"]),
            city_name=row["city_name"],
            city_lat=row["city_lat"],
            city_lon=row["city_lon"],
            timezone=row["timezone"],
            times=times,
            schedule_on=bool(row["schedule_on"]),
        )

    def set_lang(self, telegram_id: int, lang: str) -> None:
        self.ensure(telegram_id, lang)
        self._db.execute("UPDATE users SET lang = ? WHERE telegram_id = ?", (lang, telegram_id))
        self._db.commit()

    def set_premium(self, telegram_id: int, value: bool) -> None:
        self._db.execute(
            "UPDATE users SET is_premium = ? WHERE telegram_id = ?", (int(value), telegram_id)
        )
        self._db.commit()

    def set_city(
        self, telegram_id: int, name: str, lat: float, lon: float, timezone: str | None
    ) -> None:
        self._db.execute(
            "UPDATE users SET city_name = ?, city_lat = ?, city_lon = ?, timezone = ? "
            "WHERE telegram_id = ?",
            (name, lat, lon, timezone, telegram_id),
        )
        self._db.commit()

    def set_times(self, telegram_id: int, times: list[str]) -> None:
        self._db.execute(
            "UPDATE users SET times = ?, schedule_on = 1 WHERE telegram_id = ?",
            (json.dumps(times), telegram_id),
        )
        self._db.commit()

    def set_schedule(self, telegram_id: int, on: bool) -> None:
        self._db.execute(
            "UPDATE users SET schedule_on = ? WHERE telegram_id = ?", (int(on), telegram_id)
        )
        self._db.commit()

    def scheduled_users(self) -> list[BotUser]:
        rows = self._db.execute(
            "SELECT telegram_id FROM users WHERE schedule_on = 1 AND is_premium = 1 "
            "AND city_lat IS NOT NULL"
        ).fetchall()
        return [self.get(r["telegram_id"]) for r in rows]

    # ---------- платежи ----------

    def add_payment(
        self, telegram_id: int, provider: str, amount: str, external_id: str | None
    ) -> int:
        cur = self._db.execute(
            "INSERT INTO payments (telegram_id, provider, amount, external_id) VALUES (?, ?, ?, ?)",
            (telegram_id, provider, amount, external_id),
        )
        self._db.commit()
        return int(cur.lastrowid or 0)

    def complete_payment(self, external_id: str) -> None:
        self._db.execute(
            "UPDATE payments SET status = 'paid' WHERE external_id = ?", (external_id,)
        )
        self._db.commit()

    def pending_crypto_invoice(self, telegram_id: int) -> str | None:
        row = self._db.execute(
            "SELECT external_id FROM payments WHERE telegram_id = ? AND provider = 'crypto' "
            "AND status = 'pending' ORDER BY id DESC LIMIT 1",
            (telegram_id,),
        ).fetchone()
        return row["external_id"] if row else None

    def close(self) -> None:
        self._db.close()
