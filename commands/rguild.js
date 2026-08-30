// commands/rguild.js
const axios = require('axios');

// 🔮 Mapa de vocaciones de RubinOT (incluye Monk/Exalted Monk)
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
        const url = `https://rubinot.com.br/api/guilds/${encodeURIComponent(guildName)}`;

        const res = await axios.get(url, {
            timeout: 15000,
            headers: {
                'Referer': `https://rubinot.com.br/guilds/${encodeURIComponent(guildName)}`,
                'Origin': 'https://rubinot.com.br',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
            }
        });

        const guild = res.data?.guild;

        if (!guild || !Array.isArray(guild.members)) {
            const errorMsg = await asyncReply(msg, `❌ No se encontró la guild *${guildName}* en RubinOT.`);
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        // Leader > Vice Leader > Member, y dentro de cada rango por nivel desc
        const ordered = [...guild.members].sort((a, b) => {
            if (b.rankLevel !== a.rankLevel) return b.rankLevel - a.rankLevel;
            return b.level - a.level;
        });

        let text = `🛡️ *Guild:* ${guild.name}\n`;
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
            const voc = getVocation(m.vocation);
            const status = m.isOnline ? '🟢' : '🔴';
            const prefix = m.rankLevel === 3 ? '' : '* ';
            text += `${prefix}${m.name} · ${m.level} · ${voc.emoji}${status}\n`;
        }

        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('❌ ERROR rguild:', err.response?.status, err.response?.data || err.message);

        const errorMsg = await asyncReply(msg, `❌ No se encontró la guild *${guildName}* en RubinOT.`);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
