const fandom = require('../utils/fandom');

function cleanValue(val) {
  if (!val) return null;
  val = val.trim();
  if (val.startsWith('|') || val === '--' || val === '') return null;
  return val;
}

function getMulti(raw, keys) {
  for (const key of keys) {
    const regex = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n]+)`, 'i');
    const match = raw.match(regex);
    if (match) {
      const value = cleanValue(match[1]);
      if (value) return value;
    }
  }
  return null;
}

function isValidMonster(raw) {
  return /\|\s*hp\s*=/.test(raw) && /\|\s*exp\s*=/.test(raw);
}

function parseMaxDamage(raw) {
  const map = {
    physical:  '👊🏻',
    fire:      '🔥',
    energy:    '⚡',
    earth:     '🌱',
    ice:       '❄️',
    death:     '💀',
    holy:      '✨',
    lifedrain: '🩸',
    manadrain: '🔮',
    summons:   '👹'
  };

  const matches = [...raw.matchAll(/\{\{Max Damage\|([^}]+)\}\}/gi)];
  if (matches.length) {
    let total = 0;
    let parts = [];
    matches.forEach(match => {
      match[1].split('|').forEach(part => {
        const [type, value] = part.split('=');
        if (type && value) {
          const val = parseInt(value.trim().replace(/,/g, '').replace(/\+/g, ''));
          if (!isNaN(val)) {
            total += val;
            const emoji = map[type.trim().toLowerCase()] || '❔';
            parts.push(`${val} ${emoji} ${type.trim()}`);
          }
        }
      });
    });
    if (parts.length) return { total, text: parts.join(', +') };
  }

  const fieldRegex = /\|\s*maxdmg\d*\s*=\s*([^\n|]+)/gi;
  let total = 0;
  let parts = [];
  let m;
  while ((m = fieldRegex.exec(raw)) !== null) {
    const rawVal = m[1].trim();
    const cleaned = rawVal.replace(/,/g, '').replace(/\+/g, '').trim();
    const numMatch = cleaned.match(/^(\d+)\s*(\w+)?/);
    if (numMatch) {
      const val = parseInt(numMatch[1]);
      const typeRaw = (numMatch[2] || 'physical').toLowerCase();
      if (!isNaN(val) && val > 0) {
        total += val;
        const emoji = map[typeRaw] || '❔';
        parts.push(`${val} ${emoji} ${typeRaw}`);
      }
    }
  }
  if (parts.length) return { total, text: parts.join(', +') };

  return null;
}

function parseLocation(raw) {
  const val = getMulti(raw, ['location']);
  if (!val) return null;
  return val
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

function parseUsedElements(raw) {
  const val = getMulti(raw, ['usedelements']);
  if (!val) return null;
  const emojiMap = {
    physical: '👊🏻',
    energy:   '⚡',
    fire:     '🔥',
    ice:      '❄️',
    earth:    '🌱',
    death:    '💀',
    holy:     '✨',
  };
  return val
    .split('>')
    .map(e => {
      const elem = e.trim();
      const key = elem.toLowerCase();
      const emoji = emojiMap[key] || '❔';
      return `${emoji} ${elem}`;
    })
    .join(' > ');
}

function parseResistances(raw) {
  const map = {
    physicalDmgMod: { emoji: '👊🏻', name: 'physical' },
    earthDmgMod:    { emoji: '🌱', name: 'earth' },
    fireDmgMod:     { emoji: '🔥', name: 'fire' },
    deathDmgMod:    { emoji: '💀', name: 'death' },
    energyDmgMod:   { emoji: '⚡', name: 'energy' },
    holyDmgMod:     { emoji: '✝️', name: 'holy' },
    iceDmgMod:      { emoji: '❄️', name: 'ice' },
    hpDrainDmgMod:  { emoji: '🩸', name: 'lifedrain' },
    drownDmgMod:    { emoji: '🌊', name: 'drown' },
  };
  let result = [];
  for (const key in map) {
    const val = getMulti(raw, [key]);
    if (val) {
      const num = parseInt(val.replace('%', '').trim());
      if (!isNaN(num)) {
        let text = `${map[key].emoji} ${map[key].name}: ${val}`;
        if (num > 100) text = `*${text}*`;
        result.push({ value: num, text });
      }
    }
  }
  result.sort((a, b) => b.value - a.value);
  return result.length ? result.map(x => x.text).join('\n') : null;
}

function calculateCharmPoints(level) {
  const table = {
    Harmless: 1,
    Trivial:  5,
    Easy:     15,
    Medium:   25,
    Hard:     50,
  };
  return table[level?.trim()] || null;
}

function calculateKills(level) {
  const table = {
    Harmless: 25,
    Trivial:  250,
    Easy:     500,
    Medium:   1000,
    Hard:     2500,
  };
  return table[level?.trim()] || null;
}

function parseLoot(raw) {
  const matches = [...raw.matchAll(/\{\{Loot Item\|([^}]+)\}\}/gi)];
  if (!matches.length) return null;
  let result = [];
  matches.forEach(m => {
    const parts = m[1].split('|').map(x => x.trim());
    let count = null;
    let name  = null;
    const isCount = /^\d+(-\d+)?$/.test(parts[0]);
    if (isCount) {
      count = parts[0];
      name  = parts[1] || null;
    } else {
      name = parts[0];
    }
    if (name) result.push(`${name}${count ? ` (${count})` : ''}`);
  });
  return result.join(', ');
}

function parseMonster(raw) {
  const dmg           = parseMaxDamage(raw);
  const bestiarylevel = getMulti(raw, ['bestiarylevel']);
  return {
    name:         getMulti(raw, ['name']),
    hp:           getMulti(raw, ['hp']),
    exp:          getMulti(raw, ['exp']),
    maxdmg:       dmg,
    usedelements: parseUsedElements(raw),
    resist:       parseResistances(raw),
    location:     parseLocation(raw),
    charmPoints:  calculateCharmPoints(bestiarylevel),
    kills:        calculateKills(bestiarylevel),
    loot:         parseLoot(raw),
  };
}

// 🔑 Convierte "king zelos" → "King_Zelos" y variantes para buscar directo
function queryToTitleVariants(query) {
  const titleCase = query
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('_');

  const upperFirst = query.trim().charAt(0).toUpperCase() + query.trim().slice(1).toLowerCase();
  const upperFirst_ = upperFirst.replace(/ /g, '_');

  return [
    titleCase,
    upperFirst_,
    query.trim().replace(/ /g, '_'),
  ].filter((v, i, arr) => arr.indexOf(v) === i); // deduplicar
}

// 🚀 Prueba una lista de títulos EN PARALELO y devuelve el primero válido
// respetando el orden de prioridad del array (no el orden de respuesta).
async function tryTitles(titles) {
  if (!titles.length) return null;

  const settled = await Promise.all(
    titles.map(async (title) => {
      const raw = await fandom.getPage(title);
      if (raw && isValidMonster(raw)) return { title, content: raw };
      return null;
    })
  );

  return settled.find(Boolean) || null;
}

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    if (args.length === 0) {
      const errorMsg = await msg.reply(
        'Uso correcto: *!monster <nombre>*\nEjemplo: *!monster demon*'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const query = args.join(' ');

    // ── Paso 1: intentar títulos directos, todos en paralelo ────────────────
    const variants = queryToTitleVariants(query);
    let found = await tryTitles(variants);

    // ── Paso 2: si no encontró, usar search y probar resultados en paralelo ─
    if (!found) {
      const results = await fandom.search(query);

      if (!results.length) {
        const errorMsg = await msg.reply('Monster no encontrado.');
        await errorMsg.react('❎');
        await msg.react('❎');
        return null;
      }

      const titles = results.map(r => r.title.replace(/ /g, '_'));
      found = await tryTitles(titles);
    }

    if (!found) {
      const errorMsg = await msg.reply('No se encontró un monster válido.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const { title, content } = found;
    const s = parseMonster(content);

    let text = `👾 *${s.name || query}*\n\n`;
    if (s.hp)  text += `❤️ *Vida:* ${s.hp}\n`;
    if (s.exp) text += `✨ *Experiencia:* ${s.exp}\n`;

    if (s.maxdmg) {
      text += `\n💥 *Daño máximo:* ${s.maxdmg.total}\n`;
      text += `(${s.maxdmg.text})\n`;
    }

    if (s.usedelements)
      text += `⚔️ *Elementos usados:* ${s.usedelements}\n`;

    if (s.resist)
      text += `\n🛡️ *Debilidades:*\n${s.resist}\n`;

    if (s.location)
      text += `\n📍 *Ubicación:* ${s.location}\n`;

    if (s.charmPoints)
      text += `\n🎯 *Puntos de charms:* ${s.charmPoints}\n`;

    if (s.kills)
      text += `📊 *Muertes para desbloquear:* ${s.kills}\n`;

    if (s.loot)
      text += `\n🎁 *Loot:* ${s.loot}\n`;

    text += `\n🔎 https://tibia.fandom.com/wiki/${title}`;

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
