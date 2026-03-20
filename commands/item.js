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

// 🧠 Buscar múltiples keys
function getMulti(raw, keys) {
  for (const key of keys) {
    const regex = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|]+)`, 'i');
    const match = raw.match(regex);
    if (match) return match[1].trim();
  }
  return null;
}

// 🔥 limpiar templates tipo {{...}}
function cleanTemplate(text) {
  if (!text) return null;

  return text
    .replace(/\{\{|\}\}/g, '')
    .replace(/\|/g, ', ')
    .trim();
}

// 🎁 Dropped By
function parseDroppedBy(raw) {
  const data = getMulti(raw, ['droppedby']);
  if (!data) return null;

  const cleaned = data
    .replace(/\{\{Dropped By\|/i, '')
    .replace(/\}\}/g, '')
    .split('|')
    .map(x => x.trim())
    .filter(Boolean);

  return cleaned.join(', ');
}

// 🛒 NPC parser
function parseNPC(raw, key) {
  const data = getMulti(raw, [key]);
  if (!data) return null;

  const matches = [...data.matchAll(/\{\{NPC Trade\|([^}]+)\}\}/g)];

  if (!matches.length) return null;

  return matches.map(m => {
    const parts = m[1].split('|');

    const name = parts[0] || '';
    const city = parts[1] || '';
    const price = parts[2] || '';

    return `${name} (${city}) - ${price} gp`;
  }).join('\n');
}

// 🧠 Parse completo
function parseStats(raw) {
  return {
    name: getMulti(raw, ['name']),
    itemid: getMulti(raw, ['itemid']),

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

    // 🔥 NUEVOS EXACTOS
    attributes: getMulti(raw, ['attributes', 'attrib']),
    resist: getMulti(raw, ['resist', 'resists']),

    critchance: getMulti(raw, ['critchance', 'crithit_ch']),
    critdamage: getMulti(raw, ['critdamage', 'critextra_dmg']),

    droppedby: parseDroppedBy(raw),
    buyfrom: parseNPC(raw, 'buyfrom'),
    sellto: parseNPC(raw, 'sellto'),

    npcprice: getMulti(raw, ['npcprice']),
    npcvalue: getMulti(raw, ['npcvalue'])
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

    if (!results.length) {
      await msg.reply('❌ No se encontró ese item.');
      return null;
    }

    const selected = results[0];
    const correctTitle = selected.title.replace(/ /g, '_');

    console.log('✅ Usando:', correctTitle);

    // 🔥 raw
    const rawUrl = `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${correctTitle}&rvprop=content&format=json`;
    const rawRes = await axios.get(rawUrl);

    const page = Object.values(rawRes.data.query.pages)[0];
    const content = page?.revisions?.[0]?.['*'];

    if (!content) {
      await msg.reply('❌ No se pudo obtener info.');
      return null;
    }

    const s = parseStats(content);

    let text = `📦 *${s.name || selected.title}*\n\n`;

    if (s.itemid) text += `🆔 ID: ${s.itemid}\n`;

    if (s.attack) text += `⚔️ Ataque: ${s.attack}\n`;

    if (s.defense || s.armor) {
      text += `🛡️ Defensa: ${s.defense || s.armor}`;
      if (s.defensemod) text += ` (${s.defensemod})`;
      text += `\n`;
    }

    if (s.level) text += `🎯 Nivel: ${s.level}\n`;
    if (s.vocation) text += `🧙 Vocación: ${s.vocation}\n`;

    if (s.damagerange)
      text += `💥 Daño: ${s.damagerange} (${s.damagetype || ''})\n`;

    if (s.range) text += `🏹 Rango: ${s.range}\n`;

    if (s.imbueslots) text += `💠 Imbuing Slots: ${s.imbueslots}\n`;
    if (s.upgradeclass) text += `⬆️ Upgrade Class: ${s.upgradeclass}\n`;

    if (s.attributes) text += `✨ Atributos: ${s.attributes}\n`;
    if (s.resist) text += `🛡️ Resistencias: ${s.resist}\n`;

    if (s.critchance) text += `🎯 Crit Chance: ${s.critchance}\n`;
    if (s.critdamage) text += `💥 Crit Damage: ${s.critdamage}\n`;

    if (s.weight) text += `⚖️ Peso: ${s.weight}\n`;

    if (s.npcprice) text += `🛒 Compra NPC: ${s.npcprice} gp\n`;
    if (s.npcvalue) text += `💰 Venta NPC: ${s.npcvalue} gp\n`;

    if (s.buyfrom) text += `\n🛍️ Buy From:\n${s.buyfrom}\n`;
    if (s.sellto) text += `\n💸 Sell To:\n${s.sellto}\n`;

    if (s.droppedby) text += `\n🎁 Dropped By:\n${s.droppedby}\n`;

    text += `\n🔎 https://tibia.fandom.com/wiki/${correctTitle}`;

    const sentMessage = await msg.reply(text);
    await sentMessage.react('📚');

    return sentMessage;

  } catch (err) {
    console.log('❌ ERROR:', err.message);
    await msg.reply('❌ Error al obtener el item.');
    return null;
  }
};
