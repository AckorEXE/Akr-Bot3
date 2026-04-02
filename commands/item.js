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

// 🎁 dropped by
function parseDroppedBy(raw) {
  const match = raw.match(/\|\s*droppedby\s*=\s*\{\{Dropped By\|([^}]+)\}\}/i);
  if (!match) return null;

  return match[1]
    .split('|')
    .map(x => x.trim())
    .filter(Boolean)
    .join(', ');
}

// 🛒 NPC parser
function parseNPC(raw, key) {
  const data = getMulti(raw, [key]);
  if (!data) return null;

  let result = [];

  const matches = [...data.matchAll(/\{\{NPC Trade\|([^}]+)\}\}/gi)];

  if (matches.length) {
    matches.forEach(m => {
      const parts = m[1].split('|');
      if (parts.length >= 3) {
        result.push(`${parts[0]} (${parts[1]}) - ${parts[2]} gp`);
      }
    });
  }

  if (!result.length) {
    const cleaned = data
      .replace(/\{\{|\}\}/g, '')
      .replace(/\|/g, ', ')
      .trim();

    if (cleaned && cleaned !== '--') {
      result.push(cleaned);
    }
  }

  return result.length ? result.join('\n') : null;
}

// 🧠 VALIDAR si es item real
function isValidItem(raw) {
  const hasItemId = /\|\s*itemid\s*=/.test(raw);
  const hasWeight = /\|\s*weight\s*=/.test(raw);
  const hasStats =
    /\|\s*(attack|defense|armor)\s*=/.test(raw);

  return hasItemId || hasWeight || hasStats;
}

// 🧠 parse stats
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
    manacost: getMulti(raw, ['manacost']),
    damagetype: getMulti(raw, ['damagetype']),
    damagerange: getMulti(raw, ['damagerange']),
    attributes: getMulti(raw, ['attributes', 'attrib']),
    resist: getMulti(raw, ['resist', 'resists']),
    critchance: getMulti(raw, ['critchance', 'crithit_ch']),
    critdamage: getMulti(raw, ['critdamage', 'critextra_dmg']),
    hpleech_ch: getMulti(raw, ['hpleech_ch']),
    hpleech_am: getMulti(raw, ['hpleech_am']),
    augments: getMulti(raw, ['augments']),
    mantra: getMulti(raw, ['mantra']),
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
    if (!args.length) return msg.reply('Uso correcto: *!item <nombre>*');

    const query = args.join(' ');
    const normalizedQuery = query.toLowerCase().trim();

    // 🔎 buscar
    const searchRes = await axios.get(
      `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`
    );

    const results = searchRes.data?.query?.search || [];
    if (!results.length) return msg.reply('❌ No encontrado.');

    const blacklist = ['quest', 'outfit', 'mount', 'achievement'];

    let title = null;
    let content = null;

    // 🔥 1. INTENTAR MATCH EXACTO
    for (const r of results) {
      const cleanTitle = r.title.toLowerCase().trim();

      if (cleanTitle === normalizedQuery) {
        const formatted = r.title.replace(/ /g, '_');

        try {
          const rawRes = await axios.get(
            `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${formatted}&rvprop=content&format=json`
          );

          const page = Object.values(rawRes.data.query.pages)[0];
          const raw = page?.revisions?.[0]?.['*'];

          if (raw && isValidItem(raw)) {
            title = formatted;
            content = raw;
            console.log('🎯 Exact match:', title);
            break;
          }

        } catch {}
      }
    }

    // 🔁 2. FALLBACK NORMAL
    if (!title) {
      for (const r of results) {
        const lower = r.title.toLowerCase();

        if (blacklist.some(w => lower.includes(w))) continue;

        const formatted = r.title.replace(/ /g, '_');

        try {
          const rawRes = await axios.get(
            `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${formatted}&rvprop=content&format=json`
          );

          const page = Object.values(rawRes.data.query.pages)[0];
          const raw = page?.revisions?.[0]?.['*'];

          if (!raw) continue;
          if (!isValidItem(raw)) continue;

          title = formatted;
          content = raw;

          console.log('✅ Usando fallback:', title);
          break;

        } catch {
          continue;
        }
      }
    }

    if (!title || !content) {
      return msg.reply('❌ No se encontró un ítem válido.');
    }

    const s = parseStats(content);

    let text = `📦 *${s.name || query}*\n\n`;
    if (s.itemid) text += `🆔 *ID:* ${s.itemid}\n`;
    if (s.level) text += `🎯 *Nivel:* ${s.level}\n`;
    if (s.vocation) text += `🧙 *Vocación:* ${s.vocation}\n`;

    if (s.imbueslots) text += `💠 *Imbuición máxima:* ${s.imbueslots}\n`;
    if (s.upgradeclass) text += `⬆️ *Clasificación:* ${s.upgradeclass}\n`;

    if (s.attack) text += `⚔️ *Ataque:* ${s.attack}\n`;
    if (s.damagerange)
      text += `💥 *Daño:* ${s.damagerange} (${s.damagetype || ''})\n`;
    if (s.range) text += `🏹 *Rango:* ${s.range}\n`;

    if (s.critchance)
      text += `🎯 *Probabilidad crítica extra:* ${s.critchance}\n`;
    if (s.critdamage)
      text += `💥 *Daño crítico extra:* ${s.critdamage}\n`;

    if (s.hpleech_ch)
      text += `🎯 *Probabilidad robo de vida:* ${s.hpleech_ch}\n`;
    if (s.hpleech_am)
      text += `🩸 *Robo de vida:* ${s.hpleech_am}\n`;

    if (s.defense || s.armor) {
      text += `🛡️ *Defensa:* ${s.defense || s.armor}`;
      if (s.defensemod) text += ` (${s.defensemod})`;
      text += `\n`;
    }

    if (s.manacost) text += `🔮 *Mana:* ${s.manacost}\n`;
    if (s.mantra) text += `🌀 *Mantra:* ${s.mantra}\n`;

    if (s.attributes) text += `✨ *Atributos:* ${s.attributes}\n`;
    if (s.resist) text += `🛡️ *Resistencias:* ${s.resist}\n`;
    if (s.augments) text += `🧩 *Aumentos:* ${s.augments}\n`;

    if (s.weight) text += `⚖️ *Peso:* ${s.weight} oz\n`;

    if (s.npcprice && parseInt(s.npcprice) > 0)
      text += `🛒 *Compra NPC:* ${s.npcprice} gp\n`;

    if (s.npcvalue && parseInt(s.npcvalue) > 0)
      text += `💰 *Venta NPC:* ${s.npcvalue} gp\n`;

    if (s.buyfrom) text += `\n🛍️ *Comprar con:*\n${s.buyfrom}\n`;
    if (s.sellto) text += `\n💸 *Vender con:*\n${s.sellto}\n`;

    if (s.droppedby)
      text += `\n🎁 *Looteada por:*\n${s.droppedby}\n`;

    text += `\n🔎 https://tibia.fandom.com/wiki/${title}`;

    return msg.reply(text);

  } catch (err) {
    console.log('❌ ERROR:', err.message);
    return msg.reply('❌ Error.');
  }
};
