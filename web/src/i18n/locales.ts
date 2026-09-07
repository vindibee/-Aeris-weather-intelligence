/**
 * Словари интерфейса.
 *
 * Ключи сгруппированы по разделам, значения — плоские строки с плейсхолдерами
 * вида {{count}}. Русский считается эталоном: при добавлении ключа его сначала
 * заводят здесь, а тип `TranslationKey` не даст забыть остальные языки.
 */

export const LANGUAGES = [
  { code: 'uk', label: 'Українська', short: 'UK', flag: '🇺🇦' },
  { code: 'ru', label: 'Русский', short: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', short: 'DE', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷' },
  { code: 'es', label: 'Español', short: 'ES', flag: '🇪🇸' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const ru = {
  common: {
    appName: 'Aeris',
    tagline: 'weather intelligence',
    loading: 'Загружаем данные',
    retry: 'Повторить',
    close: 'Закрыть',
    error: 'Не удалось загрузить',
    search: 'Найти город…',
    notFound: 'Ничего не найдено — попробуйте другое написание',
    myLocation: 'Моя геолокация',
    language: 'Язык',
  },
  nav: {
    features: 'Возможности',
    how: 'Как работает',
    data: 'Данные',
    space: 'Погода в космосе',
    login: 'Войти',
    start: 'Начать',
    toDashboard: 'В кабинет',
    overview: 'Обзор',
    map: 'Карта',
    locations: 'Локации',
    settings: 'Настройки',
    logout: 'Выйти',
    home: 'На главную',
    theme: 'Сменить тему',
  },
  hero: {
    badgeLive: 'Данные обновлены только что',
    badgeLoading: 'Подключаемся к метеосети…',
    title: 'Погода, которую',
    titleAccent: 'видно',
    subtitle: 'Интерактивная метеоплатформа: живые карты ветра и осадков, 20+ параметров атмосферы и точный прогноз на 16 суток для любой точки планеты.',
    openDashboard: 'Открыть кабинет',
    demoAccess: 'Демо-доступ',
    dragHint: 'Потяните, чтобы вращать',
    statDepth: 'глубина прогноза',
    statParams: 'параметров',
    statGrid: 'сетка модели',
    statOpen: 'открытые данные',
  },
  weather: {
    feelsLike: 'ощущается как',
    wind: 'Ветер',
    gusts: 'Порывы',
    humidity: 'Влажность',
    pressure: 'Давление',
    uv: 'UV-индекс',
    precip: 'Осадки',
    today: 'сегодня',
    forecast: 'Прогноз',
    noDataHere: 'В самой точке наблюдений нет — данные ближайшей станции, в {{km}} км.',
  },
  favourite: {
    add: 'В избранное',
    added: 'В избранном',
    addAria: 'Добавить {{city}} в избранное',
    removeAria: 'Убрать {{city}} из избранного',
  },
  outfit: {
    title: 'Одеватор',
    basis: 'Набор собран по ощущаемой температуре {{temp}} °C',
    bothGenders: 'пол не указан, показаны оба варианта',
    slotOuter: 'Верхняя одежда',
    slotMid: 'Средний слой',
    slotLegs: 'Низ',
    slotHead: 'Головной убор',
    slotShoes: 'Обувь',
    slotAccessory: 'Аксессуары',
  },
  indices: {
    title: 'Бытовые индексы',
    subtitle: 'рассчитаны по текущему прогнозу',
    carWash: 'Автомойка',
    laundry: 'Сушка белья',
    petWalk: 'Выгул питомцев',
  },
  extremes: {
    title: 'Охотник за экстремумами',
    subtitle: 'где на планете прямо сейчас предел',
    hot: 'Самое жаркое',
    cold: 'Самое холодное',
    wind: 'Самое ветреное',
    hotHint: 'максимум температуры',
    coldHint: 'минимум температуры',
    windHint: 'максимум порывов',
    idle: 'Нажмите кнопку — сервер опросит опорную сеть метеостанций, а глобус плавно довернётся к найденной точке.',
    scanning: 'Сканируем опорную сеть…',
    seeForecast: 'Смотреть прогноз',
    gridNode: 'узел сетки',
  },
  space: {
    title: 'Погода в',
    titleAccent: 'космосе',
    subtitle: 'Восемь планет, у каждой — своя атмосфера, давление и ветры. Каждый глобус вращается мышью.',
    solar: 'Солнечная активность',
    flares: 'Вспышки',
    storms: 'Геомагнитные бури',
    live: 'live',
    fallback: 'резерв',
    allMetrics: 'Все метрики',
    climate: 'Климат-пояса',
    spin: 'Медленное вращение',
    stopSpin: 'Остановить',
    fullscreen: 'Во весь экран',
    collapse: 'Свернуть',
    temperature: 'Температура',
    pressure: 'Атмосферное давление',
    windSpeed: 'Скорость ветра',
    composition: 'Состав атмосферы',
    openEarth: 'Открыть земной глобус с картой городов',
  },
  auth: {
    welcomeBack: 'С возвращением',
    loginSubtitle: 'Войдите, чтобы открыть свой метео-кабинет',
    email: 'Почта',
    password: 'Пароль',
    signIn: 'Войти',
    signUp: 'Создать аккаунт',
    demoLogin: 'Войти в демо-аккаунт',
    noAccount: 'Нет аккаунта?',
    register: 'Зарегистрироваться',
    or: 'или',
    withGoogle: 'Войти через Google',
    withTelegram: 'Войти через Telegram',
  },
  settings: {
    units: 'Единицы измерения',
    metric: 'Метрические',
    imperial: 'Имперские',
    appearance: 'Оформление',
    dark: 'Тёмная',
    light: 'Светлая',
    gender: 'Пол для «Одеватора»',
    genderHint: 'Определяет, какая 3D-модель показывается в подборе одежды. Если не указан — выводятся обе.',
    male: 'Мужской',
    female: 'Женский',
    unspecified: 'Не указан',
    home: 'Домашняя точка',
    language: 'Язык интерфейса',
  },
} as const;

/** Плоский путь вида "nav.login" — используется как ключ перевода. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? Leaves<T[K], `${P}${K}.`>
    : `${P}${K}`;
}[keyof T & string];

export type TranslationKey = Leaves<typeof ru>;

/**
 * Структура русского словаря, но со строковыми значениями.
 *
 * Без этого `as const` у эталона превращал каждое значение в литеральный тип,
 * и перевод «Мова» не подходил под тип «Язык». Нам нужна одинаковая форма и
 * полный набор ключей, а не совпадение текстов.
 */
export type Dictionary = {
  [Section in keyof typeof ru]: { [Key in keyof (typeof ru)[Section]]: string };
};

const uk: Dictionary = {
  common: {
    appName: 'Aeris',
    tagline: 'weather intelligence',
    loading: 'Завантажуємо дані',
    retry: 'Повторити',
    close: 'Закрити',
    error: 'Не вдалося завантажити',
    search: 'Знайти місто…',
    notFound: 'Нічого не знайдено — спробуйте інше написання',
    myLocation: 'Моя геолокація',
    language: 'Мова',
  },
  nav: {
    features: 'Можливості', how: 'Як працює', data: 'Дані', space: 'Погода в космосі',
    login: 'Увійти', start: 'Почати', toDashboard: 'До кабінету',
    overview: 'Огляд', map: 'Карта', locations: 'Локації', settings: 'Налаштування',
    logout: 'Вийти', home: 'На головну', theme: 'Змінити тему',
  },
  hero: {
    badgeLive: 'Дані оновлено щойно', badgeLoading: 'Під’єднуємось до метеомережі…',
    title: 'Погода, яку', titleAccent: 'видно',
    subtitle: 'Інтерактивна метеоплатформа: живі карти вітру й опадів, 20+ параметрів атмосфери та точний прогноз на 16 діб для будь-якої точки планети.',
    openDashboard: 'Відкрити кабінет', demoAccess: 'Демо-доступ',
    dragHint: 'Потягніть, щоб обертати',
    statDepth: 'глибина прогнозу', statParams: 'параметрів',
    statGrid: 'сітка моделі', statOpen: 'відкриті дані',
  },
  weather: {
    feelsLike: 'відчувається як', wind: 'Вітер', gusts: 'Пориви', humidity: 'Вологість',
    pressure: 'Тиск', uv: 'UV-індекс', precip: 'Опади', today: 'сьогодні', forecast: 'Прогноз',
    noDataHere: 'У самій точці спостережень немає — дані найближчої станції, за {{km}} км.',
  },
  favourite: {
    add: 'До обраного', added: 'В обраному',
    addAria: 'Додати {{city}} до обраного', removeAria: 'Прибрати {{city}} з обраного',
  },
  outfit: {
    title: 'Одягатор', basis: 'Набір зібрано за відчутною температурою {{temp}} °C',
    bothGenders: 'стать не вказана, показано обидва варіанти',
    slotOuter: 'Верхній одяг', slotMid: 'Середній шар', slotLegs: 'Низ',
    slotHead: 'Головний убір', slotShoes: 'Взуття', slotAccessory: 'Аксесуари',
  },
  indices: {
    title: 'Побутові індекси', subtitle: 'розраховані за поточним прогнозом',
    carWash: 'Автомийка', laundry: 'Сушіння білизни', petWalk: 'Вигул улюбленців',
  },
  extremes: {
    title: 'Мисливець за екстремумами', subtitle: 'де на планеті просто зараз межа',
    hot: 'Найспекотніше', cold: 'Найхолодніше', wind: 'Найвітряніше',
    hotHint: 'максимум температури', coldHint: 'мінімум температури', windHint: 'максимум поривів',
    idle: 'Натисніть кнопку — сервер опитає опорну мережу метеостанцій, а глобус плавно повернеться до знайденої точки.',
    scanning: 'Скануємо опорну мережу…', seeForecast: 'Дивитися прогноз', gridNode: 'вузол сітки',
  },
  space: {
    title: 'Погода в', titleAccent: 'космосі',
    subtitle: 'Вісім планет, у кожної — своя атмосфера, тиск і вітри. Кожен глобус обертається мишею.',
    solar: 'Сонячна активність', flares: 'Спалахи', storms: 'Геомагнітні бурі',
    live: 'live', fallback: 'резерв', allMetrics: 'Усі метрики',
    climate: 'Кліматичні пояси', spin: 'Повільне обертання', stopSpin: 'Зупинити',
    fullscreen: 'На весь екран', collapse: 'Згорнути',
    temperature: 'Температура', pressure: 'Атмосферний тиск', windSpeed: 'Швидкість вітру',
    composition: 'Склад атмосфери', openEarth: 'Відкрити земний глобус з картою міст',
  },
  auth: {
    welcomeBack: 'З поверненням', loginSubtitle: 'Увійдіть, щоб відкрити свій метеокабінет',
    email: 'Пошта', password: 'Пароль', signIn: 'Увійти', signUp: 'Створити акаунт',
    demoLogin: 'Увійти в демо-акаунт', noAccount: 'Немає акаунта?', register: 'Зареєструватися',
    or: 'або', withGoogle: 'Увійти через Google', withTelegram: 'Увійти через Telegram',
  },
  settings: {
    units: 'Одиниці вимірювання', metric: 'Метричні', imperial: 'Імперські',
    appearance: 'Оформлення', dark: 'Темна', light: 'Світла',
    gender: 'Стать для «Одягатора»',
    genderHint: 'Визначає, яка 3D-модель показується в доборі одягу. Якщо не вказано — виводяться обидві.',
    male: 'Чоловіча', female: 'Жіноча', unspecified: 'Не вказано',
    home: 'Домашня точка', language: 'Мова інтерфейсу',
  },
};

const en: Dictionary = {
  common: {
    appName: 'Aeris', tagline: 'weather intelligence', loading: 'Loading data',
    retry: 'Retry', close: 'Close', error: 'Failed to load', search: 'Find a city…',
    notFound: 'Nothing found — try a different spelling', myLocation: 'My location',
    language: 'Language',
  },
  nav: {
    features: 'Features', how: 'How it works', data: 'Data', space: 'Space weather',
    login: 'Sign in', start: 'Get started', toDashboard: 'Dashboard',
    overview: 'Overview', map: 'Map', locations: 'Locations', settings: 'Settings',
    logout: 'Sign out', home: 'Home', theme: 'Switch theme',
  },
  hero: {
    badgeLive: 'Data updated just now', badgeLoading: 'Connecting to the weather network…',
    title: 'Weather you can', titleAccent: 'see',
    subtitle: 'An interactive weather platform: live wind and precipitation maps, 20+ atmospheric parameters and a precise 16-day forecast for any point on the planet.',
    openDashboard: 'Open dashboard', demoAccess: 'Demo access',
    dragHint: 'Drag to rotate',
    statDepth: 'forecast depth', statParams: 'parameters',
    statGrid: 'model grid', statOpen: 'open data',
  },
  weather: {
    feelsLike: 'feels like', wind: 'Wind', gusts: 'Gusts', humidity: 'Humidity',
    pressure: 'Pressure', uv: 'UV index', precip: 'Precipitation', today: 'today',
    forecast: 'Forecast',
    noDataHere: 'No observations at this exact point — data from the nearest station, {{km}} km away.',
  },
  favourite: {
    add: 'Add to favourites', added: 'In favourites',
    addAria: 'Add {{city}} to favourites', removeAria: 'Remove {{city}} from favourites',
  },
  outfit: {
    title: 'Dresser', basis: 'Outfit built for a feels-like temperature of {{temp}} °C',
    bothGenders: 'gender not set, showing both options',
    slotOuter: 'Outerwear', slotMid: 'Mid layer', slotLegs: 'Bottoms',
    slotHead: 'Headwear', slotShoes: 'Footwear', slotAccessory: 'Accessories',
  },
  indices: {
    title: 'Everyday indices', subtitle: 'calculated from the current forecast',
    carWash: 'Car wash', laundry: 'Laundry drying', petWalk: 'Pet walking',
  },
  extremes: {
    title: 'Extreme hunter', subtitle: 'where the planet peaks right now',
    hot: 'Hottest', cold: 'Coldest', wind: 'Windiest',
    hotHint: 'temperature maximum', coldHint: 'temperature minimum', windHint: 'gust maximum',
    idle: 'Press a button — the server scans a reference network of weather stations and the globe smoothly turns to the point it finds.',
    scanning: 'Scanning the reference network…', seeForecast: 'View forecast', gridNode: 'grid node',
  },
  space: {
    title: 'Weather in', titleAccent: 'space',
    subtitle: 'Eight planets, each with its own atmosphere, pressure and winds. Every globe rotates with the mouse.',
    solar: 'Solar activity', flares: 'Flares', storms: 'Geomagnetic storms',
    live: 'live', fallback: 'fallback', allMetrics: 'All metrics',
    climate: 'Climate zones', spin: 'Slow rotation', stopSpin: 'Stop',
    fullscreen: 'Fullscreen', collapse: 'Collapse',
    temperature: 'Temperature', pressure: 'Atmospheric pressure', windSpeed: 'Wind speed',
    composition: 'Atmosphere composition', openEarth: 'Open the Earth globe with a city map',
  },
  auth: {
    welcomeBack: 'Welcome back', loginSubtitle: 'Sign in to open your weather dashboard',
    email: 'Email', password: 'Password', signIn: 'Sign in', signUp: 'Create account',
    demoLogin: 'Sign in to the demo account', noAccount: 'No account?', register: 'Register',
    or: 'or', withGoogle: 'Sign in with Google', withTelegram: 'Sign in with Telegram',
  },
  settings: {
    units: 'Units', metric: 'Metric', imperial: 'Imperial',
    appearance: 'Appearance', dark: 'Dark', light: 'Light',
    gender: 'Gender for the Dresser',
    genderHint: 'Controls which 3D model appears in the outfit picker. If unset, both are shown.',
    male: 'Male', female: 'Female', unspecified: 'Not set',
    home: 'Home location', language: 'Interface language',
  },
};

const de: Dictionary = {
  common: {
    appName: 'Aeris', tagline: 'weather intelligence', loading: 'Daten werden geladen',
    retry: 'Erneut versuchen', close: 'Schließen', error: 'Laden fehlgeschlagen',
    search: 'Stadt suchen…', notFound: 'Nichts gefunden — andere Schreibweise versuchen',
    myLocation: 'Mein Standort', language: 'Sprache',
  },
  nav: {
    features: 'Funktionen', how: 'So funktioniert es', data: 'Daten', space: 'Weltraumwetter',
    login: 'Anmelden', start: 'Loslegen', toDashboard: 'Zum Dashboard',
    overview: 'Übersicht', map: 'Karte', locations: 'Orte', settings: 'Einstellungen',
    logout: 'Abmelden', home: 'Zur Startseite', theme: 'Design wechseln',
  },
  hero: {
    badgeLive: 'Daten gerade aktualisiert', badgeLoading: 'Verbindung zum Wetternetz…',
    title: 'Wetter, das man', titleAccent: 'sieht',
    subtitle: 'Eine interaktive Wetterplattform: Live-Karten für Wind und Niederschlag, 20+ Atmosphärenparameter und eine präzise 16-Tage-Vorhersage für jeden Punkt der Erde.',
    openDashboard: 'Dashboard öffnen', demoAccess: 'Demo-Zugang',
    dragHint: 'Zum Drehen ziehen',
    statDepth: 'Vorhersagetiefe', statParams: 'Parameter',
    statGrid: 'Modellgitter', statOpen: 'offene Daten',
  },
  weather: {
    feelsLike: 'gefühlt wie', wind: 'Wind', gusts: 'Böen', humidity: 'Luftfeuchte',
    pressure: 'Luftdruck', uv: 'UV-Index', precip: 'Niederschlag', today: 'heute',
    forecast: 'Vorhersage',
    noDataHere: 'Keine Messungen an diesem Punkt — Daten der nächsten Station, {{km}} km entfernt.',
  },
  favourite: {
    add: 'Zu Favoriten', added: 'In Favoriten',
    addAria: '{{city}} zu Favoriten hinzufügen', removeAria: '{{city}} aus Favoriten entfernen',
  },
  outfit: {
    title: 'Ankleider', basis: 'Outfit für eine gefühlte Temperatur von {{temp}} °C',
    bothGenders: 'Geschlecht nicht angegeben, beide Varianten werden gezeigt',
    slotOuter: 'Oberbekleidung', slotMid: 'Mittlere Schicht', slotLegs: 'Unterteil',
    slotHead: 'Kopfbedeckung', slotShoes: 'Schuhe', slotAccessory: 'Accessoires',
  },
  indices: {
    title: 'Alltagsindizes', subtitle: 'aus der aktuellen Vorhersage berechnet',
    carWash: 'Autowäsche', laundry: 'Wäschetrocknen', petWalk: 'Gassi gehen',
  },
  extremes: {
    title: 'Extremwert-Jäger', subtitle: 'wo der Planet gerade an seine Grenze geht',
    hot: 'Am heißesten', cold: 'Am kältesten', wind: 'Am windigsten',
    hotHint: 'Temperaturmaximum', coldHint: 'Temperaturminimum', windHint: 'Böenmaximum',
    idle: 'Auf eine Schaltfläche drücken — der Server fragt ein Referenznetz von Wetterstationen ab und der Globus dreht sich sanft zum gefundenen Punkt.',
    scanning: 'Referenznetz wird abgefragt…', seeForecast: 'Vorhersage ansehen', gridNode: 'Gitterpunkt',
  },
  space: {
    title: 'Wetter im', titleAccent: 'Weltraum',
    subtitle: 'Acht Planeten, jeder mit eigener Atmosphäre, eigenem Druck und eigenen Winden. Jeder Globus lässt sich mit der Maus drehen.',
    solar: 'Sonnenaktivität', flares: 'Eruptionen', storms: 'Geomagnetische Stürme',
    live: 'live', fallback: 'Reserve', allMetrics: 'Alle Kennzahlen',
    climate: 'Klimazonen', spin: 'Langsame Rotation', stopSpin: 'Stoppen',
    fullscreen: 'Vollbild', collapse: 'Verkleinern',
    temperature: 'Temperatur', pressure: 'Luftdruck', windSpeed: 'Windgeschwindigkeit',
    composition: 'Atmosphärenzusammensetzung', openEarth: 'Erdglobus mit Städtekarte öffnen',
  },
  auth: {
    welcomeBack: 'Willkommen zurück', loginSubtitle: 'Melden Sie sich an, um Ihr Wetter-Dashboard zu öffnen',
    email: 'E-Mail', password: 'Passwort', signIn: 'Anmelden', signUp: 'Konto erstellen',
    demoLogin: 'Im Demo-Konto anmelden', noAccount: 'Kein Konto?', register: 'Registrieren',
    or: 'oder', withGoogle: 'Mit Google anmelden', withTelegram: 'Mit Telegram anmelden',
  },
  settings: {
    units: 'Einheiten', metric: 'Metrisch', imperial: 'Imperial',
    appearance: 'Darstellung', dark: 'Dunkel', light: 'Hell',
    gender: 'Geschlecht für den Ankleider',
    genderHint: 'Bestimmt, welches 3D-Modell in der Outfit-Auswahl erscheint. Ohne Angabe werden beide gezeigt.',
    male: 'Männlich', female: 'Weiblich', unspecified: 'Nicht angegeben',
    home: 'Heimatort', language: 'Oberflächensprache',
  },
};

const fr: Dictionary = {
  common: {
    appName: 'Aeris', tagline: 'weather intelligence', loading: 'Chargement des données',
    retry: 'Réessayer', close: 'Fermer', error: 'Échec du chargement',
    search: 'Rechercher une ville…', notFound: 'Aucun résultat — essayez une autre orthographe',
    myLocation: 'Ma position', language: 'Langue',
  },
  nav: {
    features: 'Fonctions', how: 'Comment ça marche', data: 'Données', space: 'Météo spatiale',
    login: 'Se connecter', start: 'Commencer', toDashboard: 'Tableau de bord',
    overview: 'Aperçu', map: 'Carte', locations: 'Lieux', settings: 'Paramètres',
    logout: 'Se déconnecter', home: 'Accueil', theme: 'Changer de thème',
  },
  hero: {
    badgeLive: 'Données mises à jour à l’instant', badgeLoading: 'Connexion au réseau météo…',
    title: 'La météo que l’on', titleAccent: 'voit',
    subtitle: 'Une plateforme météo interactive : cartes en direct du vent et des précipitations, plus de 20 paramètres atmosphériques et des prévisions précises à 16 jours pour tout point du globe.',
    openDashboard: 'Ouvrir le tableau de bord', demoAccess: 'Accès démo',
    dragHint: 'Faites glisser pour tourner',
    statDepth: 'profondeur de prévision', statParams: 'paramètres',
    statGrid: 'grille du modèle', statOpen: 'données ouvertes',
  },
  weather: {
    feelsLike: 'ressenti', wind: 'Vent', gusts: 'Rafales', humidity: 'Humidité',
    pressure: 'Pression', uv: 'Indice UV', precip: 'Précipitations', today: 'aujourd’hui',
    forecast: 'Prévisions',
    noDataHere: 'Aucune observation à ce point précis — données de la station la plus proche, à {{km}} km.',
  },
  favourite: {
    add: 'Ajouter aux favoris', added: 'Dans les favoris',
    addAria: 'Ajouter {{city}} aux favoris', removeAria: 'Retirer {{city}} des favoris',
  },
  outfit: {
    title: 'Habilleur', basis: 'Tenue composée pour une température ressentie de {{temp}} °C',
    bothGenders: 'genre non renseigné, les deux options sont affichées',
    slotOuter: 'Vêtement d’extérieur', slotMid: 'Couche intermédiaire', slotLegs: 'Bas',
    slotHead: 'Couvre-chef', slotShoes: 'Chaussures', slotAccessory: 'Accessoires',
  },
  indices: {
    title: 'Indices du quotidien', subtitle: 'calculés à partir des prévisions actuelles',
    carWash: 'Lavage auto', laundry: 'Séchage du linge', petWalk: 'Promenade animale',
  },
  extremes: {
    title: 'Chasseur d’extrêmes', subtitle: 'où la planète atteint sa limite en ce moment',
    hot: 'Le plus chaud', cold: 'Le plus froid', wind: 'Le plus venteux',
    hotHint: 'maximum de température', coldHint: 'minimum de température', windHint: 'maximum de rafales',
    idle: 'Appuyez sur un bouton — le serveur interroge un réseau de stations de référence et le globe pivote doucement vers le point trouvé.',
    scanning: 'Analyse du réseau de référence…', seeForecast: 'Voir les prévisions', gridNode: 'nœud de grille',
  },
  space: {
    title: 'La météo dans l’', titleAccent: 'espace',
    subtitle: 'Huit planètes, chacune avec son atmosphère, sa pression et ses vents. Chaque globe se tourne à la souris.',
    solar: 'Activité solaire', flares: 'Éruptions', storms: 'Orages géomagnétiques',
    live: 'live', fallback: 'secours', allMetrics: 'Toutes les mesures',
    climate: 'Zones climatiques', spin: 'Rotation lente', stopSpin: 'Arrêter',
    fullscreen: 'Plein écran', collapse: 'Réduire',
    temperature: 'Température', pressure: 'Pression atmosphérique', windSpeed: 'Vitesse du vent',
    composition: 'Composition de l’atmosphère', openEarth: 'Ouvrir le globe terrestre avec la carte des villes',
  },
  auth: {
    welcomeBack: 'Bon retour', loginSubtitle: 'Connectez-vous pour ouvrir votre tableau de bord météo',
    email: 'E-mail', password: 'Mot de passe', signIn: 'Se connecter', signUp: 'Créer un compte',
    demoLogin: 'Se connecter au compte démo', noAccount: 'Pas de compte ?', register: 'S’inscrire',
    or: 'ou', withGoogle: 'Se connecter avec Google', withTelegram: 'Se connecter avec Telegram',
  },
  settings: {
    units: 'Unités', metric: 'Métriques', imperial: 'Impériales',
    appearance: 'Apparence', dark: 'Sombre', light: 'Clair',
    gender: 'Genre pour l’Habilleur',
    genderHint: 'Détermine le modèle 3D affiché dans le choix de tenue. Sans indication, les deux sont montrés.',
    male: 'Masculin', female: 'Féminin', unspecified: 'Non renseigné',
    home: 'Lieu principal', language: 'Langue de l’interface',
  },
};

const es: Dictionary = {
  common: {
    appName: 'Aeris', tagline: 'weather intelligence', loading: 'Cargando datos',
    retry: 'Reintentar', close: 'Cerrar', error: 'No se pudo cargar',
    search: 'Buscar ciudad…', notFound: 'Sin resultados: prueba otra grafía',
    myLocation: 'Mi ubicación', language: 'Idioma',
  },
  nav: {
    features: 'Funciones', how: 'Cómo funciona', data: 'Datos', space: 'Meteorología espacial',
    login: 'Iniciar sesión', start: 'Empezar', toDashboard: 'Al panel',
    overview: 'Resumen', map: 'Mapa', locations: 'Ubicaciones', settings: 'Ajustes',
    logout: 'Cerrar sesión', home: 'Inicio', theme: 'Cambiar tema',
  },
  hero: {
    badgeLive: 'Datos actualizados ahora mismo', badgeLoading: 'Conectando con la red meteorológica…',
    title: 'El tiempo que se', titleAccent: 've',
    subtitle: 'Una plataforma meteorológica interactiva: mapas en vivo de viento y precipitación, más de 20 parámetros atmosféricos y un pronóstico preciso a 16 días para cualquier punto del planeta.',
    openDashboard: 'Abrir panel', demoAccess: 'Acceso demo',
    dragHint: 'Arrastra para girar',
    statDepth: 'profundidad del pronóstico', statParams: 'parámetros',
    statGrid: 'malla del modelo', statOpen: 'datos abiertos',
  },
  weather: {
    feelsLike: 'sensación de', wind: 'Viento', gusts: 'Rachas', humidity: 'Humedad',
    pressure: 'Presión', uv: 'Índice UV', precip: 'Precipitación', today: 'hoy',
    forecast: 'Pronóstico',
    noDataHere: 'No hay observaciones en este punto exacto: datos de la estación más cercana, a {{km}} km.',
  },
  favourite: {
    add: 'Añadir a favoritos', added: 'En favoritos',
    addAria: 'Añadir {{city}} a favoritos', removeAria: 'Quitar {{city}} de favoritos',
  },
  outfit: {
    title: 'Vestidor', basis: 'Conjunto armado para una sensación térmica de {{temp}} °C',
    bothGenders: 'género no indicado, se muestran ambas opciones',
    slotOuter: 'Abrigo', slotMid: 'Capa media', slotLegs: 'Parte inferior',
    slotHead: 'Sombrero', slotShoes: 'Calzado', slotAccessory: 'Accesorios',
  },
  indices: {
    title: 'Índices cotidianos', subtitle: 'calculados con el pronóstico actual',
    carWash: 'Lavado de coche', laundry: 'Secado de ropa', petWalk: 'Paseo de mascotas',
  },
  extremes: {
    title: 'Cazador de extremos', subtitle: 'dónde está el límite del planeta ahora mismo',
    hot: 'Lo más caluroso', cold: 'Lo más frío', wind: 'Lo más ventoso',
    hotHint: 'máximo de temperatura', coldHint: 'mínimo de temperatura', windHint: 'máximo de rachas',
    idle: 'Pulsa un botón: el servidor consulta una red de estaciones de referencia y el globo gira suavemente hacia el punto encontrado.',
    scanning: 'Explorando la red de referencia…', seeForecast: 'Ver pronóstico', gridNode: 'nodo de malla',
  },
  space: {
    title: 'El tiempo en el', titleAccent: 'espacio',
    subtitle: 'Ocho planetas, cada uno con su atmósfera, presión y vientos. Cada globo gira con el ratón.',
    solar: 'Actividad solar', flares: 'Fulguraciones', storms: 'Tormentas geomagnéticas',
    live: 'live', fallback: 'reserva', allMetrics: 'Todas las métricas',
    climate: 'Zonas climáticas', spin: 'Rotación lenta', stopSpin: 'Detener',
    fullscreen: 'Pantalla completa', collapse: 'Contraer',
    temperature: 'Temperatura', pressure: 'Presión atmosférica', windSpeed: 'Velocidad del viento',
    composition: 'Composición atmosférica', openEarth: 'Abrir el globo terráqueo con el mapa de ciudades',
  },
  auth: {
    welcomeBack: 'Bienvenido de nuevo', loginSubtitle: 'Inicia sesión para abrir tu panel meteorológico',
    email: 'Correo', password: 'Contraseña', signIn: 'Iniciar sesión', signUp: 'Crear cuenta',
    demoLogin: 'Entrar en la cuenta demo', noAccount: '¿Sin cuenta?', register: 'Registrarse',
    or: 'o', withGoogle: 'Entrar con Google', withTelegram: 'Entrar con Telegram',
  },
  settings: {
    units: 'Unidades', metric: 'Métricas', imperial: 'Imperiales',
    appearance: 'Apariencia', dark: 'Oscuro', light: 'Claro',
    gender: 'Género para el Vestidor',
    genderHint: 'Determina qué modelo 3D aparece en la selección de ropa. Sin indicar, se muestran ambos.',
    male: 'Masculino', female: 'Femenino', unspecified: 'Sin indicar',
    home: 'Ubicación principal', language: 'Idioma de la interfaz',
  },
};

export const RESOURCES: Record<LanguageCode, { translation: Dictionary }> = {
  ru: { translation: ru },
  uk: { translation: uk },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
};
