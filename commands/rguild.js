// commands/rguild.js
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

async function asyncReply(msg, text) {
    try { return await msg.reply(text); } catch { return null; }
}

async function asyncReact(target, emoji) {
    try { await target.react(emoji); } catch {}
}

// 🔎 Usa el mismo navegador de whatsapp-web.js para pasar el challenge de Cloudflare
async function fetchGuildViaBrowser(client, guildName) {
    const page = await client.pupBrowser.newPage();

    try {
        let guildData = null;
        let apiError = null;

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.on('response', async (response) => {
            if (!response.url().includes('/api/guilds/')) return;
            try {
                const json = await response.json();
                if (json?.guild) guildData = json.guild;
                else if (json?.error) apiError = json.error;
            } catch {}
        });

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );

        await page.goto(`https://rubinot.com.br/guilds/${encodeURIComponent(guildName)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        if (!guildData && !apiError) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (apiError) throw new Error(apiError);
        return guildData;

    } finally {
        await page.close();
    }
}

module.exports = async (msg) => {
    const args = msg.body.split(' ').slice(1);
    const guildName = args.join(' ').trim();

    if (!guildName) {
        const errorMsg = await asyncReply(msg, 'Uso correcto: *!rguild <nombre>*\nEjemplo: *!rguild Blinders Team*');
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    try {
        const guild = await fetchGuildViaBrowser(msg.client, guildName);

        if (!guild || !Array.isArray(guild.members)) {
            const errorMsg = await asyncReply(msg, `No se encontró la guild *${guildName}* en RubinOT.`);
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        const ordered = [...guild.members].sort((a, b) => {
            if (b.rankLevel !== a.rankLevel) return b.rankLevel - a.rankLevel;
            return b.level - a.level;
        });

        let text = `🔰 *Guild:* ${guild.name}\n`;
        text += `🌍 *Mundo:* ${guild.worldName}\n`;
        text += `👥 *Miembros:* ${guild.members.length}\n`;
        if (guild.residence?.name) {
            text += `🏰 *Guild Hall:* ${guild.residence.name}`;
            if (guild.residence.town) text += ` (${guild.residence.town})`;
            text += `\n`;
        }

        let currentRank = null;
        for (const m of ordered) {
            if (m.rank !== currentRank) {
                currentRank = m.rank;
                const rankEmoji = m.rankLevel === 3 ? '🧙' : m.rankLevel === 2 ? '👑' : '🛡';
                text += `\n${rankEmoji} *${currentRank}*\n`;
            }
            // 🔧 bullet "•" para TODOS (incluyendo Leader), sin asteriscos sueltos
            const voc = getVocation(m.vocation);
            const status = m.isOnline ? '🟢' : '🔴';
            text += `• ${m.name} · ${m.level} · ${voc.emoji}${status}\n`;
        }

        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('ERROR rguild:', err.message);
        const errorMsg = await asyncReply(msg, `No se encontró la guild *${guildName}* en RubinOT.`);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
