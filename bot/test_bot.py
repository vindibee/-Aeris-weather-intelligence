"""Тесты чистой логики бота.

Проверяют то, что не требует сети и Telegram: полноту словарей, подбор одежды
и разбор пользовательского ввода.

    python -m unittest discover -s bot -p "test_*.py"
"""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.locales import DEFAULT_LANG, LANGUAGES, SUPPORTED, TEXTS, t
from bot.weather_text import Snapshot, describe, pick_outfit

TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


def snap(**kwargs) -> Snapshot:
    base = dict(
        temp=10.0, feels=10.0, wind=5.0, humidity=60.0, pressure=1013.0,
        uv=1.0, precip_prob=0.0, precip_mm=0.0, code=0, is_day=True,
    )
    base.update(kwargs)
    return Snapshot(**base)


class LocaleTests(unittest.TestCase):
    def test_all_languages_present(self):
        self.assertEqual(sorted(TEXTS), sorted(SUPPORTED))
        self.assertEqual(len(LANGUAGES), 6)

    def test_no_missing_keys(self):
        reference = set(TEXTS[DEFAULT_LANG])
        for code, table in TEXTS.items():
            missing = reference - set(table)
            self.assertFalse(missing, f"в языке {code} не хватает ключей: {sorted(missing)}")

    def test_no_extra_keys(self):
        reference = set(TEXTS[DEFAULT_LANG])
        for code, table in TEXTS.items():
            extra = set(table) - reference
            self.assertFalse(extra, f"в языке {code} лишние ключи: {sorted(extra)}")

    def test_placeholders_match_reference(self):
        """Плейсхолдеры обязаны совпадать, иначе format() потеряет данные."""
        pattern = re.compile(r"\{(\w+)\}")
        for key, template in TEXTS[DEFAULT_LANG].items():
            expected = set(pattern.findall(template))
            for code, table in TEXTS.items():
                actual = set(pattern.findall(table[key]))
                self.assertEqual(
                    expected, actual, f"{code}.{key}: плейсхолдеры разошлись с эталоном"
                )

    def test_greeting_matches_spec(self):
        self.assertIn("Aeris Weather Intelligence", t("ru", "greeting"))
        self.assertIn("оделся по погоде", t("ru", "greeting"))

    def test_unknown_language_falls_back(self):
        self.assertEqual(t("xx", "btn_free"), TEXTS[DEFAULT_LANG]["btn_free"])

    def test_interpolation(self):
        text = t("ru", "login_ready", minutes=10, url="https://example.com")
        self.assertIn("10", text)
        self.assertIn("https://example.com", text)

    def test_missing_placeholder_does_not_crash(self):
        self.assertIsInstance(t("ru", "login_ready"), str)


class OutfitTests(unittest.TestCase):
    def test_freezing(self):
        title, items, _ = pick_outfit(snap(temp=-22, feels=-25))
        self.assertIn("мороз", title.lower())
        self.assertTrue(any("Пуховик" in i for i in items))

    def test_hot(self):
        title, items, advice = pick_outfit(snap(temp=31, feels=33, uv=9.0))
        self.assertEqual(title, "Жарко")
        self.assertTrue(any("Шорты" in i for i in items))
        self.assertTrue(any("очки" in i for i in items))
        self.assertTrue(any("SPF" in a for a in advice))

    def test_rain_adds_umbrella(self):
        _, items, _ = pick_outfit(snap(temp=12, feels=12, precip_prob=70))
        self.assertTrue(any("Зонт" in i for i in items))
        self.assertTrue(any("Непромокаемая" in i for i in items))

    def test_storm_replaces_umbrella_with_advice(self):
        _, items, advice = pick_outfit(snap(temp=12, feels=12, precip_prob=70, wind=60))
        self.assertFalse(any("Зонт" in i for i in items))
        self.assertTrue(any("дождевик" in a for a in advice))

    def test_freezing_rain_is_about_ice(self):
        _, items, advice = pick_outfit(snap(temp=-2, feels=-4, precip_prob=80))
        self.assertFalse(any("Зонт" in i for i in items))
        self.assertTrue(any("рифлёной" in i for i in items))
        self.assertTrue(any("скользко" in a for a in advice))

    def test_night_has_no_sun_gear(self):
        _, items, _ = pick_outfit(snap(temp=24, feels=24, uv=9.0, is_day=False))
        self.assertFalse(any("очки" in i for i in items))

    def test_always_returns_content(self):
        for temp in (-30, -10, 0, 15, 25, 35):
            title, items, advice = pick_outfit(snap(temp=temp, feels=temp))
            self.assertTrue(title and items and advice)


class DescribeTests(unittest.TestCase):
    def test_known_codes(self):
        self.assertEqual(describe(0)[1], "Ясно")
        self.assertEqual(describe(95)[1], "Гроза")

    def test_unknown_code_is_safe(self):
        emoji, text = describe(12345)
        self.assertTrue(emoji and text)

    def test_none_is_safe(self):
        self.assertEqual(describe(None), describe(0))


class TimeParsingTests(unittest.TestCase):
    def test_valid_times(self):
        for value in ("00:00", "7:30", "07:30", "23:59"):
            self.assertTrue(TIME_RE.match(value), value)

    def test_invalid_times(self):
        for value in ("24:00", "12:60", "7-30", "утром", "0730"):
            self.assertIsNone(TIME_RE.match(value), value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
