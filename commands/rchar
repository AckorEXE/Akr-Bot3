// commands/rchar.js

const VOCATIONS = {
    0:  { name: 'None',            emoji: '❔' },
    1:  { name: 'Sorcerer',        emoji: '🔥' },
    2:  { name: 'Druid',           emoji: '❄️' },
    3:  { name: 'Paladin',         emoji: '🏹' },
    4:  { name: 'Knight',          emoji: '🛡️' },
    5:  { name: 'Master Sorcerer', emoji: '🔥' },
    6:  { name: 'Elder Druid',     emoji: '❄️' },
    7:  { name: 'Royal Paladin',   emoji: '🏹' },
    8:  { name: 'Elite Knight',    emoji: '🛡️' },
    9:  { name: 'Monk',            emoji: '📿' },
    10: { name: 'Exalted Monk',    emoji: '📿' },
};

function getVocation(id) {
    return VOCATIONS[id] || { name: 'Unknown', emoji: '❔' };
}

function formatDate(unixSeconds) {
    if (!unixSeconds) return null;
    return new Date(unixSeconds * 1000).toLocaleDateString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

async function asyncReply(msg, text) {
    try { return await msg.reply(text); } catch { return null; }
}

async function asyncReact(target, emoji) {
    try { await target.react(emoji); } catch {}
}

// 🔎 Igual que en rguild.js: usamos el navegador de whatsapp-web.js para pasar Cloudflare
async function fetchCharacterViaBrowser(client, charName) {
    const page = await client.pupBrowser.newPage();

    try {
        let charData = null;
        let apiError = null;
        let rawJson = null; // 🐛 para debug si los campos no coinciden

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.on('response', async (response) => {
            if (!response.url().includes('/api/characters/')) return;
            try {
                const json = await response.json();
                rawJson = json;
                if (json?.character) charData = json.character;
                else if (json?.error) apiError = json.error;
            } catch {}
        });

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );

        await page.goto(`https://rubinot.com.br/characters/${encodeURIComponent(charName)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        if (!charData && !apiError) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // 🐛 DEBUG: si no se pudo armar charData pero sí llegó JSON, lo dejamos en consola
        if (!charData && rawJson) {
            console.log('🐛 rcharacter - JSON crudo recibido (revisar nombres de campos):');
            console.log(JSON.stringify(rawJson, null, 2));
        }

        if (apiError) throw new Error(apiError);
        return charData;

    } finally {
        await page.close();
    }
}

module.exports = async (msg) => {
    const args = msg.body.split(' ').slice(1);
    const charName = args.join(' ').trim();

    if (!charName) {
        const errorMsg = await asyncReply(msg, 'Uso correcto: *!rcharacter <nombre>*\nEjemplo: *!rcharacter Null Byte*');
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    try {
        const char = await fetchCharacterViaBrowser(msg.client, charName);

        if (!char || !char.name) {
            const errorMsg = await asyncReply(msg, `No se encontró el personaje *${charName}* en RubinOT.`);
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        const voc = getVocation(char.vocation);
        const online = char.isOnline === true ? '🟢 Conectado' : char.isOnline === false ? '🔴 Desconectado' : '🟡 No disponible';

        let text = `👤 *${char.name}*\n`;
        text += `${online}\n`;
        text += `${voc.emoji} Vocación: ${voc.name}\n`;
        text += `⭐ Nivel: ${char.level ?? 'N/A'}\n`;
        text += `🌍 Mundo: ${char.worldName || char.world || 'N/A'}\n`;

        if (char.residence) text += `🏠 Residencia: ${char.residence}\n`;

        if (char.guild?.name) {
            text += `🛡️ Guild: ${char.guild.name}${char.guild.rank ? ` (${char.guild.rank})` : ''}\n`;
        }

        const lastLogin = formatDate(char.lastLoginDate || char.lastLogin);
        if (lastLogin) text += `🕓 Último login: ${lastLogin}\n`;

        if (Array.isArray(char.deaths) && char.deaths.length) {
            const last = char.deaths[0];
            const deathDate = formatDate(last.date || last.time);
            text += `\n☠️ *Última muerte*\n`;
            if (deathDate) text += `🗓 ${deathDate}\n`;
            text += `${last.reason || last.text || 'Sin detalles'}`;
        } else {
            text += `\n☠️ *Última muerte*\nSin muertes registradas.`;
        }

        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('ERROR rcharacter:', err.message);
        const errorMsg = await asyncReply(msg, `No se encontró el personaje *${charName}* en RubinOT.`);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
