// commands/boosted.js
const axios = require('axios');

const API_URL = 'https://api.rubinottools.com/api/boosts';

/**
 * Convierte un nombre a formato URL para Tibia Fandom.
 * Ej: "Tropical Desolator" -> "Tropical_Desolator"
 * Cada palabra empieza en mayúscula y los espacios se reemplazan por "_".
 */
function toFandomSlug(name) {
    if (!name) return '';
    return name
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('_');
}

/**
 * Obtiene la información de los boosts (Boss y Creature) desde RubinotTools.
 * La API requiere cabeceras específicas para evitar el error 403 (Forbidden).
 */
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

/**
 * Formatea el mensaje con el estilo solicitado y enlaces a la wiki.
 */
function formatBoostMessage(data) {
    const bossName = data.boss?.name || 'Desconocido';
    const creatureName = data.creature?.name || 'Desconocida';

    const bossSlug = toFandomSlug(bossName);
    const creatureSlug = toFandomSlug(creatureName);

    const bossUrl = `https://tibia.fandom.com/wiki/${bossSlug}`;
    const creatureUrl = `https://tibia.fandom.com/wiki/${creatureSlug}`;

    let text = `*🚀 Criaturas Boostadas:*\n`;
    text += `👹 *Boosted Creature:* ${creatureName}\n${creatureUrl}\n`;
    text += `🐾 *Boosted Boss:* ${bossName}\n${bossUrl}`;

    return text;
}

module.exports = async (msg) => {
    try {
        const data = await fetchBoosts();

        if (!data || !data.boss || !data.creature) {
            return await msg.reply('No se pudo obtener la información de los boosts en este momento. La API devolvió datos vacíos.');
        }

        const text = formatBoostMessage(data);
        return await msg.reply(text, undefined, { linkPreview: false });

    } catch (error) {
        console.error('Error en comando boosted:', error.response?.status || error.code || error.message);

        let errorMessage = 'Ocurrió un error al consultar los boosts. ';
        if (error.response?.status === 403) {
            errorMessage += 'La API bloqueó la petición (Error 403). Esto suele pasar si las cabeceras no son las correctas.';
        } else if (error.code === 'ECONNABORTED') {
            errorMessage += 'La petición tardó demasiado. Intenta de nuevo.';
        } else {
            errorMessage += 'Por favor, intenta más tarde.';
        }

        return await msg.reply(errorMessage);
    }
};
