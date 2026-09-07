"""Клиент к API Aeris.

Бот не считает погоду сам: он ходит в то же API, что и сайт. Так подбор
одежды и прогноз всегда совпадают между веб-интерфейсом и ботом.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import aiohttp

TIMEOUT = aiohttp.ClientTimeout(total=20)


class ApiError(Exception):
    """Ошибка обращения к API. Наверх поднимается как «сервис недоступен»."""


@dataclass
class City:
    name: str
    country: str | None
    admin1: str | None
    lat: float
    lon: float
    timezone: str | None
    population: int | None = None

    @property
    def title(self) -> str:
        parts = [self.name]
        if self.admin1 and self.admin1 != self.name:
            parts.append(self.admin1)
        if self.country:
            parts.append(self.country)
        return ", ".join(parts)


class AerisApi:
    def __init__(self, base: str, bot_secret: str = "") -> None:
        self._base = base.rstrip("/")
        self._secret = bot_secret
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=TIMEOUT)
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def _request(
        self, method: str, path: str, **kwargs: Any
    ) -> dict[str, Any] | list[Any]:
        session = await self._get_session()
        url = f"{self._base}{path}"
        try:
            async with session.request(method, url, **kwargs) as resp:
                body = await resp.json(content_type=None)
                if resp.status >= 400:
                    message = ""
                    if isinstance(body, dict):
                        message = str(body.get("error", ""))
                    raise ApiError(message or f"HTTP {resp.status}")
                return body
        except aiohttp.ClientError as exc:
            raise ApiError(str(exc)) from exc
        except TimeoutError as exc:
            raise ApiError("таймаут запроса") from exc

    # ---------- погода ----------

    async def geocode(self, query: str) -> list[City]:
        data = await self._request("GET", "/weather/geocode", params={"q": query})
        results = data.get("results", []) if isinstance(data, dict) else []
        return [
            City(
                name=r["name"],
                country=r.get("country"),
                admin1=r.get("admin1"),
                lat=float(r["lat"]),
                lon=float(r["lon"]),
                timezone=r.get("timezone"),
                population=r.get("population"),
            )
            for r in results
        ]

    async def reverse(self, lat: float, lon: float) -> City:
        data = await self._request("GET", "/weather/reverse", params={"lat": lat, "lon": lon})
        assert isinstance(data, dict)
        return City(
            name=data.get("name") or f"{lat:.2f}, {lon:.2f}",
            country=data.get("country"),
            admin1=data.get("admin1"),
            lat=float(data.get("lat", lat)),
            lon=float(data.get("lon", lon)),
            timezone=None,
        )

    async def forecast(self, lat: float, lon: float, days: int = 3) -> dict[str, Any]:
        data = await self._request(
            "GET",
            "/weather/forecast",
            params={"lat": lat, "lon": lon, "units": "metric", "days": days},
        )
        assert isinstance(data, dict)
        return data

    # ---------- вход на сайте ----------

    async def issue_login_link(self, profile: dict[str, Any]) -> dict[str, Any]:
        """Просит сервер выдать одноразовую ссылку входа для этого Telegram-профиля."""
        if not self._secret:
            raise ApiError("BOT_API_SECRET не задан")
        data = await self._request(
            "POST",
            "/auth/telegram/issue",
            json=profile,
            headers={"x-bot-secret": self._secret},
        )
        assert isinstance(data, dict)
        return data
