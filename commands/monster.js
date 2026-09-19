/**
 * !monster <nombre>
 *
 * Fuente de datos:
 *   utils/monsters_enhanced_complete.json
 *
 * IMPORTANTE:
 *   Este comando NO consulta Hakai Market.
 *   No usa axios.
 *   No usa Puppeteer.
 *   No depende de Internet.
 *
 * El JSON se carga una sola vez en memoria y después todas las consultas
 * se realizan directamente desde RAM.
 *
 * Búsqueda:
 *   - Exacta
 *   - Prefijo
 *   - Palabras
 *   - Coincidencia parcial
 *   - Typos sencillos
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_JSON = path.join(
  __dirname,
  '..',
  'utils',
  'monsters_enhanced_complete.json'
);

// Página de origen de los datos.
// Se utiliza únicamente como referencia al final del mensaje.
// Los datos NO se obtienen de aquí.
const DEFAULT_SITE_URL = 'https://hakaimarket.com/monsters/';

// false = no muestra porcentajes de loot.
// true  = muestra, por ejemplo: Sword [5.85%]
const SHOW_LOOT_CHANCE = false;

// ─────────────────────────────────────────────────────────────────────────────
// ELEMENTOS
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENTS = {
  physical: {
    emoji: '👊🏻',
    label: 'Physical',
  },

  earth: {
    emoji: '🌱',
    label: 'Earth',
  },

  fire: {
    emoji: '🔥',
    label: 'Fire',
  },

  death: {
    emoji: '💀',
    label: 'Death',
  },

  energy: {
    emoji: '⚡',
    label: 'Energy',
  },

  holy: {
    emoji: '✝️',
    label: 'Holy',
  },

  ice: {
    emoji: '❄️',
    label: 'Ice',
  },

  lifedrain: {
    emoji: '🩸',
    label: 'Life Drain',
  },

  manadrain: {
    emoji: '🔮',
    label: 'Mana Drain',
  },

  drown: {
    emoji: '🌊',
    label: 'Drown',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARMS
// ─────────────────────────────────────────────────────────────────────────────

const CHARM_ORDER = [
  ['physical', 'Wound'],
  ['earth', 'Poison'],
  ['ice', 'Freeze'],
  ['energy', 'Zap'],
  ['death', 'Curse'],
  ['fire', 'Enflame'],
  ['holy', 'Divine Wrath'],
];

// Respaldo por si algún monster no tiene charm_points.
const CHARM_POINTS = {
  harmless: 1,
  trivial: 5,
  easy: 15,
  medium: 25,
  hard: 50,
  challenging: 100,
};

const CHARM_KILLS = {
  harmless: 25,
  trivial: 250,
  easy: 500,
  medium: 1000,
  hard: 2500,
  challenging: 2500,
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function canon(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const SMALL_WORDS = new Set([
  'of',
  'the',
  'and',
  'in',
  'on',
]);

function titleCase(value) {
  return String(value ?? '')
    .split(' ')
    .map((word, index) => {
      if (!word) return word;

      if (index > 0 && SMALL_WORDS.has(word.toLowerCase())) {
        return word.toLowerCase();
      }

      return (
        word.charAt(0).toUpperCase() +
        word.slice(1)
      );
    })
    .join(' ');
}

function num(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const n = parseFloat(
    value.replace(/,/g, '')
  );

  return Number.isFinite(n) ? n : null;
}

function fmt(value, decimals = 1) {
  if (value == null) return null;

  return value.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGA LOCAL DEL JSON
// ─────────────────────────────────────────────────────────────────────────────
//
// Se carga UNA sola vez.
//
// Esto significa:
//
// Primera consulta:
//   disco → JSON.parse() → RAM
//
// Consultas siguientes:
//   RAM → resultado
//
// No existe ninguna petición HTTP.
// ─────────────────────────────────────────────────────────────────────────────

let MEM_INDEX = null;
let MEM_LOAD_PROMISE = null;

async function loadIndex() {
  if (MEM_INDEX) {
    return MEM_INDEX;
  }

  if (MEM_LOAD_PROMISE) {
    return MEM_LOAD_PROMISE;
  }

  MEM_LOAD_PROMISE = (async () => {
    try {
      if (!fs.existsSync(LOCAL_JSON)) {
        throw new Error(
          `No existe el archivo: ${LOCAL_JSON}`
        );
      }

      const text = await fs.promises.readFile(
        LOCAL_JSON,
        'utf8'
      );

      const data = JSON.parse(text);

      const index = buildIndex(data);

      MEM_INDEX = index;

      console.log(
        `📚 [monster] JSON local cargado: ${index.list.length} monsters`
      );

      return index;

    } catch (err) {
      console.log(
        `❌ [monster] Error cargando JSON local: ${err.message}`
      );

      throw err;

    } finally {
      MEM_LOAD_PROMISE = null;
    }
  })();

  return MEM_LOAD_PROMISE;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR ÍNDICE
// ─────────────────────────────────────────────────────────────────────────────

function buildIndex(data) {
  let arr;

  if (Array.isArray(data)) {
    arr = data;
  } else if (
    data &&
    typeof data === 'object'
  ) {
    const possibleArray = Object.values(data)
      .find(Array.isArray);

    arr = possibleArray || Object.values(data);
  } else {
    arr = [];
  }

  const list = [];
  const byNorm = new Map();

  for (const monster of arr) {
    if (
      !monster ||
      typeof monster.name !== 'string' ||
      !monster.name.trim()
    ) {
      continue;
    }

    const entry = {
      m: monster,
      name: monster.name,
      norm: norm(monster.name),
      slug: getMonsterSlug(monster),
    };

    list.push(entry);

    if (!byNorm.has(entry.norm)) {
      byNorm.set(entry.norm, entry);
    }
  }

  if (!list.length) {
    throw new Error(
      'El JSON no contiene monsters válidos'
    );
  }

  return {
    list,
    byNorm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SLUG / URL
// ─────────────────────────────────────────────────────────────────────────────

function getMonsterSlug(monster) {
  // Si el JSON tiene URL de Tibiopedia:
  //
  // https://tibiopedia.pl/monsters/Young_Goanna
  //
  // usamos directamente Young_Goanna.

  if (typeof monster.url === 'string') {
    const match = monster.url.match(
      /\/monsters\/([^/?#]+)/
    );

    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return slugify(monster.name);
}

function getMonsterUrl(monster) {
  // Siempre generamos la URL basada en el nombre del monstruo,
  // en minúsculas y con guiones.
  const slug = slugify(monster.name);
  return DEFAULT_SITE_URL + slug;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVENSHTEIN
// ─────────────────────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  if (a === b) return 0;

  const dp = Array.from(
    { length: b.length + 1 },
    (_, i) => i
  );

  for (let i = 1; i <= a.length; i++) {
    let previous = dp[0];

    dp[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const current = dp[j];

      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        previous +
          (a[i - 1] === b[j - 1] ? 0 : 1)
      );

      previous = current;
    }
  }

  return dp[b.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE DE BÚSQUEDA
// ─────────────────────────────────────────────────────────────────────────────

function score(entry, query, queryTokens) {
  const name = entry.norm;

  // Coincidencia exacta.
  if (name === query) {
    return 100;
  }

  // El nombre comienza con lo buscado.
  if (name.startsWith(query)) {
    return (
      80 -
      Math.min(
        name.length - query.length,
        20
      ) * 0.5
    );
  }

  const words = name.split(' ');

  // Todas las palabras buscadas comienzan alguna palabra
  // del nombre.
  if (
    queryTokens.every((token) =>
      words.some((word) =>
        word.startsWith(token)
      )
    )
  ) {
    return 65;
  }

  // Coincidencia parcial.
  if (name.includes(query)) {
    return 55;
  }

  // Typo sencillo.
  if (
    query.length >= 4 &&
    Math.abs(name.length - query.length) <= 3
  ) {
    const distance = levenshtein(
      name,
      query
    );

    if (
      distance <=
      Math.max(
        1,
        Math.floor(query.length / 4)
      )
    ) {
      return 40 - distance;
    }
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSCAR MONSTER
// ─────────────────────────────────────────────────────────────────────────────

function search(index, query) {
  const q = norm(query);

  if (!q) {
    return {
      best: null,
      score: 0,
      others: [],
    };
  }

  // Exacto.
  const exact = index.byNorm.get(q);

  if (exact) {
    return {
      best: exact,
      score: 100,
      others: [],
    };
  }

  const qTokens = q.split(' ');

  const ranked = index.list
    .map((entry) => ({
      entry,
      score: score(
        entry,
        q,
        qTokens
      ),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.name.length -
          b.entry.name.length
    );

  if (!ranked.length) {
    return {
      best: null,
      score: 0,
      others: [],
    };
  }

  return {
    best: ranked[0].entry,
    score: ranked[0].score,
    others: ranked
      .slice(1, 5)
      .map((item) => item.entry),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESISTENCIAS
// ─────────────────────────────────────────────────────────────────────────────

function parseResistances(monster) {
  if (
    !monster.resistances ||
    typeof monster.resistances !== 'object'
  ) {
    return {
      text: null,
      taken: [],
    };
  }

  const taken = [];

  for (
    const [key, value] of Object.entries(
      monster.resistances
    )
  ) {
    const resistance = num(value);

    if (resistance == null) {
      continue;
    }

    // El valor del JSON es la resistencia directa.
    // Ej: physical: 10 → 10% resistente
    //     energy: -5 → -5% (débil)
    //     fire: 0 → neutral
    //     holy: 100 → inmune
    taken.push({
      el: canon(key),
      value: resistance,
    });
  }

  // Ordenar por valor descendente (más resistente primero).
  taken.sort(
    (a, b) => b.value - a.value
  );

  return {
    text: null, // Ya no usamos text, construimos en buildMessage
    taken,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARM RECOMENDADO
// ─────────────────────────────────────────────────────────────────────────────

function recommendCharm(
  taken,
  health
) {
  if (!health) {
    return null;
  }

  let best = null;
  let bestValue = 0;

  for (
    const [element, charmName]
    of CHARM_ORDER
  ) {
    const found = taken.find(
      (item) =>
        item.el === element
    );

    // Buscamos el elemento con menor resistencia (más débil).
    // Si el valor es negativo, es más débil aún.
    if (
      found &&
      found.value < bestValue
    ) {
      bestValue = found.value;

      best = {
        el: element,
        name: charmName,
      };
    }
  }

  return best
    ? `${ELEMENTS[best.el].emoji} ${best.name}`
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DPS
// ─────────────────────────────────────────────────────────────────────────────

function parseDps(monster) {
  const total = num(monster.maxDPS);

  if (total == null) {
    return null;
  }

  const lines = Object.entries(
    monster.elementPercentages || {}
  )
    .map(([key, value]) => ({
      el: canon(key),
      pct: num(value),
    }))
    .filter(
      (item) =>
        item.pct != null &&
        item.pct > 0
    )
    .sort(
      (a, b) => b.pct - a.pct
    )
    .map(({ el, pct }) => {
      const info =
        ELEMENTS[el] || {
          emoji: '❔',
          label: titleCase(el),
        };

      return (
        `${info.emoji} ` +
        `${info.label} ` +
        `${fmt(pct)}%`
      );
    });

  return {
    total,
    lines,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOT
// ─────────────────────────────────────────────────────────────────────────────

function parseLoot(monster) {
  if (
    !Array.isArray(monster.loot) ||
    !monster.loot.length
  ) {
    return null;
  }

  const items = monster.loot
    .filter(
      (item) =>
        item &&
        item.name
    )
    .map((item) => {
      let output = titleCase(
        item.name
      );

      if (
        item.maxCount != null &&
        Number(item.maxCount) > 1
      ) {
        output +=
          ` (máx. ${item.maxCount})`;
      }

      if (
        SHOW_LOOT_CHANCE &&
        item.chance != null
      ) {
        output +=
          ` [${fmt(
            Number(item.chance) / 1000,
            2
          )}%]`;
      }

      return output;
    });

  // Mostrar TODOS los items, sin límite
  return items.join(', ');
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSEAR MONSTER
// ─────────────────────────────────────────────────────────────────────────────

function parseMonster(entry) {
  const monster = entry.m;

  const difficulty =
    monster.difficulty
      ? String(
          monster.difficulty
        ).toLowerCase()
      : null;

  const resistances =
    parseResistances(
      monster
    );

  const health =
    num(
      monster.health ??
      monster.maxHealth
    );

  // Clasificar resistencias
  const weak = [];
  const resistant = [];
  const immune = [];
  const neutral = [];

  for (const r of resistances.taken) {
    if (r.value < 0) {
      weak.push(r);
    } else if (r.value > 0 && r.value < 100) {
      resistant.push(r);
    } else if (r.value >= 100) {
      immune.push(r);
    } else if (r.value === 0) {
      neutral.push(r);
    }
  }

  return {
    name: entry.name,

    hp: health,

    exp: num(
      monster.experience
    ),

    armor: num(
      monster.armor
    ),

    mitigation:
      monster.mitigation != null
        ? typeof monster.mitigation ===
          'number'
          ? `${monster.mitigation}%`
          : String(
              monster.mitigation
            )
        : null,

    speed: num(
      monster.speed
    ),

    tags: [
      monster.class,
      monster.difficulty,
      monster.role,
    ]
      .filter(Boolean)
      .join(' • '),

    dps: parseDps(
      monster
    ),

    weak: weak.length ? weak : null,
    resistant: resistant.length ? resistant : null,
    immune: immune.length ? immune : null,

    charmRec:
      recommendCharm(
        resistances.taken,
        health
      ),

    respawn:
      Array.isArray(
        monster.respawn
      ) &&
      monster.respawn.length
        ? monster.respawn.join(
            ', '
          )
        : null,

    charmPts:
      num(
        monster.charm_points
      ) ??
      (
        difficulty
          ? CHARM_POINTS[
              difficulty
            ]
          : null
      ) ??
      null,

    kills:
      difficulty
        ? CHARM_KILLS[
            difficulty
          ] ?? null
        : null,

    loot:
      parseLoot(
        monster
      ),

    url:
      getMonsterUrl(
        monster
      ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR MENSAJE
// ─────────────────────────────────────────────────────────────────────────────

function buildMessage(monster) {
  const SEP = '━━━━━━━━━━━━━━━';
  let text = '';

  // ── Cabecera ──
  text += `👾 *${monster.name.toUpperCase()}*\n`;

  if (monster.tags) {
    text += `${monster.tags}\n`;
  }

  text += `\n${SEP}\n`;

  // ── Stats ──
  text += `📊 *Stats*\n`;

  const hp = monster.hp != null ? `❤️ HP: ${fmt(monster.hp, 0)}` : null;
  const exp = monster.exp != null ? `✨ XP: ${fmt(monster.exp, 0)}` : null;
  const armor = monster.armor != null ? `🛡️ Armadura: ${fmt(monster.armor, 0)}` : null;
  const speed = monster.speed != null ? `🏃 Vel: ${fmt(monster.speed, 0)}` : null;
  const mitigation = monster.mitigation ? `🧱 Mitigación: ${monster.mitigation}` : null;

  const statsLine1 = [hp, exp].filter(Boolean).join('        ');
  const statsLine2 = [armor, speed].filter(Boolean).join('    ');
  const statsLine3 = mitigation;

  if (statsLine1) text += `${statsLine1}\n`;
  if (statsLine2) text += `${statsLine2}\n`;
  if (statsLine3) text += `${statsLine3}\n`;

  // ── Daño ──
  if (monster.dps) {
    text += `\n💥 *Daño:*\n`;
    text += `Max DPS: ${fmt(monster.dps.total, 0)}\n`;
    if (monster.dps.lines.length) {
      text += monster.dps.lines.join(' | ') + '\n';
    }
  }

  // ── Charms ──
  if (monster.charmRec || monster.charmPts != null) {
    text += `\n🎯 *Charms:*\n`;
    if (monster.charmRec) {
      text += `🔮 Recomendado: ${monster.charmRec}\n`;
    }
    if (monster.charmPts != null) {
      let charmLine = `🎖️ Puntos: ${monster.charmPts}`;
      if (monster.kills != null) {
        charmLine += ` (${fmt(monster.kills, 0)} kills)`;
      }
      text += charmLine + '\n';
    }
  }

  text += `${SEP}\n`;

  // ── Resistencias ──
  const hasResistances = monster.weak || monster.resistant || monster.immune;
  if (hasResistances) {
    if (monster.weak) {
      text += `\n⚡ *Débil a:*\n`;
      for (const r of monster.weak) {
        const info = ELEMENTS[r.el] || { emoji: '❔', label: titleCase(r.el) };
        // Mostramos el valor absoluto porque es negativo en el JSON
        text += `${info.emoji} ${info.label} → ${Math.abs(r.value)}%\n`;
      }
    }

    if (monster.resistant) {
      text += `\n🛡️ *Resistente a:*\n`;
      for (const r of monster.resistant) {
        const info = ELEMENTS[r.el] || { emoji: '❔', label: titleCase(r.el) };
        text += `${info.emoji} ${info.label} → ${r.value}%\n`;
      }
    }

    if (monster.immune) {
      text += `\n🚫 *Inmune a:*\n`;
      for (const r of monster.immune) {
        const info = ELEMENTS[r.el] || { emoji: '❔', label: titleCase(r.el) };
        text += `${info.emoji} ${info.label}\n`;
      }
    }
  }

  // ── Ubicación ──
  if (monster.respawn) {
    text += `\n📍 *Ubicación:*\n`;
    text += `${monster.respawn}\n`;
  }

  // ── Loot ──
  if (monster.loot) {
    text += `\n🎁 *Loot:*\n`;
    text += `${monster.loot}\n`;
  }

  // ── URL ──
  if (monster.url) {
    text += `\n🔎 ${monster.url}`;
  }

  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR / FAIL
// ─────────────────────────────────────────────────────────────────────────────

async function fail(msg, text) {
  try {
    const errorMsg =
      await msg.reply(text);

    try {
      await errorMsg.react(
        '❎'
      );
    } catch {}

    try {
      await msg.react(
        '❎'
      );
    } catch {}

  } catch {}

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async (msg) => {
  try {
    const args =
      msg.body
        .trim()
        .split(/\s+/)
        .slice(1);

    if (!args.length) {
      return await fail(
        msg,
        '*Uso correcto:* `!monster <nombre>`\n' +
        'Ejemplo: `!monster young goanna`'
      );
    }

    const query =
      args.join(' ');

    // Cargar JSON local.
    const index =
      await loadIndex();

    // Buscar.
    const result =
      search(
        index,
        query
      );

    if (!result.best) {
      return await fail(
        msg,
        `Monster no encontrado: *${query}*`
      );
    }

    // Preparar información.
    const monster =
      parseMonster(
        result.best
      );

    let text =
      buildMessage(
        monster
      );

    // Coincidencia aproximada.
    if (
      result.score < 100
    ) {
      text =
        `_Resultado más cercano a "${query}"_\n\n` +
        text;

      if (
        result.others.length
      ) {
        text +=
          `\n\n🔁 ¿Quizás buscabas?: ` +
          result.others
            .map(
              (item) =>
                item.name
            )
            .join(', ');
      }
    }

    // Responder sin preview para que WhatsApp no intente
    // cargar la página de Hakai Market.
    return await msg.reply(
      text,
      undefined,
      {
        linkPreview: false,
      }
    );

  } catch (err) {
    console.log(
      `❌ [monster] ERROR: ${err.message}`
    );

    return await fail(
      msg,
      'No pude cargar la información del monster desde el JSON local.'
    );
  }
};
