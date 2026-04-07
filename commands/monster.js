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
  const hasHP = /\|\s*hp\s*=/.test(raw);
  const hasExp = /\|\s*exp\s*=/.test(raw);
  return hasHP && hasExp;
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

  let result = [];

  match[1].split('|').forEach(part => {
    const [type, value] = part.split('=');
    if (type && value) {
      const emoji = map[type.trim()] || '❔';
      result.push(`${emoji} ${type.trim()}: ${value.trim()}`);
    }
  });

  return result.join('\n');
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

// 🎯 charm points
function parseCharmPoints(raw) {
  const match = raw.match(/\{\{Charm Points\|([^}]+)\}\}/i);
  if (!match) return null;

  const parts = match[1].split('|');
  return parts[0] || null;
}

// 📊 kills to unlock
function parseKills(raw) {
  const match = raw.match(/\{\{Kills to Unlock\|([^}]+)\}\}/i);
  if (!match) return null;

  const parts = match[1].split('|');
  return parts.join(' / ');
}

// 🎁 loot parser simple
function parseLoot(raw) {
  const match = raw.match(/\{\{Loot\|([^}]+)\}\}/i);
  if (!match) return null;

  return match[1]
    .split('|')
    .map(x => x.trim())
    .filter(Boolean)
    .join(', ');
}

// 🧠 parse monster stats
function parseMonster(raw) {
  return {
    name: getMulti(raw, ['name']),
    hp: getMulti(raw, ['hp']),
    exp: getMulti(raw, ['exp']),
    maxdmg: parseMaxDamage(raw),
    resist: parseResistances(raw),
    charmPoints: parseCharmPoints(raw),
    kills: parseKills(raw),
    loot: parseLoot(raw)
  };
}

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    // ❌ Uso incorrecto
    if (args.length === 0) {
      const errorMsg = await msg.reply(
        'Uso correcto: *!monster <nombre>*\nEjemplo: *!monster dragon lord*'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const query = args.join(' ');
    const normalizedQuery = query.toLowerCase().trim();

    // 🔎 buscar
    const searchRes = await axios.get(
      `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`
    );

    const results = searchRes.data?.query?.search || [];

    // ❌ No encontrado
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
        break;

      } catch {
        continue;
      }
    }

    // ❌ No es monster válido
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

    if (s.maxdmg) text += `\n💥 *Daño máximo:*\n${s.maxdmg}\n`;

    if (s.resist) text += `\n🛡️ *Daños recibidos:*\n${s.resist}\n`;

    if (s.charmPoints)
      text += `\n🎯 *Charm Points:* ${s.charmPoints}\n`;

    if (s.kills)
      text += `📊 *Kills para unlock:* ${s.kills}\n`;

    if (s.loot)
      text += `\n🎁 *Loot:*\n${s.loot}\n`;

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
