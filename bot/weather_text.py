"""Форматирование сводки и подбор одежды для бота.

Правила подбора повторяют веб-версию (web/src/lib/outfit.ts): те же пороги по
ощущаемой температуре, ветру, UV и осадкам. Дублирование сознательное — бот
работает на Python и не может импортировать TypeScript-модуль напрямую.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

WMO = {
    0: ("☀️", "Ясно"),
    1: ("🌤", "Малооблачно"),
    2: ("⛅️", "Переменная облачность"),
    3: ("☁️", "Пасмурно"),
    45: ("🌫", "Туман"),
    48: ("🌫", "Изморозь"),
    51: ("🌦", "Слабая морось"),
    53: ("🌦", "Морось"),
    55: ("🌧", "Сильная морось"),
    61: ("🌦", "Небольшой дождь"),
    63: ("🌧", "Дождь"),
    65: ("🌧", "Сильный дождь"),
    66: ("🌧", "Ледяной дождь"),
    67: ("🌧", "Сильный ледяной дождь"),
    71: ("🌨", "Небольшой снег"),
    73: ("🌨", "Снег"),
    75: ("❄️", "Сильный снег"),
    77: ("🌨", "Снежные зёрна"),
    80: ("🌦", "Ливень"),
    81: ("🌧", "Сильный ливень"),
    82: ("⛈", "Очень сильный ливень"),
    85: ("🌨", "Снежный ливень"),
    86: ("❄️", "Сильный снежный ливень"),
    95: ("⛈", "Гроза"),
    96: ("⛈", "Гроза с градом"),
    99: ("⛈", "Сильная гроза с градом"),
}


def describe(code: int | None) -> tuple[str, str]:
    return WMO.get(int(code or 0), ("🌡", "—"))


@dataclass
class Snapshot:
    temp: float
    feels: float
    wind: float
    humidity: float
    pressure: float
    uv: float | None
    precip_prob: float | None
    precip_mm: float
    code: int
    is_day: bool


def _hour_index(times: list[str]) -> int:
    """Индекс часа, ближайшего к текущему моменту."""
    if not times:
        return -1
    now = datetime.now(timezone.utc).timestamp()
    best, best_diff = 0, float("inf")
    for i, iso in enumerate(times):
        try:
            ts = datetime.fromisoformat(iso).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
        diff = abs(ts - now)
        if diff < best_diff:
            best, best_diff = i, diff
    return best


def snapshot(bundle: dict[str, Any]) -> Snapshot:
    forecast = bundle.get("forecast", {})
    current = forecast.get("current", {}) or {}
    hourly = forecast.get("hourly", {}) or {}
    idx = _hour_index(hourly.get("time", []) or [])

    def hour(key: str) -> float | None:
        series = hourly.get(key) or []
        if idx < 0 or idx >= len(series):
            return None
        value = series[idx]
        return float(value) if value is not None else None

    return Snapshot(
        temp=float(current.get("temperature_2m") or 0),
        feels=float(current.get("apparent_temperature") or current.get("temperature_2m") or 0),
        wind=float(current.get("wind_speed_10m") or 0),
        humidity=float(current.get("relative_humidity_2m") or 0),
        pressure=float(current.get("pressure_msl") or 0),
        uv=hour("uv_index"),
        precip_prob=hour("precipitation_probability"),
        precip_mm=float(current.get("precipitation") or 0),
        code=int(current.get("weather_code") or 0),
        is_day=bool(current.get("is_day", 1)),
    )


# --------------------------------------------------------------------
#  Подбор одежды
# --------------------------------------------------------------------

_BANDS: list[tuple[float, str, list[str]]] = [
    (-20, "Экстремальный мороз", ["🧥 Пуховик-парка", "🧣 Термобельё и флис",
                                  "👖 Утеплённые брюки", "🧢 Шапка и балаклава",
                                  "🥾 Зимние ботинки", "🧤 Варежки"]),
    (-10, "Сильный мороз", ["🧥 Пуховик", "🧶 Свитер или флис", "👖 Тёплые джинсы",
                            "🧢 Тёплая шапка", "🥾 Зимние ботинки", "🧤 Перчатки", "🧣 Шарф"]),
    (0, "Мороз", ["🧥 Зимняя куртка", "🧶 Свитер", "👖 Джинсы", "🧢 Шапка",
                  "🥾 Утеплённые ботинки", "🧤 Перчатки"]),
    (7, "Холодно", ["🧥 Пальто или тёплая куртка", "🧶 Свитер", "👖 Джинсы",
                    "🧢 Лёгкая шапка", "👞 Закрытые ботинки"]),
    (14, "Прохладно", ["🧥 Ветровка или лёгкая куртка", "👕 Лонгслив", "👖 Джинсы", "👟 Кроссовки"]),
    (20, "Умеренно", ["👔 Толстовка или рубашка", "👖 Джинсы", "👟 Кроссовки"]),
    (26, "Тепло", ["👕 Футболка", "👖 Лёгкие брюки", "👟 Кеды"]),
    (999, "Жарко", ["👕 Лёгкая футболка", "🩳 Шорты", "🩴 Сандалии", "🧢 Кепка"]),
]


def pick_outfit(s: Snapshot) -> tuple[str, list[str], list[str]]:
    """Возвращает (название режима, список вещей, список советов)."""
    feels = s.feels
    title, items = next(
        ((name, list(things)) for limit, name, things in _BANDS if feels < limit),
        (_BANDS[-1][1], list(_BANDS[-1][2])),
    )

    advice: list[str] = []
    prob = s.precip_prob or 0
    uv = s.uv or 0

    if s.wind >= 50:
        advice.append(f"Ветер {round(s.wind)} км/ч — зонт вывернет, нужен дождевик с капюшоном.")
    elif s.wind >= 30:
        advice.append(f"Ветрено ({round(s.wind)} км/ч) — нужен ветрозащитный верхний слой.")

    rainy = prob >= 40 or s.precip_mm > 0.1
    if rainy:
        if s.temp <= 1:
            items.append("🥾 Обувь с рифлёной подошвой")
            advice.append("Осадки при отрицательной температуре — под ногами будет скользко.")
        elif s.wind < 50:
            items.append("☂️ Зонт")
        if prob >= 60 and s.temp > 1:
            items.append("🧥 Непромокаемая куртка")
            advice.append("Замшу и текстильные кроссовки лучше оставить дома.")

    if s.is_day and uv >= 3:
        items.append("🕶️ Солнцезащитные очки")
    if s.is_day and uv >= 6:
        advice.append(f"UV-индекс {uv:.0f} — нанесите SPF за 20 минут до выхода.")
    if s.is_day and uv >= 8:
        advice.append("С 11 до 16 часов лучше держаться тени.")

    if feels <= -25:
        advice.append("Открытая кожа обмораживается за 10–15 минут.")
    if feels >= 32:
        advice.append("Пейте воду каждые 20–30 минут и избегайте нагрузок в полдень.")

    if not advice:
        advice.append("Погода без сюрпризов — берите то, что удобно.")

    return title, items, advice
