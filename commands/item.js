const axios = require('axios');

// 🔧 Formatear nombre
function formatItemName(text) {
  const exceptions = ['of', 'the', 'and', 'in', 'on', 'at'];

  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (exceptions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('_');
}

// 🧠 Obtener múltiples posibles nombres
function getMulti(raw, keys) {
  for (const key of keys) {
    const regex = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|]+)`, 'i');
    const match = raw.match(regex);
    if (match) return match[1].trim();
  }
  return null;
}

// 🧠 Extraer stats completos
function parseStats(raw) {
  return {
    name: getMulti(raw, ['name']),
    attack: getMulti(raw, ['attack']),
    defense: getMulti(raw, ['defense']),
    defensemod: getMulti(raw, ['defensemod']),
    armor: getMulti(raw, ['armor']),
    level: getMulti(raw, ['levelrequired']),
    vocation: getMulti(raw, ['vocrequired']),
    weight: getMulti(raw, ['weight']),
    value: getMulti(raw, ['value']),

    imbueslots: getMulti(raw, ['imbueslots']),
    upgradeclass: getMulti(raw, ['upgradeclass']),
    range: getMulti(raw, ['range']),
    lifeleech: getMulti(raw, ['lifeleech']),
    manacost: getMulti(raw, ['manacost']),
    damagetype: getMulti(raw, ['damagetype']),
    damagerange: getMulti(raw, ['damagerange']),

    // 🔥 IMPORTANTES
    attributes: getMulti(raw, ['attributes', 'attribute']),
    resist: getMulti(raw, ['resist', 'resists']),

    // 🔥 CRITICOS
    critchance: getMulti(raw, [
      'extracriticalchance',
      'criticalchance',
      'critchance'
    ]),

    critdamage: getMulti(raw, [
      'extracriticaldamage',
      'criticaldamage',
      'critdamage'
    ])
  };
}

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    if (args.length === 0) {
      const errorMsg = await msg.reply('Uso correcto: *!item <nombre>*');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const rawQuery = args.join(' ');

    // 🔎 buscar
    const searchUrl = `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(rawQuery)}&format=json`;
    const searchRes = await axios.get(searchUrl);

    const results = searchRes.data?.query?.search || [];

    if (results.length === 0) {
      const errorMsg = await msg.reply('❌ No se encontró ese item.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const blacklist = ['quest', 'spoiler'];

    const valid = results.find(r => {
      const title = r.title.toLowerCase();
      return !blacklist.some(b => title.includes(b));
    });

    const selected = valid || results[0];
    const correctTitle = selected.title.replace(/ /g, '_');

    console.log('✅ Usando:', correctTitle);

    // 🔥 obtener raw
    const rawUrl = `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${correctTitle}&rvprop=content&format=json`;
    const rawRes = await axios.get(rawUrl);

    const rawPages = rawRes.data.query.pages;
    const rawPage = Object.values(rawPages)[0];

    let content = rawPage?.revisions?.[0]?.['*'] || '';

    if (!content) {
      const errorMsg = await msg.reply('❌ No se pudo obtener info.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const stats = parseStats(content);

    // 🧾 RESPUESTA
    let text = `📦 *${stats.name || selected.title}*\n\n`;

    if (stats.attack) text += `⚔️ Ataque: ${stats.attack}\n`;

    if (stats.defense || stats.armor) {
      text += `🛡️ Defensa: ${stats.defense || stats.armor}`;
      if (stats.defensemod) text += ` (${stats.defensemod})`;
      text += `\n`;
    }

    if (stats.level) text += `🎯 Nivel: ${stats.level}\n`;
    if (stats.vocation) text += `🧙 Vocación: ${stats.vocation}\n`;

    if (stats.damagerange)
      text += `💥 Daño: ${stats.damagerange} (${stats.damagetype || ''})\n`;

    if (stats.range)
      text += `🏹 Rango: ${stats.range}\n`;

    if (stats.lifeleech)
      text += `🩸 Life Leech: ${stats.lifeleech}\n`;

    if (stats.manacost)
      text += `🔮 Mana: ${stats.manacost}\n`;

    if (stats.imbueslots)
      text += `💠 Imbuing Slots: ${stats.imbueslots}\n`;

    if (stats.upgradeclass)
      text += `⬆️ Upgrade Class: ${stats.upgradeclass}\n`;

    // 🔥 AQUÍ ESTABA EL PROBLEMA (YA FIX)
    if (stats.attributes)
      text += `✨ Atributos: ${stats.attributes}\n`;

    if (stats.resist)
      text += `🛡️ Resistencias: ${stats.resist}\n`;

    if (stats.critchance)
      text += `🎯 Crit Chance: ${stats.critchance}\n`;

    if (stats.critdamage)
      text += `💥 Crit Damage: ${stats.critdamage}\n`;

    if (stats.weight)
      text += `⚖️ Peso: ${stats.weight}\n`;

    if (stats.value)
      text += `💰 Valor: ${stats.value}\n`;

    text += `\n🔎 https://tibia.fandom.com/wiki/${correctTitle}`;

    const sentMessage = await msg.reply(text);
    await sentMessage.react('📚');

    return sentMessage;

  } catch (err) {
    console.log('❌ ERROR:', err.message);

    try {
      await msg.reply('❌ Error al obtener el item.');
      await msg.react('❎');
    } catch {}

    return null;
  }
};
