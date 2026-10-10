const { fetchGuildHtml } = require('../utils/ultronotApi');

function vocationEmoji(voc) {
    const v = voc.toLowerCase();
    if (/druid/.test(v)) return '❄️';
    if (/sorcerer/.test(v)) return '🔥';
    if (/knight/.test(v)) return '⚔️';
    if (/paladin/.test(v)) return '🏹';
    return '❔';
}

function parseGuildMembers(html) {
    const members = [];

    const tableMatch = html.match(/Guild Members[\s\S]*?<table\s+class="TableContent"[\s\S]*?<\/table>/i);
    if (!tableMatch) return members;

    const table = tableMatch[0];
    const rowRegex = /<TR[^>]*>([\s\S]*?)<\/TR>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(table)) !== null) {
        const row = rowMatch[1];

        if (/LabelH/i.test(row)) continue;

        const tds = [...row.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/gi)].map(m => m[1]);
        if (tds.length < 4) continue;

        const rank = tds[0].replace(/<[^>]+>/g, '').trim();
        const nameMatch = tds[1].match(/<A[^>]*>([\s\S]*?)<\/A>/i);
        const name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : tds[1].replace(/<[^>]+>/g, '').trim();
        const vocation = tds[2].replace(/<[^>]+>/g, '').trim();
        const level = tds[3].replace(/<[^>]+>/g, '').trim();
        const statusRaw = tds[4] || '';
        const isOnline = /green/i.test(statusRaw);

        if (!name && !vocation && !level) continue;

        members.push({
            rank: rank || 'Member',
            name,
            vocation,
            level: parseInt(level) || 0,
            online: isOnline
        });
    }

    return members;
}

async function asyncReply(msg, text) {
    try { return await msg.reply(text); } catch { return null; }
}

async function asyncReact(target, emoji) {
    try { await target.react(emoji); } catch {}
}

module.exports = async (msg) => {
    // whatsapp-web.js expone el client en cada mensaje
    // (si tu handler lo pasa como segundo parámetro, cámbialo a: async (msg, client) => {...)
    const client = msg.client;

    const args = msg.body.split(' ').slice(1);
    const guildName = args.join(' ').trim();

    try {
        if (!guildName) {
            const errorMsg = await asyncReply(msg, '*Uso correcto:* `!uguild <guild>`\nEjemplo: `!uguild Levanton`');
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        const html = await fetchGuildHtml(client, guildName);
        const members = parseGuildMembers(html);

        if (!members.length) {
            const errorMsg = await asyncReply(msg, `No se encontró la guild *${guildName}* en UltronOT.`);
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        const rankOrder = { Leader: 0, ViceLeader: 1, Member: 2 };
        const ordered = members.sort((a, b) => {
            const ra = rankOrder[a.rank] !== undefined ? rankOrder[a.rank] : 3;
            const rb = rankOrder[b.rank] !== undefined ? rankOrder[b.rank] : 3;
            if (ra !== rb) return ra - rb;
            return b.level - a.level;
        });

        let text = `🛡️ *Guild:* ${guildName}\n👥 *Miembros:* ${members.length}\n`;

        let currentRank = null;
        for (const m of ordered) {
            if (m.rank !== currentRank) {
                currentRank = m.rank;
                const rankEmoji = currentRank === 'Leader' ? '🧙' : currentRank === 'ViceLeader' ? '👑' : '🛡';
                text += `\n${rankEmoji} *${currentRank}*\n`;
            }
            const status = m.online ? '🟢' : '🔴';
            const prefix = m.rank === 'Leader' ? '' : '* ';
            text += `${prefix}${m.name} · ${m.level} · ${vocationEmoji(m.vocation)}${status}\n`;
        }

        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('❌ ERROR uguild:', err.message);
        const errorMsg = await asyncReply(msg, `No se pudo consultar la guild *${guildName}* en UltronOT.`);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
