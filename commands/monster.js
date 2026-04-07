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

// 💥 parse max damage (FORMATO NUEVO)
function parseMaxDamage(raw) {
  // 🔥 Caso 1: formato template {{Max Damage|...}}
  const match = raw.match(/\{\{Max Damage\|([^}]+)\}\}/i);

  const map = {
    physical: '👊🏻',
    fire: '🔥',
    energy: '⚡',
    earth: '🌱',
    ice: '❄️',
    death: '💀',
    holy: '✨',
    lifedrain: '🩸',
    manadrain: '🔮',
    summons: '👹'
  };

  // ✅ Si es formato complejo
  if (match) {
    let total = 0;
    let parts = [];

    match[1].split('|').forEach(part => {
      const [type, value] = part.split('=');
      if (type && value) {
        const val = parseInt(value.trim());
        if (!isNaN(val)) {
          total += val;
          const emoji = map[type.trim()] || '❔';
          parts.push(`${val} ${emoji} ${type.trim()}`);
        }
      }
    });

    return {
      total,
      text: parts.join(', +')
    };
  }

  // 🔥 Caso 2: valor simple | maxdmg = 203
  const simple = getMulti(raw, ['maxdmg']);

  if (simple) {
    const val = parseInt(simple);
    if (!isNaN(val)) {
      return {
        total: val,
        text: `${val} 👊🏻 physical` // asumimos físico
      };
    }
  }

  return null;
}

// 🛡️ resistencias ORDENADAS + DEBILIDAD
function parseResistances(raw) {
  const map = {
    physicalDmgMod: { emoji: '👊🏻', name: 'physical' },
    earthDmgMod: { emoji: '🌱', name: 'earth' },
    fireDmgMod: { emoji: '🔥', name: 'fire' },
    deathDmgMod: { emoji: '💀', name: 'death' },
    energyDmgMod: { emoji: '⚡', name: 'energy' },
    holyDmgMod: { emoji: '✝️', name: 'holy' },
    iceDmgMod: { emoji: '❄️', name: 'ice' },
    hpDrainDmgMod: { emoji: '🩸', name: 'lifedrain' },
    drownDmgMod: { emoji: '🌊', name: 'drown' },
  };

  let result = [];

  for (const key in map) {
    const val = getMulti(raw, [key]);
    if (val) {
      const num = parseInt(val.replace('%', '').trim());
      if (!isNaN(num)) {
        let text = `${map[key].emoji} ${map[key].name}: ${val}`;

        // 🔥 debilidad (>100%)
        if (num > 100) {
          text = `*${text}*`;
        }

        result.push({
          value: num,
          text
        });
      }
    }
  }

  // ordenar DESC
  result.sort((a, b) => b.value - a.value);

  return result.length ? result.map(x => x.text).join('\n') : null;
}

// 🎯 charm points
function calculateCharmPoints(level) {
  const table = {
    Trivial: 1,
    Easy: 5,
    Medium: 15,
    Hard: 50
  };
  return table[level] || null;
}

// 📊 kills unlock
function calculateKills(level, occurrence) {
  const table = {
    Trivial: { Common: 25, Uncommon: 5, Rare: 1 },
    Easy: { Common: 250, Uncommon: 50, Rare: 10 },
    Medium: { Common: 1000, Uncommon: 250, Rare: 50 },
    Hard: { Common: 2500, Uncommon: 500, Rare: 100 }
  };

  if (!level || !occurrence) return null;

  const lvl = level.trim();
  const occ = occurrence.trim();

  return table[lvl]?.[occ] || null;
}

// 🎁 loot inline limpio
function parseLoot(raw) {
  const matches = [...raw.matchAll(/\{\{Loot Item\|([^}]+)\}\}/gi)];
  if (!matches.length) return null;

  let result = [];

  matches.forEach(m => {
    const parts = m[1].split('|').map(x => x.trim());

    let count = null;
    let name = null;

    if (parts.length === 3) {
      count = parts[0];
      name = parts[1];
    } else if (parts.length === 2) {
      name = parts[0];
    }

    if (name) {
      result.push(`${name}${count ? ` (${count})` : ''}`);
    }
  });

  return result.join(', ');
}

// 🧠 parse monster
function parseMonster(raw) {
  const dmg = parseMaxDamage(raw);

  const bestiarylevel = getMulti(raw, ['bestiarylevel']);
  const occurrence = getMulti(raw, ['occurrence']);

  return {
    name: getMulti(raw, ['name']),
    hp: getMulti(raw, ['hp']),
    exp: getMulti(raw, ['exp']),
    maxdmg: dmg,
    resist: parseResistances(raw),
    charmPoints: calculateCharmPoints(bestiarylevel),
    kills: calculateKills(bestiarylevel, occurrence),
    loot: parseLoot(raw)
  };
}

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    // ❌ Uso incorrecto
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

    let title = null;
    let content = null;

    for (const r of results) {
      const formatted = r.title.replace(/ /g, '_');

      try {
        const rawRes = await axios.get(
          `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${formatted}&rvprop=content&format=json`
        );

        const page = Object.values(rawRes.data.query.pages)[0];
        const raw = page?.revisions?.[0]?.['*'];

        if (!raw) continue;
        if (!isValidMonster(raw)) continue;

        title = formatted;
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

    if (s.hp) text += `❤️ *Vida:* ${s.hp}\n`;
    if (s.exp) text += `✨ *Experiencia:* ${s.exp}\n`;

    if (s.maxdmg)
      text += `\n💥 *Daño máximo:* ${s.maxdmg.total}\n(${s.maxdmg.text})\n`;

    if (s.resist)
      text += `\n🛡️ *Debilidades:*\n${s.resist}\n`;

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

    const errorMsg = await msg.reply('Error.');
    await errorMsg.react('❎');
    await msg.react('❎');

    return null;
  }
};
