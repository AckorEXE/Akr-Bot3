// commands/rboosted.js
const axios = require('axios');

const API_URL = 'https://api.rubinottools.com/api/boosts';

/* =========================
   HELPERS
========================= */

// Convierte un nombre a formato Título.
// Ej: "lacewing moth" -> "Lacewing Moth"
//     "the lord of the lice" -> "The Lord Of The Lice"
function toTitleCase(name) {
    if (!name) return '';
    return name
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Convierte un nombre a formato URL para Tibia Fandom.
// Ej: "Tropical Desolator" -> "Tropical_Desolator"
function toFandomSlug(name) {
    if (!name) return '';
    return toTitleCase(name)
        .split(' ')
        .filter(Boolean)
        .join('_');
}

async function asyncReply(msg, text) {
    try { return await msg.reply(text, null, { linkPreview: false }); } catch { return null; }
}

async function asyncReact(target, emoji) {
    try { await target.react(emoji); } catch {}
}

/* =========================
   API
========================= */

async function fetchBoosts() {
    const { data } = await axios.get(API_URL, {
        headers: {
            'Accept': '*/*',
            'Origin': 'https://www.rubinottools.com',
            'Referer': 'https://www.rubinottools.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
        },
        timeout: 10000
    });
    return data;
}

/* =========================
   FORMATO DEL MENSAJE
========================= */

function formatBoostMessage(data) {
    const bossName     = toTitleCase(data.boss?.name)     || 'Desconocido';
    const creatureName = toTitleCase(data.creature?.name) || 'Desconocida';

    const bossSlug     = toFandomSlug(data.boss?.name);
    const creatureSlug = toFandomSlug(data.creature?.name);

    const bossUrl     = `https://tibia.fandom.com/wiki/${bossSlug}`;
    const creatureUrl = `https://tibia.fandom.com/wiki/${creatureSlug}`;

    let text = `🚀 *Boosted del día*\n\n`;
    text += `👾 *Criatura:* ${creatureName}\n`;
    text += `🔎 ${creatureUrl}\n\n`;
    text += `👹 *Boss:* ${bossName}\n`;
    text += `🔎 ${bossUrl}`;

    return text;
}

/* =========================
   COMANDO
========================= */

module.exports = async (msg) => {
    try {
        const data = await fetchBoosts();

        if (!data || !data.boss || !data.creature) {
            const errorMsg = await asyncReply(
                msg,
                'No se pudo obtener la información de los boosts en este momento.'
            );
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        const text = formatBoostMessage(data);
        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('ERROR rboosted:', err.response?.status || err.code || err.message);

        const failMessage = err.response?.status === 403
            ? 'La API de RubinotTools bloqueó la petición (Error 403). Intenta de nuevo en un momento.'
            : 'No se pudo obtener la información de los boosts. Intenta de nuevo más tarde.';

        const errorMsg = await asyncReply(msg, failMessage);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
