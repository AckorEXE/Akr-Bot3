const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Convierte el nombre del item al formato correcto de la wiki
 */
function formatItemName(item) {
    const lowercaseWords = ['of', 'the'];
    return item
        .split('_')
        .map(word => {
            if (lowercaseWords.includes(word.toLowerCase())) {
                return word.toLowerCase();
            }
            if (word.length <= 2) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('_');
}

/**
 * Limpia texto basura proveniente del HTML de la wiki
 */
function cleanText(text) {
    return text
        // asegurar espacio después de puntos si no existe
        .replace(/\.([A-Za-z0-9])/g, '. $1')

        // asegurar espacio después de dos puntos
        .replace(/:([A-Za-z0-9])/g, ': $1')

        // normalizar espacios múltiples
        .replace(/\s+/g, ' ')
        .trim();
}


module.exports = async (msg) => {
    try {
        const args = msg.body.split(' ').slice(1);

        // ❌ Uso incorrecto
        if (args.length === 0) {
            const errorMsg = await msg.reply(
                'Uso correcto: *!item <nombre>*\nEjemplo: *!item magic sword*'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const rawName = args.join('_');
        const formattedItem = formatItemName(rawName);
        const url = `https://tibia.fandom.com/wiki/${encodeURIComponent(formattedItem)}`;

        let response;
        try {
            response = await axios.get(url);
        } catch {
            const errorMsg = await msg.reply(
                'No se encontró el ítem en la wiki de Tibia.'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const $ = cheerio.load(response.data);

        let lookText = $('.item-look.tibiatext.tibiagreen').text().trim();
        let droppedByText = $('.item-droppedby-wrapper').text().trim();

        lookText = cleanText(lookText);

        if (droppedByText) {
            droppedByText = cleanText(
                droppedByText.replace(/\n/g, ', ').replace(/,\s*$/, '')
            );
        }

        let tradesText = '';
        const sellToDiv = $('#npc-trade-sellto');

        sellToDiv.find('tr').each((_, element) => {
            const tds = $(element).find('td');
            const npc = tds.eq(0).text().trim();
            const location = tds.eq(1).text().trim();
            const price = tds.eq(2).text().trim().replace(/\s*\u20AC$/, ' Gold');

            if (npc && location && price) {
                tradesText += `👨🏻 ${npc} | 📍 ${location} | 💰 ${price}\n`;
            }
        });

        // ❌ No se encontró información útil
        if (!lookText && !tradesText && !droppedByText) {
            const errorMsg = await msg.reply(
                'No se encontró información útil para ese ítem.'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ✅ Construir respuesta final
        let info = `📦 *${formattedItem.replace(/_/g, ' ')}*\n\n`;

        if (lookText) {
            info += `ℹ️ ${lookText}\n\n`;
        }

        if (tradesText) {
            info += `💹 *Vender a:*\n${tradesText}\n`;
        }

        if (droppedByText) {
            info += `🎁 *Looteado por:* ${droppedByText}\n`;
        }

        info += `\n🔎 ${url}`;

        // ✅ ÉXITO
        return await msg.reply(info);

    } catch (error) {
        console.error('Error en comando item:', error);
        try {
            await msg.react('❎');
        } catch {}
        throw error;
    }
};
