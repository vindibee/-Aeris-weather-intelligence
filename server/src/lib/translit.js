/**
 * The Open-Meteo geocoding index only accepts latin queries, but our users type
 * in Russian/Ukrainian. We transliterate and also keep a small alias table for
 * cities whose latin spelling differs from a naive transliteration.
 */

const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'i', і: 'i', ї: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(s);

export function transliterate(input) {
  let out = '';
  for (const ch of input.toLowerCase()) {
    out += MAP[ch] !== undefined ? MAP[ch] : ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

const ALIASES = {
  киев: 'Kyiv', київ: 'Kyiv', одесса: 'Odesa', одеса: 'Odesa',
  львов: 'Lviv', львів: 'Lviv', харьков: 'Kharkiv', харків: 'Kharkiv',
  днепр: 'Dnipro', дніпро: 'Dnipro', запорожье: 'Zaporizhzhia',
  николаев: 'Mykolaiv', херсон: 'Kherson', винница: 'Vinnytsia',
  житомир: 'Zhytomyr', полтава: 'Poltava', черкассы: 'Cherkasy',
  чернигов: 'Chernihiv', ужгород: 'Uzhhorod', ровно: 'Rivne',
  ивано: 'Ivano-Frankivsk', тернополь: 'Ternopil', луцк: 'Lutsk',
  сумы: 'Sumy', кривой: 'Kryvyi Rih', мариуполь: 'Mariupol',
  москва: 'Moscow', 'санкт-петербург': 'Saint Petersburg', питер: 'Saint Petersburg',
  екатеринбург: 'Yekaterinburg', новосибирск: 'Novosibirsk', казань: 'Kazan',
  сочи: 'Sochi', владивосток: 'Vladivostok', минск: 'Minsk', варшава: 'Warsaw',
  берлин: 'Berlin', париж: 'Paris', лондон: 'London', рим: 'Rome', мадрид: 'Madrid',
  барселона: 'Barcelona', прага: 'Prague', вена: 'Vienna', амстердам: 'Amsterdam',
  стамбул: 'Istanbul', дубай: 'Dubai', токио: 'Tokyo', пекин: 'Beijing',
  сеул: 'Seoul', сингапур: 'Singapore', бангкок: 'Bangkok', дели: 'Delhi',
  'нью-йорк': 'New York City', лос: 'Los Angeles', 'лос-анджелес': 'Los Angeles',
  чикаго: 'Chicago', майами: 'Miami', торонто: 'Toronto', сидней: 'Sydney',
  рейкьявик: 'Reykjavik', осло: 'Oslo', стокгольм: 'Stockholm', хельсинки: 'Helsinki',
  копенгаген: 'Copenhagen', афины: 'Athens', лиссабон: 'Lisbon', каир: 'Cairo',
  тбилиси: 'Tbilisi', ереван: 'Yerevan', баку: 'Baku', алматы: 'Almaty',
  ташкент: 'Tashkent', кишинев: 'Chisinau', будапешт: 'Budapest', бухарест: 'Bucharest',
  софия: 'Sofia', белград: 'Belgrade', загреб: 'Zagreb', братислава: 'Bratislava',
  рига: 'Riga', вильнюс: 'Vilnius', таллин: 'Tallinn', милан: 'Milan',
  венеция: 'Venice', мюнхен: 'Munich', цюрих: 'Zurich', женева: 'Geneva',
  брюссель: 'Brussels', дублин: 'Dublin', эдинбург: 'Edinburgh',
};

// Latin spellings the upstream index resolves badly on their own.
const LATIN_FIXES = {
  'new york': 'New York City', 'ny': 'New York City', 'nyc': 'New York City',
  'kiev': 'Kyiv', 'odessa': 'Odesa',
};

/** Ordered list of query variants to try upstream (first hit wins). */
export function queryVariants(raw) {
  const q = raw.trim();
  const variants = [];
  if (!hasCyrillic(q)) {
    const fix = LATIN_FIXES[q.toLowerCase()];
    if (fix) variants.push(fix);
    variants.push(q);
  } else {
    const alias = ALIASES[q.toLowerCase()];
    if (alias) variants.push(alias);
    const t = transliterate(q);
    if (t && !variants.includes(t)) variants.push(t);
    // Nominative endings often break the index: "Одессе" -> "Одесс" -> "odess".
    if (t.length > 4) {
      const trimmed = t.slice(0, -1);
      if (!variants.includes(trimmed)) variants.push(trimmed);
    }
  }
  return variants.filter(Boolean).slice(0, 3);
}
