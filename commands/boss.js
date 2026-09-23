/**
 * !boss <nombre>
 *
 * Fuente de datos:
 *   utils/bosses_enhanced_complete.json
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
 *
 * NOTA SOBRE LA URL:
 *   Hakai Market no publica una URL exclusiva para el Bosstiary: la propia
 *   web lista los bosses dentro de "Monsters" usando la pestaña
 *   ?tab=bosstiary (hakaimarket.com/monsters?tab=bosstiary), y las fichas
 *   de monsters individuales confirmadas (ej. hakaimarket.com/monsters/
 *   dragolisk) siguen el patrón /monsters/<slug>. Los bosses son monsters
 *   dentro de su base de datos, así que generamos la URL con el mismo
 *   patrón: DEFAULT_SITE_URL + slug(nombre). Si en el futuro detectas que
 *   un boss vive en otra ruta, solo hay que ajustar DEFAULT_SITE_URL /
 *   getBossUrl() aquí abajo.
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
  'bosses_enhanced_complete.json'
);

// Página de origen de los datos.
// Se utiliza únicamente como referencia al final del mensaje.
// Los datos NO se obtienen de aquí (ver nota arriba sobre el Bosstiary).
const DEFAULT_SITE_URL = 'https://hakaimarket.com/monsters/';

// false = no muestra porcentajes de loot.
// true  = muestra, por ejemplo: Sword [5.85%]
const SHOW_LOOT_CHANCE = false;

// true = muestra el valor promedio del loot (average_loot) cuando existe.
const SHOW_AVERAGE_LOOT = true;

// ─────────────────────────────────────────────────────────────────────────────
// ELEMENTOS (resistencias + tipos de ataque/habilidad de bosses)
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

  poison: {
    emoji: '☠️',
    label: 'Poison',
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

  healing: {
    emoji: '💚',
    label: 'Self-Healing',
  },

  summon: {
    emoji: '👹',
    label: 'Summon',
  },

  invisibility: {
    emoji: '👻',
    label: 'Invisibility',
  },

  paralyze: {
    emoji: '🐌',
    label: 'Paralyze',
  },

  drunkenness: {
    emoji: '🍺',
    label: 'Drunkenness',
  },

  hasted: {
    emoji: '💨',
    label: 'Haste',
  },

  shapeshifting: {
    emoji: '🔄',
    label: 'Shapeshifting',
  },

  bleeding: {
    emoji: '🩹',
    label: 'Bleeding',
  },

  debuff: {
    emoji: '⬇️',
    label: 'Debuff',
  },

  rooted: {
    emoji: '🌿',
    label: 'Rooted',
  },

  unknown: {
    emoji: '❔',
    label: 'Unknown',
  },
};

// Alias para nombres de "element" del JSON que no calzan 1:1 con las
// keys de ELEMENTS después de canon().
ELEMENTS.freezing = ELEMENTS.ice;
ELEMENTS.drowning = ELEMENTS.drown;

// ─────────────────────────────────────────────────────────────────────────────
// CHARMS (recomendación según debilidad, igual que en !monster)
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
        `📚 [boss] JSON local cargado: ${index.list.length} bosses`
      );

      return index;

    } catch (err) {
      console.log(
        `❌ [boss] Error cargando JSON local: ${err.message}`
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
    // bosses_enhanced_complete.json tiene forma { metadata: {...}, bosses: [...] }
    // Object.values(data).find(Array.isArray) encuentra "bosses" automáticamente.
    const possibleArray = Object.values(data)
      .find(Array.isArray);

    arr = possibleArray || Object.values(data);
  } else {
    arr = [];
  }

  const list = [];
  const byNorm = new Map();

  for (const boss of arr) {
    if (
      !boss ||
      typeof boss.name !== 'string' ||
      !boss.name.trim()
    ) {
      continue;
    }

    const entry = {
      b: boss,
      name: boss.name,
      norm: norm(boss.name),
      slug: slugify(boss.name),
    };

    list.push(entry);

    if (!byNorm.has(entry.norm)) {
      byNorm.set(entry.norm, entry);
    }
  }

  if (!list.length) {
    throw new Error(
      'El JSON no contiene bosses válidos'
    );
  }

  return {
    list,
    byNorm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// URL
// ─────────────────────────────────────────────────────────────────────────────

function getBossUrl(boss) {
  // Generamos la URL basada en el nombre del boss, en minúsculas y con
  // guiones, igual que hace !monster (ver nota al inicio del archivo).
  const slug = slugify(boss.name);
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
// BUSCAR BOSS
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

function parseResistances(boss) {
  if (
    !boss.resistances ||
    typeof boss.resistances !== 'object'
  ) {
    return {
      taken: [],
    };
  }

  const taken = [];

  for (
    const [key, value] of Object.entries(
      boss.resistances
    )
  ) {
    // El JSON guarda valores como "+35%" / "-5%" / "+0%".
    // num() ya soporta el signo y el símbolo "%" (parseFloat corta ahí).
    const resistance = num(value);

    if (resistance == null) {
      continue;
    }

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
// MAX DPS
// ─────────────────────────────────────────────────────────────────────────────

function parseMaxDps(raw) {
  if (raw == null) return null;

  const str = String(raw).trim();

  if (!str) return null;

  const n = num(str);

  // Pedido explícito: si es 0 (o no numérico), no se muestra.
  if (n == null || n <= 0) {
    return null;
  }

  // Si el valor original es un entero "limpio", lo formateamos con comas.
  // Si trae sufijos como "+" o "?" (valores mínimos / inciertos del
  // scraping), lo dejamos tal cual para no perder esa información.
  if (/^\d+$/.test(str)) {
    return fmt(n, 0);
  }

  return str;
}

// ─────────────────────────────────────────────────────────────────────────────
// ATAQUES / COMBATE
// ─────────────────────────────────────────────────────────────────────────────

function parseAttacks(boss) {
  const rawAttacks = Array.isArray(boss.attacks)
    ? boss.attacks
    : [];

  const lines = [];

  for (const attack of rawAttacks) {
    let desc = String(
      attack?.description ?? ''
    ).trim();

    if (!desc) continue;

    // Artefacto de scraping conocido: ataques marcados como "(does
    // nothing)" no aportan información real de daño/efecto.
    if (/does nothing/i.test(desc)) continue;

    // A veces el nombre del boss quedó pegado al final de la
    // descripción (artefacto del scraping). Lo recortamos.
    if (
      boss.name &&
      desc.endsWith(boss.name)
    ) {
      desc = desc
        .slice(0, desc.length - boss.name.length)
        .trim();
    }

    if (!desc) continue;

    const elKey = canon(attack?.element);
    const info =
      ELEMENTS[elKey] || {
        emoji: '❔',
        label: titleCase(attack?.element || 'Unknown'),
      };

    // Si la descripción es solo un rango de daño, ej. "(900-1100)",
    // anteponemos el nombre del elemento para que quede claro qué es.
    if (/^\(.+\)$/.test(desc)) {
      desc = `${info.label} ${desc}`;
    }

    lines.push(`${info.emoji} ${desc}`);
  }

  return {
    maxDps: parseMaxDps(boss.maxDPS),
    lines,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOT
// ─────────────────────────────────────────────────────────────────────────────

function parseLoot(boss) {
  if (
    !Array.isArray(boss.loot) ||
    !boss.loot.length
  ) {
    return null;
  }

  const items = boss.loot
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
// PARSEAR BOSS
// ─────────────────────────────────────────────────────────────────────────────

function parseBoss(entry) {
  const boss = entry.b;

  const resistances = parseResistances(boss);

  const health = num(boss.hp ?? boss.maxhealth);

  // Clasificar resistencias
  const weak = [];
  const resistant = [];
  const immune = [];

  for (const r of resistances.taken) {
    if (r.value < 0) {
      weak.push(r);
    } else if (r.value > 0 && r.value < 100) {
      resistant.push(r);
    } else if (r.value >= 100) {
      immune.push(r);
    }
  }

  const attacks = parseAttacks(boss);

  const sectionLabel =
    boss.section
      ? titleCase(boss.section)
      : null;

  const bossClass =
    boss.class && boss.class.trim().length > 1
      ? boss.class.trim()
      : null;

  return {
    name: entry.name,

    hp: health,

    exp: num(boss.exp),

    speed: num(boss.speed),

    tags: [
      bossClass,
      sectionLabel,
      boss.role,
    ]
      .filter(Boolean)
      .join(' • '),

    maxDps: attacks.maxDps,
    attackLines: attacks.lines,

    weak: weak.length ? weak : null,
    resistant: resistant.length ? resistant : null,
    immune: immune.length ? immune : null,

    charmRec: recommendCharm(
      resistances.taken,
      health
    ),

    bossPoints: boss.boss_points || null,
    killsNeeded: boss.kills || null,

    respawn:
      Array.isArray(boss.respawn)
        ? boss.respawn.join(', ') || null
        : (boss.respawn || null),

    loot: parseLoot(boss),

    averageLoot:
      SHOW_AVERAGE_LOOT && boss.average_loot != null
        ? fmt(num(boss.average_loot), 0)
        : null,

    url: getBossUrl(boss),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR MENSAJE
// ─────────────────────────────────────────────────────────────────────────────

function buildMessage(boss) {
  const SEP = '━━━━━━━━━━━━━━━';
  let text = '';

  // ── Cabecera ──
  text += `👹 *${titleCase(boss.name)}*\n`;

  if (boss.tags) {
    text += `${boss.tags}\n`;
  }

  text += `\n${SEP}\n`;

  // ── Stats ──
  text += `📊 *Stats*\n`;

  const hp = boss.hp != null ? `❤️ HP: ${fmt(boss.hp, 0)}` : null;
  const exp = boss.exp != null ? `✨ XP: ${fmt(boss.exp, 0)}` : null;
  const speed = boss.speed != null ? `🏃 Vel: ${fmt(boss.speed, 0)}` : null;

  const statsLine1 = [hp, exp].filter(Boolean).join('        ');
  const statsLine2 = speed;

  if (statsLine1) text += `${statsLine1}\n`;
  if (statsLine2) text += `${statsLine2}\n`;

  // ── Ataques y combate ──
  if (boss.maxDps || boss.attackLines.length) {
    text += `\n⚔️ *Ataques:*\n`;

    if (boss.maxDps) {
      text += `Max DPS: ${boss.maxDps}\n`;
    }

    if (boss.attackLines.length) {
      text += boss.attackLines.join('\n') + '\n';
    }
  }

  // ── Bosstiary (Boss Points / Kills) ──
  if (boss.bossPoints || boss.killsNeeded) {
    text += `\n🏅 *Bosstiary:*\n`;

    if (boss.bossPoints) {
      text += `🏆 Puntos: ${boss.bossPoints}\n`;
    }

    if (boss.killsNeeded) {
      text += `🎯 Muertes necesarias: ${boss.killsNeeded}\n`;
    }
  }

  // ── Charm recomendado ──
  if (boss.charmRec) {
    text += `\n🔮 *Charm recomendado:* ${boss.charmRec}\n`;
  }

  text += `${SEP}\n`;

  // ── Resistencias ──
  const hasResistances = boss.weak || boss.resistant || boss.immune;
  if (hasResistances) {
    if (boss.weak) {
      text += `\n⚡ *Débil a:*\n`;
      for (const r of boss.weak) {
        const info = ELEMENTS[r.el] || { emoji: '❔', label: titleCase(r.el) };
        // Mostramos el valor absoluto porque es negativo en el JSON
        text += `${info.emoji} ${info.label} → ${Math.abs(r.value)}%\n`;
      }
    }

    if (boss.resistant) {
      text += `\n🛡️ *Resistente a:*\n`;
      for (const r of boss.resistant) {
        const info = ELEMENTS[r.el] || { emoji: '❔', label: titleCase(r.el) };
        text += `${info.emoji} ${info.label} → ${r.value}%\n`;
      }
    }

    if (boss.immune) {
      text += `\n🚫 *Inmune a:*\n`;
      for (const r of boss.immune) {
        const info = ELEMENTS[r.el] || { emoji: '❔', label: titleCase(r.el) };
        text += `${info.emoji} ${info.label}\n`;
      }
    }
  }

  // ── Ubicación ──
  if (boss.respawn) {
    text += `\n📍 *Ubicación:*\n`;
    text += `${boss.respawn}\n`;
  }

  // ── Loot ──
  if (boss.loot) {
    text += `\n🎁 *Loot:*\n`;
    text += `${boss.loot}\n`;

    if (boss.averageLoot) {
      text += `💰 Valor promedio: ~${boss.averageLoot} gp\n`;
    }
  }

  // ── URL ──
  if (boss.url) {
    text += `\n🔎 ${boss.url}`;
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
        '*Uso correcto:* `!boss <nombre>`\n' +
        'Ejemplo: `!boss bakragore`'
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
        `Boss no encontrado: *${query}*`
      );
    }

    // Preparar información.
    const boss =
      parseBoss(
        result.best
      );

    let text =
      buildMessage(
        boss
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
      `❌ [boss] ERROR: ${err.message}`
    );

    return await fail(
      msg,
      'No pude cargar la información del boss desde el JSON local.'
    );
  }
};
