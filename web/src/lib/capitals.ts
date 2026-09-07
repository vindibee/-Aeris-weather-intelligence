/**
 * Столицы мира для меток на глобусе.
 *
 * Держим отдельно от «витринных» городов лендинга: витрина показывает живую
 * температуру (её тянет /weather/bulk, а он ограничен 25 точками), а столицы —
 * статичная подложка, подписи которой всплывают по наведению.
 */

export interface Capital {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Крупные узлы подписываем всегда, остальные — только по наведению. */
  major?: boolean;
}

export const CAPITALS: Capital[] = [
  // --- Европа ---
  { name: 'Киев', country: 'Украина', lat: 50.4547, lon: 30.5238, major: true },
  { name: 'Лондон', country: 'Великобритания', lat: 51.5074, lon: -0.1278, major: true },
  { name: 'Париж', country: 'Франция', lat: 48.8566, lon: 2.3522, major: true },
  { name: 'Берлин', country: 'Германия', lat: 52.52, lon: 13.405, major: true },
  { name: 'Мадрид', country: 'Испания', lat: 40.4168, lon: -3.7038, major: true },
  { name: 'Рим', country: 'Италия', lat: 41.9028, lon: 12.4964, major: true },
  { name: 'Лиссабон', country: 'Португалия', lat: 38.7223, lon: -9.1393 },
  { name: 'Амстердам', country: 'Нидерланды', lat: 52.3676, lon: 4.9041 },
  { name: 'Брюссель', country: 'Бельгия', lat: 50.8503, lon: 4.3517 },
  { name: 'Вена', country: 'Австрия', lat: 48.2082, lon: 16.3738 },
  { name: 'Берн', country: 'Швейцария', lat: 46.948, lon: 7.4474 },
  { name: 'Прага', country: 'Чехия', lat: 50.0755, lon: 14.4378 },
  { name: 'Варшава', country: 'Польша', lat: 52.2297, lon: 21.0122 },
  { name: 'Будапешт', country: 'Венгрия', lat: 47.4979, lon: 19.0402 },
  { name: 'Бухарест', country: 'Румыния', lat: 44.4268, lon: 26.1025 },
  { name: 'София', country: 'Болгария', lat: 42.6977, lon: 23.3219 },
  { name: 'Афины', country: 'Греция', lat: 37.9838, lon: 23.7275 },
  { name: 'Белград', country: 'Сербия', lat: 44.7866, lon: 20.4489 },
  { name: 'Загреб', country: 'Хорватия', lat: 45.815, lon: 15.9819 },
  { name: 'Копенгаген', country: 'Дания', lat: 55.6761, lon: 12.5683 },
  { name: 'Осло', country: 'Норвегия', lat: 59.9139, lon: 10.7522 },
  { name: 'Стокгольм', country: 'Швеция', lat: 59.3293, lon: 18.0686 },
  { name: 'Хельсинки', country: 'Финляндия', lat: 60.1699, lon: 24.9384 },
  { name: 'Таллин', country: 'Эстония', lat: 59.437, lon: 24.7536 },
  { name: 'Рига', country: 'Латвия', lat: 56.9496, lon: 24.1052 },
  { name: 'Вильнюс', country: 'Литва', lat: 54.6872, lon: 25.2797 },
  { name: 'Минск', country: 'Беларусь', lat: 53.9006, lon: 27.559 },
  { name: 'Кишинёв', country: 'Молдова', lat: 47.0105, lon: 28.8638 },
  { name: 'Москва', country: 'Россия', lat: 55.7558, lon: 37.6173, major: true },
  { name: 'Рейкьявик', country: 'Исландия', lat: 64.1466, lon: -21.9426 },
  { name: 'Дублин', country: 'Ирландия', lat: 53.3498, lon: -6.2603 },

  // --- Азия ---
  { name: 'Токио', country: 'Япония', lat: 35.6895, lon: 139.6917, major: true },
  { name: 'Пекин', country: 'Китай', lat: 39.9042, lon: 116.4074, major: true },
  { name: 'Нью-Дели', country: 'Индия', lat: 28.6139, lon: 77.209, major: true },
  { name: 'Сеул', country: 'Южная Корея', lat: 37.5665, lon: 126.978, major: true },
  { name: 'Джакарта', country: 'Индонезия', lat: -6.2088, lon: 106.8456, major: true },
  { name: 'Бангкок', country: 'Таиланд', lat: 13.7563, lon: 100.5018 },
  { name: 'Ханой', country: 'Вьетнам', lat: 21.0285, lon: 105.8542 },
  { name: 'Манила', country: 'Филиппины', lat: 14.5995, lon: 120.9842 },
  { name: 'Куала-Лумпур', country: 'Малайзия', lat: 3.139, lon: 101.6869 },
  { name: 'Сингапур', country: 'Сингапур', lat: 1.3521, lon: 103.8198 },
  { name: 'Исламабад', country: 'Пакистан', lat: 33.6844, lon: 73.0479 },
  { name: 'Дакка', country: 'Бангладеш', lat: 23.8103, lon: 90.4125 },
  { name: 'Катманду', country: 'Непал', lat: 27.7172, lon: 85.324 },
  { name: 'Коломбо', country: 'Шри-Ланка', lat: 6.9271, lon: 79.8612 },
  { name: 'Улан-Батор', country: 'Монголия', lat: 47.8864, lon: 106.9057 },
  { name: 'Астана', country: 'Казахстан', lat: 51.1694, lon: 71.4491 },
  { name: 'Ташкент', country: 'Узбекистан', lat: 41.2995, lon: 69.2401 },
  { name: 'Бишкек', country: 'Киргизия', lat: 42.8746, lon: 74.5698 },
  { name: 'Душанбе', country: 'Таджикистан', lat: 38.5598, lon: 68.787 },
  { name: 'Ашхабад', country: 'Туркменистан', lat: 37.9601, lon: 58.3261 },
  { name: 'Баку', country: 'Азербайджан', lat: 40.4093, lon: 49.8671 },
  { name: 'Тбилиси', country: 'Грузия', lat: 41.7151, lon: 44.8271 },
  { name: 'Ереван', country: 'Армения', lat: 40.1792, lon: 44.4991 },
  { name: 'Тегеран', country: 'Иран', lat: 35.6892, lon: 51.389 },
  { name: 'Багдад', country: 'Ирак', lat: 33.3152, lon: 44.3661 },
  { name: 'Эр-Рияд', country: 'Саудовская Аравия', lat: 24.7136, lon: 46.6753 },
  { name: 'Абу-Даби', country: 'ОАЭ', lat: 24.4539, lon: 54.3773 },
  { name: 'Доха', country: 'Катар', lat: 25.2854, lon: 51.531 },
  { name: 'Кувейт', country: 'Кувейт', lat: 29.3759, lon: 47.9774 },
  { name: 'Маскат', country: 'Оман', lat: 23.588, lon: 58.3829 },
  { name: 'Амман', country: 'Иордания', lat: 31.9454, lon: 35.9284 },
  { name: 'Бейрут', country: 'Ливан', lat: 33.8938, lon: 35.5018 },
  { name: 'Дамаск', country: 'Сирия', lat: 33.5138, lon: 36.2765 },
  { name: 'Иерусалим', country: 'Израиль', lat: 31.7683, lon: 35.2137 },
  { name: 'Анкара', country: 'Турция', lat: 39.9334, lon: 32.8597 },
  { name: 'Никосия', country: 'Кипр', lat: 35.1856, lon: 33.3823 },
  { name: 'Пномпень', country: 'Камбоджа', lat: 11.5564, lon: 104.9282 },
  { name: 'Вьентьян', country: 'Лаос', lat: 17.9757, lon: 102.6331 },
  { name: 'Нейпьидо', country: 'Мьянма', lat: 19.7633, lon: 96.0785 },
  { name: 'Кабул', country: 'Афганистан', lat: 34.5553, lon: 69.2075 },

  // --- Африка ---
  { name: 'Каир', country: 'Египет', lat: 30.0444, lon: 31.2357, major: true },
  { name: 'Найроби', country: 'Кения', lat: -1.2921, lon: 36.8219 },
  { name: 'Аддис-Абеба', country: 'Эфиопия', lat: 9.032, lon: 38.7469 },
  { name: 'Абуджа', country: 'Нигерия', lat: 9.0765, lon: 7.3986 },
  { name: 'Аккра', country: 'Гана', lat: 5.6037, lon: -0.187 },
  { name: 'Дакар', country: 'Сенегал', lat: 14.7167, lon: -17.4677 },
  { name: 'Рабат', country: 'Марокко', lat: 34.0209, lon: -6.8416 },
  { name: 'Алжир', country: 'Алжир', lat: 36.7538, lon: 3.0588 },
  { name: 'Тунис', country: 'Тунис', lat: 36.8065, lon: 10.1815 },
  { name: 'Триполи', country: 'Ливия', lat: 32.8872, lon: 13.1913 },
  { name: 'Хартум', country: 'Судан', lat: 15.5007, lon: 32.5599 },
  { name: 'Киншаса', country: 'ДР Конго', lat: -4.4419, lon: 15.2663 },
  { name: 'Луанда', country: 'Ангола', lat: -8.839, lon: 13.2894 },
  { name: 'Претория', country: 'ЮАР', lat: -25.7479, lon: 28.2293, major: true },
  { name: 'Хараре', country: 'Зимбабве', lat: -17.8252, lon: 31.0335 },
  { name: 'Лусака', country: 'Замбия', lat: -15.3875, lon: 28.3228 },
  { name: 'Додома', country: 'Танзания', lat: -6.163, lon: 35.7516 },
  { name: 'Кампала', country: 'Уганда', lat: 0.3476, lon: 32.5825 },
  { name: 'Антананариву', country: 'Мадагаскар', lat: -18.8792, lon: 47.5079 },

  // --- Америка ---
  { name: 'Вашингтон', country: 'США', lat: 38.9072, lon: -77.0369, major: true },
  { name: 'Оттава', country: 'Канада', lat: 45.4215, lon: -75.6972, major: true },
  { name: 'Мехико', country: 'Мексика', lat: 19.4326, lon: -99.1332, major: true },
  { name: 'Гавана', country: 'Куба', lat: 23.1136, lon: -82.3666 },
  { name: 'Гватемала', country: 'Гватемала', lat: 14.6349, lon: -90.5069 },
  { name: 'Панама', country: 'Панама', lat: 8.9824, lon: -79.5199 },
  { name: 'Богота', country: 'Колумбия', lat: 4.711, lon: -74.0721 },
  { name: 'Каракас', country: 'Венесуэла', lat: 10.4806, lon: -66.9036 },
  { name: 'Кито', country: 'Эквадор', lat: -0.1807, lon: -78.4678 },
  { name: 'Лима', country: 'Перу', lat: -12.0464, lon: -77.0428 },
  { name: 'Ла-Пас', country: 'Боливия', lat: -16.4897, lon: -68.1193 },
  { name: 'Сантьяго', country: 'Чили', lat: -33.4489, lon: -70.6693 },
  { name: 'Буэнос-Айрес', country: 'Аргентина', lat: -34.6037, lon: -58.3816, major: true },
  { name: 'Монтевидео', country: 'Уругвай', lat: -34.9011, lon: -56.1645 },
  { name: 'Асунсьон', country: 'Парагвай', lat: -25.2637, lon: -57.5759 },
  { name: 'Бразилиа', country: 'Бразилия', lat: -15.8267, lon: -47.9218, major: true },

  // --- Океания ---
  { name: 'Канберра', country: 'Австралия', lat: -35.2809, lon: 149.13, major: true },
  { name: 'Веллингтон', country: 'Новая Зеландия', lat: -41.2866, lon: 174.7756 },
  { name: 'Порт-Морсби', country: 'Папуа — Новая Гвинея', lat: -9.4438, lon: 147.1803 },
  { name: 'Сува', country: 'Фиджи', lat: -18.1416, lon: 178.4419 },
];
