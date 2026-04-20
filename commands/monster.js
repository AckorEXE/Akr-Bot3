const axios = require('axios');

// 🧠 limpiar valores inválidos
function cleanValue(val) {
  if (!val) return null;
  val = val.trim();
  if (val.startsWith('|') || val === '--' || val === '') return null;
  return val;
}

// 🔧 buscar múltiples keys
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

// 🧠 VALIDAR si es MONSTER
function isValidMonster(raw) {
  return /\|\s*hp\s*=/.test(raw) && /\|\s*exp\s*=/.test(raw);
}

// 💥 parse max damage
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

  // ✅ Caso 1: {{Max Damage|earth=500|physical=300}}
  const match = raw.match(/\{\{Max Damage\|([^}]+)\}\}/i);
  if (match) {
    let total = 0;
    let parts = [];

    match[1].split('|').forEach(part => {
      const [type, value] = part.split('=');
      if (type && value) {
        const val = parseInt(value.trim());
        if (!isNaN(val)) {
          total += val;
          const emoji = map[type.trim().toLowerCase()] || '❔';
          parts.push(`${val} ${emoji} ${type.trim()}`);
        }
      }
    });

    if (parts.length) return { total, text: parts.join(', +') };
  }

  // ✅ Caso 2: campos separados | maxdmg = 500 earth  o  | maxdmg = 500
  // Captura maxdmg, maxdmg2, maxdmg3, etc.
  const fieldRegex = /\|\s*maxdmg\d*\s*=\s*([^\n|]+)/gi;
  let total = 0;
  let parts = [];
  let m;

  while ((m = fieldRegex.exec(raw)) !== null) {
    const rawVal = m[1].trim();

    // Puede ser "500 earth", "300 physical", o solo "500"
    const numMatch = rawVal.match(/^(\d+)\s*(\w+)?/);
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

// 🌍 parse location — limpia wikitags [[...]] y {{...}}
function parseLocation(raw) {
  const val = getMulti(raw, ['location']);
  if (!val) return null;

  return val
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2') // [[Link|Label]] → Label
    .replace(/\{\{[^}]+\}\}/g, '')                   // {{Template}} → ''
    .replace(/<br\s*\/?>/gi, ', ')                    // <br> → ', '
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

// ⚔️ parse usedelements — añade emojis
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

// 🛡️ resistencias ordenadas + debilidades
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

// 🎯 charm points — tabla CORRECTA
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

// 📊 kills para desbloquear (etapa final) — tabla CORRECTA
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

// 🎁 loot inline
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

// 🧠 parse monster
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
    console.log('🔍 Buscando monster:', query);

    const searchRes = await axios.get(
      `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`
    );

    const results = searchRes.data?.query?.search || [];

    if (!results.length) {
      const errorMsg = await msg.reply('Monster no encontrado.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    let title   = null;
    let content = null;

    for (const r of results) {
      const formatted = r.title.replace(/ /g, '_');

      try {
        const rawRes = await axios.get(
          `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${formatted}&rvprop=content&format=json`
        );

        const page = Object.values(rawRes.data.query.pages)[0];
        const raw  = page?.revisions?.[0]?.['*'];

        if (!raw || !isValidMonster(raw)) continue;

        title   = formatted;
        content = raw;
        console.log('✅ Monster encontrado:', title);
        break;

      } catch {
        continue;
      }
    }

    if (!title || !content) {
      const errorMsg = await msg.reply('No se encontró un monster válido.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

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

    return msg.reply(text);

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
