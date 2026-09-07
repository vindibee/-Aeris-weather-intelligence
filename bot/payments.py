"""Платежи: Telegram Stars и Crypto Pay (USDT / TON).

Stars проводятся штатным механизмом Telegram: инвойс с пустым provider_token и
валютой XTR. Crypto Pay — внешний API @CryptoBot, работает по своему токену.
Оба способа необязательны: если ключа нет, кнопка просто не показывается.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import aiohttp

TIMEOUT = aiohttp.ClientTimeout(total=20)


class PaymentError(Exception):
    pass


@dataclass
class Invoice:
    invoice_id: str
    pay_url: str
    amount: str
    asset: str


class CryptoPay:
    """Минимальный клиент Crypto Pay: создание счёта и проверка статуса."""

    def __init__(self, token: str, api_base: str) -> None:
        self._token = token
        self._base = api_base.rstrip("/")
        self._session: aiohttp.ClientSession | None = None

    @property
    def enabled(self) -> bool:
        return bool(self._token)

    async def _session_get(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=TIMEOUT)
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def _call(self, method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.enabled:
            raise PaymentError("CRYPTO_PAY_TOKEN не задан")
        session = await self._session_get()
        try:
            async with session.post(
                f"{self._base}/{method}",
                json=payload or {},
                headers={"Crypto-Pay-API-Token": self._token},
            ) as resp:
                data = await resp.json(content_type=None)
        except aiohttp.ClientError as exc:
            raise PaymentError(str(exc)) from exc

        if not isinstance(data, dict) or not data.get("ok"):
            raise PaymentError(str(data.get("error") if isinstance(data, dict) else data))
        return data.get("result", {})

    async def create_invoice(self, amount: float, asset: str, payload: str) -> Invoice:
        result = await self._call(
            "createInvoice",
            {
                "asset": asset,
                "amount": f"{amount:.2f}",
                "description": "Aeris Premium",
                "payload": payload,
                "allow_anonymous": False,
                "expires_in": 3600,
            },
        )
        return Invoice(
            invoice_id=str(result.get("invoice_id")),
            pay_url=str(result.get("bot_invoice_url") or result.get("pay_url") or ""),
            amount=str(result.get("amount")),
            asset=str(result.get("asset")),
        )

    async def is_paid(self, invoice_id: str) -> bool:
        result = await self._call("getInvoices", {"invoice_ids": invoice_id})
        items = result.get("items") if isinstance(result, dict) else None
        if not items:
            return False
        return str(items[0].get("status")) == "paid"
