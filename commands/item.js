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

// 🧠 Extraer datos del template
function parseStats(raw) {
  const get = (key) => {
    const regex = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|]+)`);
    const match = raw.match(regex);
    return match ? match[1].trim() : null;
  };

  return {
    name: get('name'),
    attack: get('attack'),
    defense: get('defense'),
    defensemod: get('defensemod'),
    armor: get('armor'),
    level: get('levelrequired'),
    vocation: get('vocrequired'),
    weight: get('weight'),
    value: get('value'),

    // 🔥 NUEVOS
    imbueslots: get('imbueslots'),
    upgradeclass: get('upgradeclass'),
    range: get('range'),
    lifeleech: get('lifeleech'),
    manacost: get('manacost'),
    damagetype: get('damagetype'),
    damagerange: get('damagerange'),
    attributes: get('attributes'),
    resist: get('resist')
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

    // 🔥 NUEVOS BLOQUES
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

    if (stats.attributes)
      text += `✨ Atributos: ${stats.attributes}\n`;

    if (stats.resist)
      text += `🛡️ Resistencias: ${stats.resist}\n`;

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
