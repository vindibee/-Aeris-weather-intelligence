"""Тексты бота на шести языках.

Ключи те же, что в веб-интерфейсе, где это уместно. Русский — эталон: если
ключа нет в переводе, `t()` берёт русский вариант, а не падает.
"""

from __future__ import annotations

LANGUAGES: list[tuple[str, str, str]] = [
    ("uk", "Українська", "🇺🇦"),
    ("ru", "Русский", "🇷🇺"),
    ("en", "English", "🇬🇧"),
    ("de", "Deutsch", "🇩🇪"),
    ("fr", "Français", "🇫🇷"),
    ("es", "Español", "🇪🇸"),
]

DEFAULT_LANG = "ru"
SUPPORTED = [code for code, _, _ in LANGUAGES]

TEXTS: dict[str, dict[str, str]] = {
    "ru": {
        "choose_language": "Выберите язык / Choose your language",
        "language_set": "Язык интерфейса: Русский",
        "greeting": (
            "Привет, я бот Aeris Weather Intelligence. Я тут, чтобы помочь тебе "
            "узнать погоду, и я переживаю, чтобы ты оделся по погоде!"
        ),
        "menu_hint": "Выберите раздел ниже.",
        "btn_free": "Обычные функции",
        "btn_premium": "Премиум функции",
        "btn_language": "Сменить язык",
        "free_title": "Бесплатные возможности",
        "btn_login": "Войти на сайте",
        "btn_weather_now": "Погода сейчас",
        "btn_back": "Назад",
        "login_ready": (
            "Ссылка для входа готова. Она одноразовая и живёт {minutes} минут:\n{url}"
        ),
        "login_failed": "Не удалось создать ссылку входа. Попробуйте позже.",
        "ask_city": (
            "Пришлите название города или отправьте свою геолокацию кнопкой ниже."
        ),
        "btn_send_location": "Отправить геолокацию",
        "searching": "Ищу…",
        "city_not_found": (
            "Не нашёл «{query}». Проверьте написание или пришлите геолокацию."
        ),
        "city_suggestions": "Не нашёл точное совпадение. Возможно, вы имели в виду:",
        "api_error": "Метеосервис не отвечает. Попробуйте через пару минут.",
        "weather_header": "{emoji} {city}",
        "weather_body": (
            "Сейчас {temp}°C, ощущается как {feels}°C\n"
            "{description}\n\n"
            "Ветер: {wind} км/ч\n"
            "Влажность: {humidity}%\n"
            "Давление: {pressure} гПа\n"
            "УФ-индекс: {uv}\n"
            "Вероятность осадков: {precip}%"
        ),
        "outfit_header": "Что надеть",
        "premium_title": "Премиум",
        "premium_pitch": (
            "Премиум открывает планировщик: бот сам присылает подробную сводку "
            "и рекомендацию по одежде три раза в день для выбранного города.\n\n"
            "Стоимость: {stars} ⭐ или {usdt} USDT."
        ),
        "btn_pay_stars": "Оплатить {stars} ⭐",
        "btn_pay_crypto": "Оплатить {usdt} USDT",
        "premium_active": "Премиум активен. Настройте рассылку:",
        "btn_set_city": "Город рассылки",
        "btn_set_times": "Время рассылки",
        "btn_schedule_off": "Отключить рассылку",
        "payment_title": "Aeris Премиум",
        "payment_description": "Планировщик прогнозов: три подробные сводки в день",
        "payment_ok": "Оплата прошла. Премиум активирован!",
        "crypto_invoice": "Счёт создан. Оплатите по ссылке:\n{url}",
        "crypto_check": "Проверить оплату",
        "crypto_pending": "Оплата ещё не поступила.",
        "crypto_disabled": "Криптоплатежи не настроены на этом боте.",
        "schedule_city_saved": "Город рассылки: {city}",
        "ask_times": (
            "Пришлите время рассылки через пробел или запятую, например: 07:30 13:00 20:00\n"
            "Часовой пояс определяется по городу."
        ),
        "times_saved": "Рассылка настроена: {times}",
        "times_invalid": "Не понял время. Формат — ЧЧ:ММ, например 08:00.",
        "schedule_off": "Рассылка отключена.",
        "need_city_first": "Сначала выберите город рассылки.",
        "daily_header": "Сводка на сейчас",
        "not_premium": "Эта функция доступна в премиуме.",
    },
    "uk": {
        "choose_language": "Оберіть мову / Choose your language",
        "language_set": "Мова інтерфейсу: Українська",
        "greeting": (
            "Привіт, я бот Aeris Weather Intelligence. Я тут, щоб допомогти тобі "
            "дізнатися погоду, і я хвилююся, щоб ти вдягнувся за погодою!"
        ),
        "menu_hint": "Оберіть розділ нижче.",
        "btn_free": "Звичайні функції",
        "btn_premium": "Преміум функції",
        "btn_language": "Змінити мову",
        "free_title": "Безкоштовні можливості",
        "btn_login": "Увійти на сайті",
        "btn_weather_now": "Погода зараз",
        "btn_back": "Назад",
        "login_ready": "Посилання для входу готове. Воно одноразове і живе {minutes} хв:\n{url}",
        "login_failed": "Не вдалося створити посилання для входу. Спробуйте пізніше.",
        "ask_city": "Надішліть назву міста або свою геолокацію кнопкою нижче.",
        "btn_send_location": "Надіслати геолокацію",
        "searching": "Шукаю…",
        "city_not_found": "Не знайшов «{query}». Перевірте написання або надішліть геолокацію.",
        "city_suggestions": "Точного збігу немає. Можливо, ви мали на увазі:",
        "api_error": "Метеосервіс не відповідає. Спробуйте за кілька хвилин.",
        "weather_header": "{emoji} {city}",
        "weather_body": (
            "Зараз {temp}°C, відчувається як {feels}°C\n"
            "{description}\n\n"
            "Вітер: {wind} км/год\n"
            "Вологість: {humidity}%\n"
            "Тиск: {pressure} гПа\n"
            "УФ-індекс: {uv}\n"
            "Імовірність опадів: {precip}%"
        ),
        "outfit_header": "Що вдягнути",
        "premium_title": "Преміум",
        "premium_pitch": (
            "Преміум відкриває планувальник: бот сам надсилає докладну зведення "
            "та рекомендацію щодо одягу тричі на день для обраного міста.\n\n"
            "Вартість: {stars} ⭐ або {usdt} USDT."
        ),
        "btn_pay_stars": "Сплатити {stars} ⭐",
        "btn_pay_crypto": "Сплатити {usdt} USDT",
        "premium_active": "Преміум активний. Налаштуйте розсилку:",
        "btn_set_city": "Місто розсилки",
        "btn_set_times": "Час розсилки",
        "btn_schedule_off": "Вимкнути розсилку",
        "payment_title": "Aeris Преміум",
        "payment_description": "Планувальник прогнозів: три докладні зведення на день",
        "payment_ok": "Оплата пройшла. Преміум активовано!",
        "crypto_invoice": "Рахунок створено. Сплатіть за посиланням:\n{url}",
        "crypto_check": "Перевірити оплату",
        "crypto_pending": "Оплата ще не надійшла.",
        "crypto_disabled": "Криптоплатежі не налаштовані в цьому боті.",
        "schedule_city_saved": "Місто розсилки: {city}",
        "ask_times": (
            "Надішліть час розсилки через пробіл або кому, наприклад: 07:30 13:00 20:00\n"
            "Часовий пояс визначається за містом."
        ),
        "times_saved": "Розсилку налаштовано: {times}",
        "times_invalid": "Не зрозумів час. Формат — ГГ:ХХ, наприклад 08:00.",
        "schedule_off": "Розсилку вимкнено.",
        "need_city_first": "Спершу оберіть місто розсилки.",
        "daily_header": "Зведення на зараз",
        "not_premium": "Ця функція доступна в преміумі.",
    },
    "en": {
        "choose_language": "Choose your language",
        "language_set": "Interface language: English",
        "greeting": (
            "Hi, I'm the Aeris Weather Intelligence bot. I'm here to help you check "
            "the weather, and I really want you to dress for it!"
        ),
        "menu_hint": "Pick a section below.",
        "btn_free": "Regular features",
        "btn_premium": "Premium features",
        "btn_language": "Change language",
        "free_title": "Free features",
        "btn_login": "Sign in on the website",
        "btn_weather_now": "Weather now",
        "btn_back": "Back",
        "login_ready": "Your sign-in link is ready. It is single-use and valid for {minutes} min:\n{url}",
        "login_failed": "Could not create a sign-in link. Please try again later.",
        "ask_city": "Send a city name or share your location with the button below.",
        "btn_send_location": "Share location",
        "searching": "Searching…",
        "city_not_found": "I couldn't find “{query}”. Check the spelling or send your location.",
        "city_suggestions": "No exact match. Did you mean:",
        "api_error": "The weather service is not responding. Try again in a couple of minutes.",
        "weather_header": "{emoji} {city}",
        "weather_body": (
            "Now {temp}°C, feels like {feels}°C\n"
            "{description}\n\n"
            "Wind: {wind} km/h\n"
            "Humidity: {humidity}%\n"
            "Pressure: {pressure} hPa\n"
            "UV index: {uv}\n"
            "Precipitation chance: {precip}%"
        ),
        "outfit_header": "What to wear",
        "premium_title": "Premium",
        "premium_pitch": (
            "Premium unlocks the scheduler: the bot sends a detailed summary and an "
            "outfit recommendation three times a day for your chosen city.\n\n"
            "Price: {stars} ⭐ or {usdt} USDT."
        ),
        "btn_pay_stars": "Pay {stars} ⭐",
        "btn_pay_crypto": "Pay {usdt} USDT",
        "premium_active": "Premium is active. Set up your digest:",
        "btn_set_city": "Digest city",
        "btn_set_times": "Digest times",
        "btn_schedule_off": "Turn digest off",
        "payment_title": "Aeris Premium",
        "payment_description": "Forecast scheduler: three detailed digests a day",
        "payment_ok": "Payment received. Premium activated!",
        "crypto_invoice": "Invoice created. Pay via the link:\n{url}",
        "crypto_check": "Check payment",
        "crypto_pending": "Payment has not arrived yet.",
        "crypto_disabled": "Crypto payments are not configured for this bot.",
        "schedule_city_saved": "Digest city: {city}",
        "ask_times": (
            "Send digest times separated by spaces or commas, e.g. 07:30 13:00 20:00\n"
            "The time zone is taken from the city."
        ),
        "times_saved": "Digest scheduled: {times}",
        "times_invalid": "I couldn't parse the time. Use HH:MM, e.g. 08:00.",
        "schedule_off": "Digest turned off.",
        "need_city_first": "Choose the digest city first.",
        "daily_header": "Current summary",
        "not_premium": "This feature is part of Premium.",
    },
    "de": {
        "choose_language": "Sprache wählen / Choose your language",
        "language_set": "Oberflächensprache: Deutsch",
        "greeting": (
            "Hallo, ich bin der Aeris-Weather-Intelligence-Bot. Ich helfe dir beim "
            "Wetter — und mir liegt daran, dass du dich passend anziehst!"
        ),
        "menu_hint": "Wähle unten einen Bereich.",
        "btn_free": "Normale Funktionen",
        "btn_premium": "Premium-Funktionen",
        "btn_language": "Sprache ändern",
        "free_title": "Kostenlose Funktionen",
        "btn_login": "Auf der Website anmelden",
        "btn_weather_now": "Wetter jetzt",
        "btn_back": "Zurück",
        "login_ready": "Anmeldelink ist bereit. Einmalig gültig für {minutes} Min:\n{url}",
        "login_failed": "Anmeldelink konnte nicht erstellt werden. Bitte später erneut versuchen.",
        "ask_city": "Sende einen Städtenamen oder teile deinen Standort mit der Taste unten.",
        "btn_send_location": "Standort senden",
        "searching": "Suche…",
        "city_not_found": "„{query}“ nicht gefunden. Schreibweise prüfen oder Standort senden.",
        "city_suggestions": "Keine exakte Übereinstimmung. Meintest du:",
        "api_error": "Der Wetterdienst antwortet nicht. Bitte in ein paar Minuten erneut.",
        "weather_header": "{emoji} {city}",
        "weather_body": (
            "Jetzt {temp}°C, gefühlt {feels}°C\n"
            "{description}\n\n"
            "Wind: {wind} km/h\n"
            "Luftfeuchte: {humidity}%\n"
            "Luftdruck: {pressure} hPa\n"
            "UV-Index: {uv}\n"
            "Niederschlagswahrscheinlichkeit: {precip}%"
        ),
        "outfit_header": "Was anziehen",
        "premium_title": "Premium",
        "premium_pitch": (
            "Premium schaltet den Planer frei: Der Bot schickt dreimal täglich eine "
            "ausführliche Übersicht und eine Kleidungsempfehlung für deine Stadt.\n\n"
            "Preis: {stars} ⭐ oder {usdt} USDT."
        ),
        "btn_pay_stars": "{stars} ⭐ zahlen",
        "btn_pay_crypto": "{usdt} USDT zahlen",
        "premium_active": "Premium ist aktiv. Richte den Versand ein:",
        "btn_set_city": "Stadt für den Versand",
        "btn_set_times": "Versandzeiten",
        "btn_schedule_off": "Versand ausschalten",
        "payment_title": "Aeris Premium",
        "payment_description": "Prognoseplaner: drei ausführliche Übersichten pro Tag",
        "payment_ok": "Zahlung eingegangen. Premium aktiviert!",
        "crypto_invoice": "Rechnung erstellt. Über den Link bezahlen:\n{url}",
        "crypto_check": "Zahlung prüfen",
        "crypto_pending": "Die Zahlung ist noch nicht eingegangen.",
        "crypto_disabled": "Krypto-Zahlungen sind für diesen Bot nicht eingerichtet.",
        "schedule_city_saved": "Stadt für den Versand: {city}",
        "ask_times": (
            "Sende die Versandzeiten mit Leerzeichen oder Komma getrennt, z. B. 07:30 13:00 20:00\n"
            "Die Zeitzone ergibt sich aus der Stadt."
        ),
        "times_saved": "Versand eingerichtet: {times}",
        "times_invalid": "Zeit nicht erkannt. Format HH:MM, z. B. 08:00.",
        "schedule_off": "Versand ausgeschaltet.",
        "need_city_first": "Wähle zuerst die Stadt für den Versand.",
        "daily_header": "Aktuelle Übersicht",
        "not_premium": "Diese Funktion gehört zu Premium.",
    },
    "fr": {
        "choose_language": "Choisissez votre langue",
        "language_set": "Langue de l'interface : Français",
        "greeting": (
            "Salut, je suis le bot Aeris Weather Intelligence. Je suis là pour t'aider "
            "à connaître la météo, et je tiens à ce que tu t'habilles en conséquence !"
        ),
        "menu_hint": "Choisissez une section ci-dessous.",
        "btn_free": "Fonctions classiques",
        "btn_premium": "Fonctions premium",
        "btn_language": "Changer de langue",
        "free_title": "Fonctions gratuites",
        "btn_login": "Se connecter sur le site",
        "btn_weather_now": "Météo maintenant",
        "btn_back": "Retour",
        "login_ready": "Votre lien de connexion est prêt. Usage unique, valable {minutes} min :\n{url}",
        "login_failed": "Impossible de créer le lien de connexion. Réessayez plus tard.",
        "ask_city": "Envoyez un nom de ville ou partagez votre position avec le bouton ci-dessous.",
        "btn_send_location": "Partager ma position",
        "searching": "Recherche…",
        "city_not_found": "Je n'ai pas trouvé « {query} ». Vérifiez l'orthographe ou envoyez votre position.",
        "city_suggestions": "Pas de correspondance exacte. Vouliez-vous dire :",
        "api_error": "Le service météo ne répond pas. Réessayez dans quelques minutes.",
        "weather_header": "{emoji} {city}",
        "weather_body": (
            "Actuellement {temp}°C, ressenti {feels}°C\n"
            "{description}\n\n"
            "Vent : {wind} km/h\n"
            "Humidité : {humidity}%\n"
            "Pression : {pressure} hPa\n"
            "Indice UV : {uv}\n"
            "Probabilité de précipitations : {precip}%"
        ),
        "outfit_header": "Quoi porter",
        "premium_title": "Premium",
        "premium_pitch": (
            "Le premium débloque le planificateur : le bot envoie un bulletin détaillé "
            "et une recommandation vestimentaire trois fois par jour pour votre ville.\n\n"
            "Prix : {stars} ⭐ ou {usdt} USDT."
        ),
        "btn_pay_stars": "Payer {stars} ⭐",
        "btn_pay_crypto": "Payer {usdt} USDT",
        "premium_active": "Premium actif. Configurez l'envoi :",
        "btn_set_city": "Ville des bulletins",
        "btn_set_times": "Heures d'envoi",
        "btn_schedule_off": "Désactiver l'envoi",
        "payment_title": "Aeris Premium",
        "payment_description": "Planificateur de prévisions : trois bulletins détaillés par jour",
        "payment_ok": "Paiement reçu. Premium activé !",
        "crypto_invoice": "Facture créée. Payez via le lien :\n{url}",
        "crypto_check": "Vérifier le paiement",
        "crypto_pending": "Le paiement n'est pas encore arrivé.",
        "crypto_disabled": "Les paiements crypto ne sont pas configurés sur ce bot.",
        "schedule_city_saved": "Ville des bulletins : {city}",
        "ask_times": (
            "Envoyez les heures séparées par des espaces ou des virgules, ex. 07:30 13:00 20:00\n"
            "Le fuseau horaire est déduit de la ville."
        ),
        "times_saved": "Envoi programmé : {times}",
        "times_invalid": "Heure non comprise. Format HH:MM, par ex. 08:00.",
        "schedule_off": "Envoi désactivé.",
        "need_city_first": "Choisissez d'abord la ville des bulletins.",
        "daily_header": "Bulletin actuel",
        "not_premium": "Cette fonction fait partie du premium.",
    },
    "es": {
        "choose_language": "Elige tu idioma",
        "language_set": "Idioma de la interfaz: Español",
        "greeting": (
            "¡Hola! Soy el bot de Aeris Weather Intelligence. Estoy aquí para ayudarte "
            "a conocer el tiempo, ¡y me importa que te abrigues como toca!"
        ),
        "menu_hint": "Elige una sección abajo.",
        "btn_free": "Funciones normales",
        "btn_premium": "Funciones premium",
        "btn_language": "Cambiar idioma",
        "free_title": "Funciones gratuitas",
        "btn_login": "Iniciar sesión en la web",
        "btn_weather_now": "El tiempo ahora",
        "btn_back": "Atrás",
        "login_ready": "Tu enlace de acceso está listo. Es de un solo uso y dura {minutes} min:\n{url}",
        "login_failed": "No se pudo crear el enlace de acceso. Inténtalo más tarde.",
        "ask_city": "Envía el nombre de una ciudad o comparte tu ubicación con el botón de abajo.",
        "btn_send_location": "Compartir ubicación",
        "searching": "Buscando…",
        "city_not_found": "No encontré «{query}». Revisa la grafía o envía tu ubicación.",
        "city_suggestions": "Sin coincidencia exacta. ¿Quisiste decir:",
        "api_error": "El servicio meteorológico no responde. Inténtalo en unos minutos.",
        "weather_header": "{emoji} {city}",
        "weather_body": (
            "Ahora {temp}°C, sensación de {feels}°C\n"
            "{description}\n\n"
            "Viento: {wind} km/h\n"
            "Humedad: {humidity}%\n"
            "Presión: {pressure} hPa\n"
            "Índice UV: {uv}\n"
            "Probabilidad de precipitación: {precip}%"
        ),
        "outfit_header": "Qué ponerse",
        "premium_title": "Premium",
        "premium_pitch": (
            "Premium desbloquea el planificador: el bot envía un resumen detallado y "
            "una recomendación de ropa tres veces al día para tu ciudad.\n\n"
            "Precio: {stars} ⭐ o {usdt} USDT."
        ),
        "btn_pay_stars": "Pagar {stars} ⭐",
        "btn_pay_crypto": "Pagar {usdt} USDT",
        "premium_active": "Premium activo. Configura el envío:",
        "btn_set_city": "Ciudad del resumen",
        "btn_set_times": "Horas de envío",
        "btn_schedule_off": "Desactivar el envío",
        "payment_title": "Aeris Premium",
        "payment_description": "Planificador de pronósticos: tres resúmenes detallados al día",
        "payment_ok": "Pago recibido. ¡Premium activado!",
        "crypto_invoice": "Factura creada. Paga con el enlace:\n{url}",
        "crypto_check": "Comprobar el pago",
        "crypto_pending": "El pago aún no ha llegado.",
        "crypto_disabled": "Los pagos en cripto no están configurados en este bot.",
        "schedule_city_saved": "Ciudad del resumen: {city}",
        "ask_times": (
            "Envía las horas separadas por espacios o comas, p. ej. 07:30 13:00 20:00\n"
            "La zona horaria se toma de la ciudad."
        ),
        "times_saved": "Envío programado: {times}",
        "times_invalid": "No entendí la hora. Formato HH:MM, p. ej. 08:00.",
        "schedule_off": "Envío desactivado.",
        "need_city_first": "Elige primero la ciudad del resumen.",
        "daily_header": "Resumen actual",
        "not_premium": "Esta función es parte de Premium.",
    },
}


def t(lang: str | None, key: str, **kwargs: object) -> str:
    """Возвращает строку на языке пользователя с подстановкой параметров."""
    code = lang if lang in TEXTS else DEFAULT_LANG
    template = TEXTS[code].get(key) or TEXTS[DEFAULT_LANG].get(key, key)
    if not kwargs:
        return template
    try:
        return template.format(**kwargs)
    except KeyError:
        # недостающий плейсхолдер не должен ронять ответ пользователю
        return template
