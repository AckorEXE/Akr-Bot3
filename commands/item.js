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

// ⚔️ emojis por elemento
const ELEMENT_EMOJI = {
  physical: '👊🏻',
  energy:   '⚡',
  fire:     '🔥',
  ice:      '❄️',
  earth:    '🌱',
  death:    '💀',
};

// ⚔️ formatear línea de ataque con elementos
// Resultado ejemplo: ⚔️ *Ataque:* 57 (⚡ +47 energy, 👊🏻 +10 physical)
function formatAttack(s) {
  const base = s.attack ? parseInt(s.attack) : null;

  const elements = [
    { key: 'physical', val: s.physical_attack },
    { key: 'energy',   val: s.energy_attack },
    { key: 'fire',     val: s.fire_attack },
    { key: 'ice',      val: s.ice_attack },
    { key: 'earth',    val: s.earth_attack },
    { key: 'death',    val: s.death_attack },
  ].filter(e => e.val !== null && e.val !== undefined);

  // Sin daño elemental → mostrar normal
  if (!elements.length) {
    return base !== null ? `⚔️ *Ataque:* ${base}\n` : '';
  }

  // Calcular total: base (physical puro) + todos los elementales
  // Si hay physical_attack separado, usarlo; si no, base es el físico base
  let total = 0;
  const parts = [];

  for (const e of elements) {
    const num = parseInt(e.val);
    total += num;
    parts.push(`${ELEMENT_EMOJI[e.key]} +${num} ${e.key}`);
  }

  // Si hay `attack` y NO hay `physical_attack` explícito,
  // el `attack` es el componente físico base
  const hasPhysicalExplicit = elements.some(e => e.key === 'physical');
  if (!hasPhysicalExplicit && base !== null) {
    total += base;
    parts.push(`${ELEMENT_EMOJI['physical']} +${base} physical`);
  }

  return `⚔️ *Ataque:* ${total} (${parts.join(', ')})\n`;
}

// 🧠 parse stats
function parseStats(raw) {
  return {
    name:            getMulti(raw, ['name']),
    itemid:          getMulti(raw, ['itemid']),
    attack:          getMulti(raw, ['attack']),
    // ── elementos ──
    physical_attack: getMulti(raw, ['physical_attack']),
    energy_attack:   getMulti(raw, ['energy_attack']),
    fire_attack:     getMulti(raw, ['fire_attack']),
    ice_attack:      getMulti(raw, ['ice_attack']),
    earth_attack:    getMulti(raw, ['earth_attack']),
    death_attack:    getMulti(raw, ['death_attack']),
    // ───────────────
    defense:         getMulti(raw, ['defense']),
    defensemod:      getMulti(raw, ['defensemod']),
    armor:           getMulti(raw, ['armor']),
    level:           getMulti(raw, ['levelrequired']),
    vocation:        getMulti(raw, ['vocrequired']),
    weight:          getMulti(raw, ['weight']),
    value:           getMulti(raw, ['value']),
    imbueslots:      getMulti(raw, ['imbueslots']),
    upgradeclass:    getMulti(raw, ['upgradeclass']),
    range:           getMulti(raw, ['range']),
    manacost:        getMulti(raw, ['manacost']),
    damagetype:      getMulti(raw, ['damagetype']),
    damagerange:     getMulti(raw, ['damagerange']),
    attributes:      getMulti(raw, ['attributes', 'attrib']),
    resist:          getMulti(raw, ['resist', 'resists']),
    critchance:      getMulti(raw, ['critchance', 'crithit_ch']),
    critdamage:      getMulti(raw, ['critdamage', 'critextra_dmg']),
    hpleech_ch:      getMulti(raw, ['hpleech_ch']),
    hpleech_am:      getMulti(raw, ['hpleech_am']),
    augments:        getMulti(raw, ['augments']),
    mantra:          getMulti(raw, ['mantra']),
    droppedby:       parseDroppedBy(raw),
    buyfrom:         parseNPC(raw, 'buyfrom'),
    sellto:          parseNPC(raw, 'sellto'),
    npcprice:        getMulti(raw, ['npcprice']),
    npcvalue:        getMulti(raw, ['npcvalue'])
  };
}

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    if (!args.length) {
      const errorMsg = await msg.reply('Uso correcto: *!item <nombre>*');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const query = args.join(' ');
    const normalizedQuery = query.toLowerCase().trim();

    const searchRes = await axios.get(
      `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`
    );

    const results = searchRes.data?.query?.search || [];

    if (!results.length) {
      const errorMsg = await msg.reply('No encontrado.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const blacklist = ['quest', 'outfit', 'mount', 'achievement'];

    let title = null;
    let content = null;

    // 🔥 1. MATCH EXACTO
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
            break;
          }
        } catch {}
      }
    }

    // 🔁 2. FALLBACK
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

          if (!raw || !isValidItem(raw)) continue;

          title = formatted;
          content = raw;
          break;
        } catch {
          continue;
        }
      }
    }

    if (!title || !content) {
      const errorMsg = await msg.reply('No se encontró un ítem válido.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const s = parseStats(content);

    let text = `📦 *${s.name || query}*\n\n`;
    if (s.itemid)      text += `🆔 *ID:* ${s.itemid}\n`;
    if (s.level)       text += `🎯 *Nivel:* ${s.level}\n`;
    if (s.vocation)    text += `🧙 *Vocación:* ${s.vocation}\n`;

    if (s.imbueslots)  text += `💠 *Imbuición máxima:* ${s.imbueslots}\n`;
    if (s.upgradeclass) text += `⬆️ *Clasificación:* ${s.upgradeclass}\n`;

    // ⚔️ ATAQUE — usa formatAttack para manejar elementos
    text += formatAttack(s);

    if (s.damagerange)
      text += `💥 *Daño:* ${s.damagerange} (${s.damagetype || ''})\n`;
    if (s.range)       text += `🏹 *Rango:* ${s.range}\n`;

    if (s.critchance)  text += `🎯 *Probabilidad crítica extra:* ${s.critchance}\n`;
    if (s.critdamage)  text += `💥 *Daño crítico extra:* ${s.critdamage}\n`;

    if (s.hpleech_ch)  text += `🎯 *Probabilidad robo de vida:* ${s.hpleech_ch}\n`;
    if (s.hpleech_am)  text += `🩸 *Robo de vida:* ${s.hpleech_am}\n`;

    if (s.defense || s.armor) {
      text += `🛡️ *Defensa:* ${s.defense || s.armor}`;
      if (s.defensemod) text += ` (${s.defensemod})`;
      text += `\n`;
    }

    if (s.manacost)    text += `🔮 *Mana:* ${s.manacost}\n`;
    if (s.mantra)      text += `🌀 *Mantra:* ${s.mantra}\n`;

    if (s.attributes)  text += `✨ *Atributos:* ${s.attributes}\n`;
    if (s.resist)      text += `🛡️ *Resistencias:* ${s.resist}\n`;
    if (s.augments)    text += `🧩 *Aumentos:* ${s.augments}\n`;

    if (s.weight)      text += `⚖️ *Peso:* ${s.weight} oz\n`;

    if (s.npcprice && parseInt(s.npcprice) > 0)
      text += `🛒 *Compra NPC:* ${s.npcprice} gp\n`;

    if (s.npcvalue && parseInt(s.npcvalue) > 0)
      text += `💰 *Venta NPC:* ${s.npcvalue} gp\n`;

    if (s.buyfrom)     text += `\n🛍️ *Comprar con:*\n${s.buyfrom}\n`;
    if (s.sellto)      text += `\n💸 *Vender con:*\n${s.sellto}\n`;

    if (s.droppedby)   text += `\n🎁 *Looteada por:*\n${s.droppedby}\n`;

    text += `\n🔎 https://tibia.fandom.com/wiki/${title}`;

    return msg.reply(text);

  } catch (err) {
    console.log('❌ ERROR:', err.message);
    try { await msg.react('❎'); } catch {}
    throw err;
  }
};
