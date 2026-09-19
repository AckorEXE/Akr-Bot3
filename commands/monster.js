/**
 * !monster <nombre>
 * Fuente: https://hakaimarket.com/monsters_enhanced_complete.json
 *
 * - El JSON se descarga solo (no tienes que hacer nada) y se guarda en MEMORIA
 *   por 6 horas. Ya no se escribe nada en disco.
 * - Varias consultas simultáneas = 1 sola descarga.
 * - Si la web falla y ya había datos, usa los que tenía (no rompe el comando).
 * - Búsqueda tolerante: exacta, prefijo, palabras sueltas y typos.
 */

const fs    = require('fs');
const path  = require('path');
const axios = require('axios');   // el mismo que usan !rwar y demás comandos

// ───────────────────────── Configuración ─────────────────────────
const DATA_URL      = 'https://hakaimarket.com/monsters_enhanced_complete.json';
const SITE_URL      = 'https://hakaimarket.com/monsters/';
const CACHE_FILE    = path.join(__dirname, '..', '.cache', 'hakai_monsters.json'); // raíz del bot/.cache/
const CACHE_TTL     = 6 * 60 * 60 * 1000;   // datos "frescos" por 6 horas
const FETCH_TIMEOUT = 15000;

// Tiempos de espera tras un error (para NO insistirle al servidor)
const WAIT_RATE_LIMIT = 10 * 60 * 1000;     // HTTP 429 sin Retry-After
const WAIT_OTHER      = 60 * 1000;          // cualquier otro error
const WAIT_MAX        = 60 * 60 * 1000;     // tope si el servidor pide esperar más

const LOOT_MAX         = 25;     // máximo de items de loot a mostrar
const SHOW_LOOT_CHANCE = false;  // true => "Sabre [5.85%]"

// ───────────────────────── Tablas ─────────────────────────
const ELEMENTS = {
  physical:  { emoji: '👊🏻', label: 'Physical'   },
  earth:     { emoji: '🌱', label: 'Earth'      },
  fire:      { emoji: '🔥', label: 'Fire'       },
  death:     { emoji: '💀', label: 'Death'      },
  energy:    { emoji: '⚡', label: 'Energy'     },
  holy:      { emoji: '✝️', label: 'Holy'       },
  ice:       { emoji: '❄️', label: 'Ice'        },
  lifedrain: { emoji: '🩸', label: 'Life Drain' },
  manadrain: { emoji: '🔮', label: 'Mana Drain' },
  drown:     { emoji: '🌊', label: 'Drown'      },
};

// Charms ofensivos, en el MISMO orden que usa Hakai Market (BossesPage.js, constante M).
// El orden importa: en empate gana el primero de la lista.
const CHARM_ORDER = [
  ['physical', 'Wound'],
  ['earth',    'Poison'],
  ['ice',      'Freeze'],
  ['energy',   'Zap'],
  ['death',    'Curse'],
  ['fire',     'Enflame'],
  ['holy',     'Divine Wrath'],
];

// Respaldo por si algún monster no trae charm_points
const CHARM_POINTS = { harmless: 1,  trivial: 5,   easy: 15,  medium: 25,   hard: 50   };
const CHARM_KILLS  = { harmless: 25, trivial: 250, easy: 500, medium: 1000, hard: 2500 };

// ───────────────────────── Utilidades ─────────────────────────
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// "Spellweaver's Robe" -> "spellweavers-robe"
const slugify = (s) =>
  String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// "life_drain" / "Life Drain" / "lifedrain" -> "lifedrain"
const canon = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

const SMALL = new Set(['of', 'the', 'and', 'in', 'on']);
const titleCase = (s) =>
  String(s)
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

const fmt = (n, dec = 1) =>
  n == null ? null : n.toLocaleString('en-US', { maximumFractionDigits: dec });

// ───────────────────────── Datos: descarga + caché (memoria y disco) ─────────────────────────
// ── Descarga #1 (principal): desde el navegador embebido de whatsapp-web.js ──────────
// Mismo método que utils/rubinotApi.js (!rchar, !rguild): abrir una pestaña real en
// client.pupBrowser en vez de una petición "cruda" con axios, para pasar las
// protecciones anti-bot del sitio.
const PAGE_URL       = 'https://hakaimarket.com/monsters';
const JSON_NAME      = 'monsters_enhanced_complete.json';
const BROWSER_UA     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NAV_TIMEOUT    = 30000;
const CHALLENGE_WAIT = 5000;   // si el sitio muestra una verificación, espera a que se resuelva sola
const CAPTURE_WAIT   = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const looksValid = (d) => !!d && typeof d === 'object' && (Array.isArray(d) ? d.length > 0 : Object.keys(d).length > 0);

async function downloadViaBrowser(client) {
  const page = await client.pupBrowser.newPage();
  let lastStatus = 0;

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
    await page.setUserAgent(BROWSER_UA);

    // Estrategia 1: abrir el JSON directamente, como lo haría una pestaña normal
    try {
      const res = await page.goto(DATA_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      lastStatus = res ? res.status() : 0;

      if (res && res.ok()) {
        const data = await res.json().catch(() => null);
        if (looksValid(data)) return data;
      }

      // Puede ser una página de verificación que se resuelve sola y recarga: esperar y leer el cuerpo
      await sleep(CHALLENGE_WAIT);
      const text = await page.evaluate(() => (document.body ? document.body.innerText : ''));
      const data = JSON.parse(text);
      if (looksValid(data)) return data;
    } catch { /* pasa a la estrategia 2 */ }

    // Estrategia 2: cargar la página /monsters e interceptar el JSON que ella misma pide
    let captured = null;
    page.on('response', async (response) => {
      if (!response.url().includes(JSON_NAME)) return;
      try { captured = await response.json(); } catch {}
    });
    const nav = await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
    if (nav && nav.status() >= 400) lastStatus = nav.status();
    if (!captured) await sleep(CAPTURE_WAIT);
    if (looksValid(captured)) return captured;

    throw lastStatus >= 400 ? httpError(lastStatus) : new Error('El navegador no obtuvo el JSON');
  } finally {
    try { await page.close(); } catch {}
  }
}

// ── Descarga #2 (respaldo): axios, solo si no hay navegador o éste falló sin ser 429 ──
const HEADERS = {
  'Accept': '*/*',
  'Referer': 'https://hakaimarket.com/monsters',
  'User-Agent': BROWSER_UA,
};

function httpError(status, retryAfterHeader) {
  const err = new Error(`HTTP ${status}`);
  err.status = status;
  const secs = parseInt(retryAfterHeader, 10);
  if (Number.isFinite(secs) && secs > 0) err.retryAfter = secs * 1000;
  return err;
}

async function downloadViaAxios() {
  const r = await axios.get(DATA_URL, {
    headers: HEADERS,
    timeout: FETCH_TIMEOUT,
    validateStatus: () => true,      // manejamos el status nosotros (429, etc.)
  });
  if (r.status < 200 || r.status >= 300) throw httpError(r.status, r.headers['retry-after']);
  return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
}

async function download(client) {
  if (client && client.pupBrowser) {
    try {
      return await downloadViaBrowser(client);
    } catch (err) {
      console.log('⚠️ Navegador no pudo obtener el JSON:', err.message);
      if (err.status === 429) throw err;   // ya nos limitaron: no insistir con axios
    }
  }
  return downloadViaAxios();
}

// Copia en disco: el JSON tal cual, y su fecha de modificación = fecha de descarga.
// Así, reiniciar el bot NO vuelve a pedirle nada a Hakai mientras la copia sea reciente.
async function readDisk() {
  try {
    const [st, txt] = await Promise.all([fs.promises.stat(CACHE_FILE), fs.promises.readFile(CACHE_FILE, 'utf8')]);
    return { data: JSON.parse(txt), ts: st.mtimeMs };
  } catch {
    return null;
  }
}

async function writeDisk(data) {
  try {
    await fs.promises.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.promises.writeFile(CACHE_FILE, JSON.stringify(data));
  } catch { /* opcional */ }
}

function buildIndex(data) {
  const arr = Array.isArray(data)
    ? data
    : Object.values(data).find(Array.isArray) || Object.values(data);

  const list = [];
  const byNorm = new Map();
  for (const m of arr) {
    if (!m || typeof m.name !== 'string') continue;
    const e = { m, name: m.name, norm: norm(m.name), slug: slugify(m.name) };
    list.push(e);
    if (!byNorm.has(e.norm)) byNorm.set(e.norm, e);
  }
  if (!list.length) throw new Error('JSON sin monsters');
  return { list, byNorm };
}

let mem = { index: null, ts: 0 };
let inflight = null;
let blockedUntil = 0;     // no intentar descargar antes de esta hora
let lastError = null;

/** Minutos que faltan para poder reintentar (para el mensaje al usuario). */
const waitMinutes = () => Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000));

function loadIndex(client) {
  if (mem.index && Date.now() - mem.ts < CACHE_TTL) return Promise.resolve(mem.index);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      // 1) Sin datos en memoria (bot recién iniciado): intenta la copia en disco
      if (!mem.index) {
        const disk = await readDisk();
        if (disk) {
          try { mem = { index: buildIndex(disk.data), ts: disk.ts }; } catch { /* copia dañada: se ignora */ }
          if (mem.index && Date.now() - mem.ts < CACHE_TTL) return mem.index;
        }
      }

      // 2) En "castigo" por un error reciente: no volver a molestar al servidor
      if (Date.now() < blockedUntil) {
        if (mem.index) return mem.index;   // datos viejos > nada
        throw lastError;
      }

      // 3) Descargar
      try {
        const data = await download(client);
        mem = { index: buildIndex(data), ts: Date.now() };
        blockedUntil = 0;
        lastError = null;
        writeDisk(data);
      } catch (err) {
        const wait = Math.min(err.retryAfter ?? (err.status === 429 ? WAIT_RATE_LIMIT : WAIT_OTHER), WAIT_MAX);
        blockedUntil = Date.now() + wait;
        lastError = err;
        console.log(`⚠️ Hakai JSON no disponible: ${err.message}. Sin reintentar por ${Math.round(wait / 60000)} min.`);
        if (!mem.index) throw err;
      }
      return mem.index;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// ───────────────────────── Búsqueda ─────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function score(e, q, qTokens) {
  const n = e.norm;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80 - Math.min(n.length - q.length, 20) * 0.5;

  const words = n.split(' ');
  if (qTokens.every((t) => words.some((w) => w.startsWith(t)))) return 65;
  if (n.includes(q)) return 55;

  if (q.length >= 4 && Math.abs(n.length - q.length) <= 3) {
    const d = levenshtein(n, q);
    if (d <= Math.max(1, Math.floor(q.length / 4))) return 40 - d;
  }
  return 0;
}

function search(index, query) {
  const q = norm(query);
  if (!q) return { best: null, others: [] };

  const exact = index.byNorm.get(q);
  if (exact) return { best: exact, score: 100, others: [] };

  const qTokens = q.split(' ');
  const ranked = index.list
    .map((e) => ({ e, s: score(e, q, qTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.length - b.e.name.length);

  if (!ranked.length) return { best: null, others: [] };
  return { best: ranked[0].e, score: ranked[0].s, others: ranked.slice(1, 5).map((x) => x.e) };
}

// ───────────────────────── Parsers (campos reales del JSON) ─────────────────────────

/**
 * "resistances": { "Fire": "-10%", "Physical": "+5%", "Death": "+30%" }
 * Resistencia +5% => recibe 95% del daño; -10% => recibe 110%.
 */
function parseResistances(m) {
  if (!m.resistances || typeof m.resistances !== 'object') return { text: null, taken: [] };

  const taken = [];
  for (const [k, v] of Object.entries(m.resistances)) {
    const r = num(v);
    if (r == null) continue;
    taken.push({ el: canon(k), value: 100 - r });
  }
  taken.sort((a, b) => b.value - a.value);   // sort estable: mantiene el orden del JSON en empates

  const text = taken.length
    ? taken
        .map(({ el, value }) => {
          const info = ELEMENTS[el] || { emoji: '❔', label: el };
          const line = `${info.emoji} ${info.label.toLowerCase()}: ${fmt(value)}%`;
          return value > 100 ? `*${line}*` : line;
        })
        .join('\n')
    : null;

  return { text, taken };
}

/**
 * Charm recomendado: réplica de la lógica de la web.
 * Para cada charm ofensivo calcula  chance * damagePercent * vida * multiplicador,
 * donde el multiplicador es el daño que el monster recibe de ese elemento
 * (+5% resist => 0.95, -10% => 1.10). Como chance, damagePercent y vida son iguales
 * para todos los charms, gana el elemento donde más daño recibe; en empate, el primero
 * de CHARM_ORDER. Siempre recomienda uno si hay vida y al menos una resistencia.
 */
function recommendCharm(taken, health) {
  if (!health) return null;
  let best = null;
  let bestValue = 0;
  for (const [el, name] of CHARM_ORDER) {
    const t = taken.find((x) => x.el === el);
    if (t && t.value > bestValue) {          // ">" estricto, igual que la web
      bestValue = t.value;
      best = { el, name };
    }
  }
  return best ? `${ELEMENTS[best.el].emoji} ${best.name}` : null;
}

/** "maxDPS": 1545, "elementPercentages": { "physical": 78.5, "life_drain": 21.5 } */
function parseDps(m) {
  const total = num(m.maxDPS);
  if (total == null) return null;

  const lines = Object.entries(m.elementPercentages || {})
    .map(([k, v]) => ({ el: canon(k), pct: num(v) }))
    .filter((x) => x.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .map(({ el, pct }) => {
      const info = ELEMENTS[el] || { emoji: '❔', label: titleCase(el) };
      return `   ${info.emoji} ${info.label} ${fmt(pct)}%`;
    });

  return { total, lines };
}

/** "loot": [{ name, chance (sobre 100000), maxCount, rarity }] */
function parseLoot(m) {
  if (!Array.isArray(m.loot) || !m.loot.length) return null;

  const items = m.loot
    .filter((i) => i && i.name)
    .map((i) => {
      let out = titleCase(i.name);
      if (i.maxCount > 1) out += ` (máx. ${i.maxCount})`;
      if (SHOW_LOOT_CHANCE && i.chance != null) out += ` [${fmt(i.chance / 1000, 2)}%]`;
      return out;
    });

  const shown = items.slice(0, LOOT_MAX).join(', ');
  return items.length > LOOT_MAX ? `${shown} (+${items.length - LOOT_MAX} más)` : shown;
}

function parseMonster(e) {
  const m = e.m;
  const diff = m.difficulty ? String(m.difficulty).toLowerCase() : null;
  const res = parseResistances(m);

  return {
    name:       e.name,
    hp:         num(m.health ?? m.maxHealth),   // OJO: "hp" del JSON trae la experiencia, la vida real es "health"
    exp:        num(m.experience),
    armor:      num(m.armor),
    mitigation: m.mitigation != null ? (typeof m.mitigation === 'number' ? `${m.mitigation}%` : String(m.mitigation)) : null,
    speed:      num(m.speed),
    tags:       [m.class, m.difficulty, m.role].filter(Boolean).join(' • '),
    dps:        parseDps(m),
    resist:     res.text,
    charmRec:   recommendCharm(res.taken, num(m.health ?? m.maxHealth)),
    respawn:    Array.isArray(m.respawn) && m.respawn.length ? m.respawn.join(', ') : null,
    charmPts:   num(m.charm_points) ?? (diff ? CHARM_POINTS[diff] : null) ?? null,
    kills:      diff ? CHARM_KILLS[diff] ?? null : null,
    loot:       parseLoot(m),
  };
}

// ───────────────────────── Mensaje ─────────────────────────
function buildMessage(s, slug) {
  let t = `👾 *${s.name}*\n`;
  if (s.tags) t += `🏷️ ${s.tags}\n`;
  t += '\n';

  if (s.hp  != null) t += `❤️ *Vida:* ${fmt(s.hp, 0)}\n`;
  if (s.exp != null) t += `✨ *Experiencia:* ${fmt(s.exp, 0)}\n`;
  if (s.armor != null)  t += `🛡️ *Armadura:* ${fmt(s.armor, 0)}\n`;
  if (s.mitigation)     t += `🧱 *Mitigación:* ${s.mitigation}\n`;
  if (s.speed != null)  t += `👟 *Velocidad:* ${fmt(s.speed, 0)}\n`;

  if (s.dps) {
    t += `\n💥 *Max DPS:* ${fmt(s.dps.total, 0)}\n`;
    if (s.dps.lines.length) t += s.dps.lines.join('\n') + '\n';
  }

  if (s.resist) t += `\n🛡️ *Debilidades:*\n${s.resist}\n`;

  if (s.respawn) t += `\n📍 *Respawn:* ${s.respawn}\n`;

  if (s.charmPts != null) t += `\n🎯 *Puntos de charms:* ${s.charmPts}\n`;
  if (s.kills    != null) t += `📊 *Muertes para desbloquear:* ${fmt(s.kills, 0)}\n`;
  if (s.charmRec)         t += `🔮 *Charm recomendado:* ${s.charmRec}\n`;

  if (s.loot) t += `\n🎁 *Loot:* ${s.loot}\n`;

  t += `\n🔎 ${SITE_URL}${slug}`;
  return t;
}

async function fail(msg, text) {
  const errorMsg = await msg.reply(text);
  await errorMsg.react('❎');
  await msg.react('❎');
  return null;
}

// ───────────────────────── Handler ─────────────────────────
module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    if (!args.length) {
      return await fail(msg, '*Uso correcto:* `!monster <nombre>`\nEjemplo: `!monster orclops bloodbreaker`');
    }

    const query = args.join(' ');

    let index;
    try {
      index = await loadIndex(msg.client);
    } catch (err) {
      console.log('❌ No se pudo cargar el JSON:', err.message);
      if (err.status === 429) {
        return await fail(msg, `Hakai Market está limitando las consultas. Intenta de nuevo en ~${waitMinutes()} min.`);
      }
      return await fail(msg, 'No pude obtener los datos de Hakai Market. Intenta de nuevo en un momento.');
    }

    const { best, score: sc, others } = search(index, query);
    if (!best) return await fail(msg, 'Monster no encontrado.');

    let text = buildMessage(parseMonster(best), best.slug);

    // Coincidencia aproximada: avisamos y sugerimos alternativas
    if (sc < 100) {
      text = `_Resultado más cercano a "${query}"_\n\n${text}`;
      if (others.length) text += `\n\n🔁 ¿Quizás buscabas?: ${others.map((o) => o.name).join(', ')}`;
    }

    return await msg.reply(text, undefined, { linkPreview: false });

  } catch (err) {
    console.log('❌ ERROR:', err.message);
    try {
      const errorMsg = await msg.reply('Error.');
      await errorMsg.react('❎');
      await msg.react('❎');
    } catch {}
    return null;
  }
};
