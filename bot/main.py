"""Telegram-бот Aeris Weather Intelligence.

Онбординг с выбором языка, бесплатные функции (вход на сайт, погода сейчас) и
премиум с планировщиком рассылки три раза в день.

Запуск:  python -m bot.main   (из корня проекта)
         python bot/main.py   (тоже работает)
"""

from __future__ import annotations

import asyncio
import logging
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

if __package__ in (None, ""):  # запуск файлом, а не пакетом
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton,
    LabeledPrice, Message, PreCheckoutQuery, ReplyKeyboardMarkup, ReplyKeyboardRemove,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from bot.api import AerisApi, ApiError, City
from bot.config import Config, load_config
from bot.locales import LANGUAGES, SUPPORTED, t
from bot.payments import CryptoPay, PaymentError
from bot.storage import Storage
from bot.weather_text import describe, pick_outfit, snapshot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("aeris.bot")

TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")

config: Config
storage: Storage
api: AerisApi
crypto: CryptoPay
scheduler: AsyncIOScheduler


class Flow(StatesGroup):
    """Шаги, на которых бот ждёт от пользователя ввода."""

    weather_city = State()
    schedule_city = State()
    schedule_times = State()


# --------------------------------------------------------------------
#  Клавиатуры
# --------------------------------------------------------------------


def language_keyboard() -> InlineKeyboardMarkup:
    rows = []
    for i in range(0, len(LANGUAGES), 2):
        chunk = LANGUAGES[i : i + 2]
        rows.append(
            [
                InlineKeyboardButton(text=f"{flag} {label}", callback_data=f"lang:{code}")
                for code, label, flag in chunk
            ]
        )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def main_menu(lang: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=t(lang, "btn_free")), KeyboardButton(text=t(lang, "btn_premium"))],
            [KeyboardButton(text=t(lang, "btn_language"))],
        ],
        resize_keyboard=True,
    )


def free_menu(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=t(lang, "btn_login"), callback_data="free:login")],
            [InlineKeyboardButton(text=t(lang, "btn_weather_now"), callback_data="free:weather")],
        ]
    )


def location_keyboard(lang: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=t(lang, "btn_send_location"), request_location=True)],
            [KeyboardButton(text=t(lang, "btn_back"))],
        ],
        resize_keyboard=True,
    )


def premium_offer(lang: str) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=t(lang, "btn_pay_stars", stars=config.premium_stars),
                callback_data="pay:stars",
            )
        ]
    ]
    if crypto.enabled:
        rows.append(
            [
                InlineKeyboardButton(
                    text=t(lang, "btn_pay_crypto", usdt=config.premium_usdt),
                    callback_data="pay:crypto",
                )
            ]
        )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def premium_menu(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=t(lang, "btn_set_city"), callback_data="sched:city")],
            [InlineKeyboardButton(text=t(lang, "btn_set_times"), callback_data="sched:times")],
            [InlineKeyboardButton(text=t(lang, "btn_schedule_off"), callback_data="sched:off")],
        ]
    )


# --------------------------------------------------------------------
#  Формирование сводки
# --------------------------------------------------------------------


async def build_report(lang: str, city_name: str, lat: float, lon: float) -> str:
    bundle = await api.forecast(lat, lon)
    snap = snapshot(bundle)
    emoji, description = describe(snap.code)
    title, items, advice = pick_outfit(snap)

    header = t(lang, "weather_header", emoji=emoji, city=city_name)
    body = t(
        lang,
        "weather_body",
        temp=round(snap.temp),
        feels=round(snap.feels),
        description=description,
        wind=round(snap.wind),
        humidity=round(snap.humidity),
        pressure=round(snap.pressure),
        uv="—" if snap.uv is None else f"{snap.uv:.1f}",
        precip="—" if snap.precip_prob is None else round(snap.precip_prob),
    )

    lines = [f"<b>{header}</b>", "", body, "", f"<b>{t(lang, 'outfit_header')}</b> — {title}"]
    lines += [f"• {item}" for item in items]
    lines.append("")
    lines += [f"💡 {a}" for a in advice]

    fallback = bundle.get("fallback")
    if isinstance(fallback, dict) and fallback.get("distanceKm"):
        lines.append("")
        lines.append(f"ℹ️ Данные ближайшей станции, в {fallback['distanceKm']} км.")

    return "\n".join(lines)


async def resolve_city(query: str) -> tuple[City | None, list[City]]:
    """Возвращает точное совпадение и список подсказок."""
    found = await api.geocode(query)
    if not found:
        return None, []
    # Первый результат уже отсортирован по населению на сервере
    return found[0], found[1:4]


# --------------------------------------------------------------------
#  Хендлеры: онбординг и меню
# --------------------------------------------------------------------

dp = Dispatcher(storage=MemoryStorage())


@dp.message(CommandStart())
async def on_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    # Первый шаг онбординга — язык. Подсказку даём сразу на двух языках,
    # потому что предпочтений пользователя мы ещё не знаем.
    hint = message.from_user.language_code if message.from_user else None
    lang = hint if hint in SUPPORTED else "ru"
    storage.ensure(message.from_user.id, lang)
    await message.answer(t(lang, "choose_language"), reply_markup=language_keyboard())


@dp.callback_query(F.data.startswith("lang:"))
async def on_language(call: CallbackQuery, state: FSMContext) -> None:
    code = call.data.split(":", 1)[1]
    if code not in SUPPORTED:
        await call.answer()
        return

    storage.set_lang(call.from_user.id, code)
    await state.clear()
    await call.answer(t(code, "language_set"))
    await call.message.edit_text(t(code, "language_set"))
    await call.message.answer(t(code, "greeting"))
    await call.message.answer(t(code, "menu_hint"), reply_markup=main_menu(code))


@dp.message(Command("language"))
async def on_language_command(message: Message) -> None:
    user = storage.get(message.from_user.id)
    await message.answer(t(user.lang, "choose_language"), reply_markup=language_keyboard())


@dp.message(lambda m: m.text and m.text in {t(c, "btn_language") for c in SUPPORTED})
async def on_language_button(message: Message) -> None:
    user = storage.get(message.from_user.id)
    await message.answer(t(user.lang, "choose_language"), reply_markup=language_keyboard())


@dp.message(lambda m: m.text and m.text in {t(c, "btn_back") for c in SUPPORTED})
async def on_back(message: Message, state: FSMContext) -> None:
    await state.clear()
    user = storage.get(message.from_user.id)
    await message.answer(t(user.lang, "menu_hint"), reply_markup=main_menu(user.lang))


# --------------------------------------------------------------------
#  Бесплатные функции
# --------------------------------------------------------------------


@dp.message(lambda m: m.text and m.text in {t(c, "btn_free") for c in SUPPORTED})
async def on_free(message: Message) -> None:
    user = storage.get(message.from_user.id)
    await message.answer(t(user.lang, "free_title"), reply_markup=free_menu(user.lang))


@dp.callback_query(F.data == "free:login")
async def on_login_link(call: CallbackQuery) -> None:
    user = storage.get(call.from_user.id)
    await call.answer()
    try:
        data = await api.issue_login_link(
            {
                "id": call.from_user.id,
                "first_name": call.from_user.first_name,
                "last_name": call.from_user.last_name,
                "username": call.from_user.username,
            }
        )
        minutes = int(data.get("expiresInSec", 600)) // 60
        await call.message.answer(
            t(user.lang, "login_ready", minutes=minutes, url=data["url"]),
            disable_web_page_preview=True,
        )
    except ApiError as exc:
        log.warning("не удалось выдать ссылку входа: %s", exc)
        await call.message.answer(t(user.lang, "login_failed"))


@dp.callback_query(F.data == "free:weather")
async def on_weather_request(call: CallbackQuery, state: FSMContext) -> None:
    user = storage.get(call.from_user.id)
    await call.answer()
    await state.set_state(Flow.weather_city)
    await call.message.answer(t(user.lang, "ask_city"), reply_markup=location_keyboard(user.lang))


@dp.message(Flow.weather_city, F.location)
async def on_weather_location(message: Message, state: FSMContext) -> None:
    user = storage.get(message.from_user.id)
    await state.clear()
    lat, lon = message.location.latitude, message.location.longitude
    try:
        city = await api.reverse(lat, lon)
        report = await build_report(user.lang, city.name, lat, lon)
        await message.answer(report, reply_markup=main_menu(user.lang))
    except ApiError as exc:
        log.warning("геолокация: %s", exc)
        await message.answer(t(user.lang, "api_error"), reply_markup=main_menu(user.lang))


@dp.message(Flow.weather_city, F.text)
async def on_weather_city(message: Message, state: FSMContext) -> None:
    user = storage.get(message.from_user.id)
    query = message.text.strip()

    if query in {t(c, "btn_back") for c in SUPPORTED}:
        await state.clear()
        await message.answer(t(user.lang, "menu_hint"), reply_markup=main_menu(user.lang))
        return

    notice = await message.answer(t(user.lang, "searching"))
    try:
        best, suggestions = await resolve_city(query)
    except ApiError as exc:
        log.warning("поиск города: %s", exc)
        await notice.edit_text(t(user.lang, "api_error"))
        return

    if best is None:
        # Подсказок нет — просим уточнить, состояние не сбрасываем
        await notice.edit_text(t(user.lang, "city_not_found", query=query))
        return

    await state.clear()
    try:
        report = await build_report(user.lang, best.title, best.lat, best.lon)
    except ApiError as exc:
        log.warning("прогноз: %s", exc)
        await notice.edit_text(t(user.lang, "api_error"))
        return

    await notice.delete()
    await message.answer(report, reply_markup=main_menu(user.lang))

    if suggestions:
        alt = "\n".join(f"• {c.title}" for c in suggestions)
        await message.answer(f"{t(user.lang, 'city_suggestions')}\n{alt}")


# --------------------------------------------------------------------
#  Премиум и оплата
# --------------------------------------------------------------------


@dp.message(lambda m: m.text and m.text in {t(c, "btn_premium") for c in SUPPORTED})
async def on_premium(message: Message) -> None:
    user = storage.get(message.from_user.id)
    if user.is_premium:
        await message.answer(t(user.lang, "premium_active"), reply_markup=premium_menu(user.lang))
        return
    await message.answer(
        t(
            user.lang,
            "premium_pitch",
            stars=config.premium_stars,
            usdt=config.premium_usdt,
        ),
        reply_markup=premium_offer(user.lang),
    )


@dp.callback_query(F.data == "pay:stars")
async def on_pay_stars(call: CallbackQuery) -> None:
    user = storage.get(call.from_user.id)
    await call.answer()
    # Для Stars provider_token пустой, валюта XTR — так требует Telegram
    await call.message.answer_invoice(
        title=t(user.lang, "payment_title"),
        description=t(user.lang, "payment_description"),
        payload=f"premium:{call.from_user.id}",
        provider_token="",
        currency="XTR",
        prices=[LabeledPrice(label=t(user.lang, "payment_title"), amount=config.premium_stars)],
    )


@dp.pre_checkout_query()
async def on_pre_checkout(query: PreCheckoutQuery) -> None:
    await query.answer(ok=True)


@dp.message(F.successful_payment)
async def on_paid(message: Message) -> None:
    user = storage.get(message.from_user.id)
    storage.set_premium(message.from_user.id, True)
    storage.add_payment(
        message.from_user.id,
        "stars",
        str(message.successful_payment.total_amount),
        message.successful_payment.telegram_payment_charge_id,
    )
    await message.answer(t(user.lang, "payment_ok"), reply_markup=main_menu(user.lang))
    await message.answer(t(user.lang, "premium_active"), reply_markup=premium_menu(user.lang))


@dp.callback_query(F.data == "pay:crypto")
async def on_pay_crypto(call: CallbackQuery) -> None:
    user = storage.get(call.from_user.id)
    await call.answer()
    if not crypto.enabled:
        await call.message.answer(t(user.lang, "crypto_disabled"))
        return
    try:
        invoice = await crypto.create_invoice(
            config.premium_usdt, "USDT", f"premium:{call.from_user.id}"
        )
    except PaymentError as exc:
        log.warning("Crypto Pay: %s", exc)
        await call.message.answer(t(user.lang, "api_error"))
        return

    storage.add_payment(call.from_user.id, "crypto", invoice.amount, invoice.invoice_id)
    await call.message.answer(
        t(user.lang, "crypto_invoice", url=invoice.pay_url),
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text=t(user.lang, "crypto_check"), callback_data="pay:check")]
            ]
        ),
        disable_web_page_preview=True,
    )


@dp.callback_query(F.data == "pay:check")
async def on_check_crypto(call: CallbackQuery) -> None:
    user = storage.get(call.from_user.id)
    invoice_id = storage.pending_crypto_invoice(call.from_user.id)
    if not invoice_id:
        await call.answer(t(user.lang, "crypto_pending"), show_alert=True)
        return
    try:
        paid = await crypto.is_paid(invoice_id)
    except PaymentError as exc:
        log.warning("проверка счёта: %s", exc)
        await call.answer(t(user.lang, "api_error"), show_alert=True)
        return

    if not paid:
        await call.answer(t(user.lang, "crypto_pending"), show_alert=True)
        return

    storage.complete_payment(invoice_id)
    storage.set_premium(call.from_user.id, True)
    await call.answer()
    await call.message.answer(t(user.lang, "payment_ok"))
    await call.message.answer(t(user.lang, "premium_active"), reply_markup=premium_menu(user.lang))


# --------------------------------------------------------------------
#  Планировщик
# --------------------------------------------------------------------


@dp.callback_query(F.data.startswith("sched:"))
async def on_schedule(call: CallbackQuery, state: FSMContext) -> None:
    user = storage.get(call.from_user.id)
    action = call.data.split(":", 1)[1]
    await call.answer()

    if not user.is_premium:
        await call.message.answer(t(user.lang, "not_premium"))
        return

    if action == "city":
        await state.set_state(Flow.schedule_city)
        await call.message.answer(t(user.lang, "ask_city"), reply_markup=location_keyboard(user.lang))
    elif action == "times":
        if user.city_lat is None:
            await call.message.answer(t(user.lang, "need_city_first"))
            return
        await state.set_state(Flow.schedule_times)
        await call.message.answer(t(user.lang, "ask_times"), reply_markup=ReplyKeyboardRemove())
    elif action == "off":
        storage.set_schedule(call.from_user.id, False)
        reschedule_user(storage.get(call.from_user.id))
        await call.message.answer(t(user.lang, "schedule_off"), reply_markup=main_menu(user.lang))


@dp.message(Flow.schedule_city, F.location)
async def on_schedule_location(message: Message, state: FSMContext) -> None:
    user = storage.get(message.from_user.id)
    lat, lon = message.location.latitude, message.location.longitude
    try:
        city = await api.reverse(lat, lon)
    except ApiError:
        await message.answer(t(user.lang, "api_error"))
        return
    storage.set_city(message.from_user.id, city.name, lat, lon, None)
    await state.clear()
    await message.answer(
        t(user.lang, "schedule_city_saved", city=city.name), reply_markup=main_menu(user.lang)
    )
    await message.answer(t(user.lang, "premium_active"), reply_markup=premium_menu(user.lang))


@dp.message(Flow.schedule_city, F.text)
async def on_schedule_city(message: Message, state: FSMContext) -> None:
    user = storage.get(message.from_user.id)
    query = message.text.strip()
    try:
        best, suggestions = await resolve_city(query)
    except ApiError:
        await message.answer(t(user.lang, "api_error"))
        return

    if best is None:
        await message.answer(t(user.lang, "city_not_found", query=query))
        return

    storage.set_city(message.from_user.id, best.title, best.lat, best.lon, best.timezone)
    await state.clear()
    await message.answer(
        t(user.lang, "schedule_city_saved", city=best.title), reply_markup=main_menu(user.lang)
    )
    if suggestions:
        alt = "\n".join(f"• {c.title}" for c in suggestions)
        await message.answer(f"{t(user.lang, 'city_suggestions')}\n{alt}")
    await message.answer(t(user.lang, "premium_active"), reply_markup=premium_menu(user.lang))


@dp.message(Flow.schedule_times, F.text)
async def on_schedule_times(message: Message, state: FSMContext) -> None:
    user = storage.get(message.from_user.id)
    parts = [p.strip() for p in re.split(r"[,\s]+", message.text.strip()) if p.strip()]
    times = [p for p in parts if TIME_RE.match(p)]

    if not times or len(times) != len(parts):
        await message.answer(t(user.lang, "times_invalid"))
        return

    storage.set_times(message.from_user.id, times[:3])
    await state.clear()
    reschedule_user(storage.get(message.from_user.id))
    await message.answer(
        t(user.lang, "times_saved", times=", ".join(times[:3])), reply_markup=main_menu(user.lang)
    )


def user_timezone(tz_name: str | None) -> ZoneInfo:
    """Часовой пояс города; при неизвестном имени — UTC, чтобы задача не пропала."""
    if not tz_name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


async def send_digest(telegram_id: int) -> None:
    user = storage.get(telegram_id)
    if not (user.is_premium and user.schedule_on and user.city_lat is not None):
        return
    try:
        report = await build_report(
            user.lang, user.city_name or "—", user.city_lat, user.city_lon or 0
        )
    except ApiError as exc:
        log.warning("рассылка для %s: %s", telegram_id, exc)
        return

    bot: Bot = dp["bot"]
    try:
        await bot.send_message(telegram_id, f"<b>{t(user.lang, 'daily_header')}</b>\n\n{report}")
    except Exception as exc:  # пользователь мог заблокировать бота
        log.info("не доставлено %s: %s", telegram_id, exc)
        storage.set_schedule(telegram_id, False)


def reschedule_user(user) -> None:
    """Пересобирает задачи одного пользователя: снимает старые, ставит новые."""
    prefix = f"digest:{user.telegram_id}:"
    for job in scheduler.get_jobs():
        if job.id.startswith(prefix):
            job.remove()

    if not (user.is_premium and user.schedule_on and user.city_lat is not None):
        return

    tz = user_timezone(user.timezone)
    for slot in user.times[:3]:
        hour, minute = slot.split(":")
        scheduler.add_job(
            send_digest,
            "cron",
            id=f"{prefix}{slot}",
            hour=int(hour),
            minute=int(minute),
            timezone=tz,
            args=[user.telegram_id],
            replace_existing=True,
            misfire_grace_time=900,
        )


def restore_schedules() -> None:
    users = storage.scheduled_users()
    for user in users:
        reschedule_user(user)
    log.info("восстановлено расписаний: %d", len(users))


# --------------------------------------------------------------------
#  Прочее
# --------------------------------------------------------------------


@dp.message(Command("help"))
async def on_help(message: Message) -> None:
    user = storage.get(message.from_user.id)
    await message.answer(t(user.lang, "menu_hint"), reply_markup=main_menu(user.lang))


@dp.message(F.text)
async def on_any_text(message: Message) -> None:
    """Свободный текст трактуем как название города — самый частый сценарий."""
    user = storage.get(message.from_user.id)
    query = message.text.strip()
    if len(query) < 2:
        await message.answer(t(user.lang, "menu_hint"), reply_markup=main_menu(user.lang))
        return

    try:
        best, _ = await resolve_city(query)
    except ApiError:
        await message.answer(t(user.lang, "api_error"))
        return

    if best is None:
        await message.answer(t(user.lang, "city_not_found", query=query))
        return

    try:
        report = await build_report(user.lang, best.title, best.lat, best.lon)
    except ApiError:
        await message.answer(t(user.lang, "api_error"))
        return
    await message.answer(report, reply_markup=main_menu(user.lang))


async def main() -> None:
    global config, storage, api, crypto, scheduler

    config = load_config()
    storage = Storage(config.db_path)
    api = AerisApi(config.api_base, config.bot_api_secret)
    crypto = CryptoPay(config.crypto_pay_token, config.crypto_pay_api)
    scheduler = AsyncIOScheduler()

    bot = Bot(
        token=config.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp["bot"] = bot

    scheduler.start()
    restore_schedules()

    me = await bot.get_me()
    log.info("бот @%s запущен, API: %s", me.username, config.api_base)

    try:
        await dp.start_polling(bot)
    finally:
        scheduler.shutdown(wait=False)
        await api.close()
        await crypto.close()
        await bot.session.close()
        storage.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log.info("остановлено")
