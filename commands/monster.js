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
  const match = raw.match(/\{\{Max Damage\|([^}]+)\}\}/i);
  if (!match) return null;

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

  let total = 0;
  let parts = [];

  match[1].split('|').forEach(part => {
    const [type, value] = part.split('=');
    if (type && value) {
      const val = parseInt(value.trim());
      if (!isNaN(val)) {
        total += val;
        const emoji = map[type.trim()] || '❔';
        parts.push(`${emoji} ${type.trim()}: ${val}`);
      }
    }
  });

  return {
    total,
    text: parts.join(', +')
  };
}

// 🛡️ resistencias
function parseResistances(raw) {
  const map = {
    physicalDmgMod: '👊🏻',
    earthDmgMod: '🌱',
    fireDmgMod: '🔥',
    deathDmgMod: '💀',
    energyDmgMod: '⚡',
    holyDmgMod: '✨',
    iceDmgMod: '❄️',
    hpDrainDmgMod: '🩸',
    drownDmgMod: '🌊',
    healMod: '💚'
  };

  let result = [];

  for (const key in map) {
    const val = getMulti(raw, [key]);
    if (val) {
      result.push(`${map[key]} ${key.replace('DmgMod', '')}: ${val}`);
    }
  }

  return result.length ? result.join('\n') : null;
}

// 🎯 calcular charm points
function calculateCharmPoints(level, occurrence) {
  const table = {
    Trivial: 1,
    Easy: 5,
    Medium: 15,
    Hard: 50
  };
  return table[level] || null;
}

// 📊 calcular kills to unlock
function calculateKills(level, occurrence) {
  const table = {
    Trivial: 25,
    Easy: 250,
    Medium: 1000,
    Hard: 2500
  };
  return table[level] || null;
}

// 🎁 loot inline SIN emojis
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

// 🧠 parse monster stats
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
    charmPoints: calculateCharmPoints(bestiarylevel, occurrence),
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

    let text = `👹 *${s.name || query}*\n\n`;

    if (s.hp) text += `❤️ *Vida:* ${s.hp}\n`;
    if (s.exp) text += `✨ *Experiencia:* ${s.exp}\n`;

    if (s.maxdmg)
      text += `\n💥 *Daño máximo aproximado:* ${s.maxdmg.total}\n"${s.maxdmg.text}"\n`;

    if (s.resist)
      text += `\n🛡️ *Daños recibidos:*\n${s.resist}\n`;

    if (s.charmPoints)
      text += `\n🎯 *Charm Points:* ${s.charmPoints}\n`;

    if (s.kills)
      text += `📊 *Kills para unlock:* ${s.kills}\n`;

    if (s.loot)
      text += `\n🎁 *Loot:* ${s.loot}\n`;

    text += `\n🔎 https://tibia.fandom.com/wiki/${title}`;

    return msg.reply(text);

  } catch (err) {
    console.log('❌ ERROR:', err.message);

    const errorMsg = await msg.reply('❌ Error.');
    await errorMsg.react('❎');
    await msg.react('❎');

    return null;
  }
};
