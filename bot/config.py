"""Конфигурация бота.

Все секреты берутся из окружения. Файл .env лежит рядом и в git не попадает —
в репозитории есть только .env.example с описанием переменных.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "server" / ".env")


@dataclass(frozen=True)
class Config:
    bot_token: str
    api_base: str
    bot_api_secret: str
    web_origin: str
    crypto_pay_token: str
    crypto_pay_api: str
    premium_stars: int
    premium_usdt: float
    db_path: Path

    @property
    def crypto_pay_enabled(self) -> bool:
        return bool(self.crypto_pay_token)


def load_config() -> Config:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN не задан. Скопируйте bot/.env.example в bot/.env "
            "и впишите токен, выданный @BotFather."
        )

    return Config(
        bot_token=token,
        # Бот ходит в то же API, что и сайт: вся погодная логика живёт там,
        # дублировать её на Python не нужно.
        api_base=os.getenv("AERIS_API_BASE", "http://localhost:4000/api").rstrip("/"),
        bot_api_secret=os.getenv("BOT_API_SECRET", "").strip(),
        web_origin=os.getenv("WEB_ORIGIN", "http://localhost:5173").rstrip("/"),
        crypto_pay_token=os.getenv("CRYPTO_PAY_TOKEN", "").strip(),
        crypto_pay_api=os.getenv("CRYPTO_PAY_API", "https://pay.crypt.bot/api").rstrip("/"),
        premium_stars=int(os.getenv("PREMIUM_PRICE_STARS", "150")),
        premium_usdt=float(os.getenv("PREMIUM_PRICE_USDT", "2.5")),
        db_path=Path(os.getenv("BOT_DB_PATH", BASE_DIR / "data" / "bot.db")),
    )
