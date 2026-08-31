// commands/rcharacter.js

// 🔮 Aquí vocation viene como texto ("Master Sorcerer"), a diferencia de rguild
// que la trae como número. Por eso el mapeo es distinto en este comando.
function vocationEmoji(voc) {
    if (!voc) return '❔';
    const v = voc.toLowerCase();
    if (/druid/.test(v)) return '❄️';
    if (/sorcerer/.test(v)) return '🔥';
    if (/knight/.test(v)) return '🛡️';
    if (/paladin/.test(v)) return '🏹';
    if (/monk/.test(v)) return '📿';
    return '❔';
}

function formatDate(unixSeconds) {
    if (!unixSeconds || unixSeconds == 0) return null;
    return new Date(Number(unixSeconds) * 1000).toLocaleDateString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatDeath(d) {
    let text = `Muerto en el nivel ${d.level} por ${d.killed_by}`;
    if (d.mostdamage_by && d.mostdamage_by !== d.killed_by) {
        text += ` (mayor daño por ${d.mostdamage_by})`;
    }
    return text;
}

async function asyncReply(msg, text) {
    try { return await msg.reply(text); } catch { return null; }
}

async function asyncReact(target, emoji) {
    try { await target.react(emoji); } catch {}
}

async function fetchCharacterViaBrowser(client, charName) {
    const page = await client.pupBrowser.newPage();

    try {
        let result = null;

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // 📡 Ruta confirmada: /api/characters/search?name=...
        page.on('response', async (response) => {
            if (!response.url().includes('/api/characters/search')) return;
            try {
                const json = await response.json();
                if (json?.player) result = json;
            } catch {}
        });

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );

        await page.goto(`https://rubinot.com.br/characters?name=${encodeURIComponent(charName)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        if (!result) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return result;

    } finally {
        await page.close();
    }
}

module.exports = async (msg) => {
    const args = msg.body.split(' ').slice(1);
    const charName = args.join(' ').trim();

    if (!charName) {
        const errorMsg = await asyncReply(msg, 'Uso correcto: *!rchar <nombre>*\nEjemplo: *!rchar Null Byte*');
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    try {
        const data = await fetchCharacterViaBrowser(msg.client, charName);
        const player = data?.player;

        if (!player || !player.name) {
            const errorMsg = await asyncReply(msg, `No se encontró el personaje *${charName}* en RubinOT.`);
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        let text = `👤 *${player.name}*\n`;

        // 🔎 Si se encontró por un nombre viejo, avisamos
        if (data.foundByOldName) {
            text += `🔎 _Encontrado por nombre anterior_\n`;
        }

        text += `${vocationEmoji(player.vocation)} Vocación: ${player.vocation}\n`;
        text += `⭐ Nivel: ${player.level}\n`;
        text += `🌍 Mundo: ${player.world}\n`;
        text += `🚻 Sexo: ${player.sex}\n`;
        if (player.residence) text += `🏠 Residencia: ${player.residence}\n`;

        if (player.title) text += `🏷️ Título: ${player.title}\n`;
        if (player.achievementPoints) text += `🏆 Achievement Points: ${player.achievementPoints}\n`;

        if (player.guild?.name) {
            text += `🛡️ Guild: ${player.guild.name}${player.guild.rank ? ` (${player.guild.rank})` : ''}\n`;
        }

        if (player.house) text += `🏘️ Casa: ${player.house}\n`;

        // 📛 Nombres anteriores (si el personaje se ha renombrado)
        if (Array.isArray(player.formerNames) && player.formerNames.length) {
            text += `📛 Nombre(s) anterior(es): ${player.formerNames.join(', ')}\n`;
        }

        const lastLogin = formatDate(player.lastlogin);
        if (lastLogin) text += `🕓 Último login: ${lastLogin}\n`;

        if (Array.isArray(data.deaths) && data.deaths.length) {
            text += `\n☠️ *Últimas muertes*\n`;
            data.deaths.slice(0, 3).forEach(d => {
                const date = formatDate(d.time);
                text += `${date ? `🗓 ${date} — ` : ''}${formatDeath(d)}\n`;
            });
        } else {
            text += `\n☠️ Sin muertes registradas.`;
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
