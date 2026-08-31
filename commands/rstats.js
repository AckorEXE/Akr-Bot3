// commands/rstats.js
const { fetchGuild } = require('../utils/rubinotApi');

function baseVocation(id) {
    if (id === 1 || id === 5) return 'Sorcerer';
    if (id === 2 || id === 6) return 'Druid';
    if (id === 3 || id === 7) return 'Paladin';
    if (id === 4 || id === 8) return 'Knight';
    if (id === 9 || id === 10) return 'Monk';
    return 'Otro';
}

function vocIcon(v) {
    return v === 'Knight' ? '🛡️'
        : v === 'Paladin' ? '🏹'
        : v === 'Druid' ? '❄️'
        : v === 'Sorcerer' ? '🔥'
        : v === 'Monk' ? '📿'
        : '❔';
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[mid];
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
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
        const errorMsg = await asyncReply(msg, 'Uso correcto: *!rstats <nombre>*\nEjemplo: *!rstats Blinders Team*');
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    try {
        const guild = await fetchGuild(msg.client, guildName);

        if (!guild || !Array.isArray(guild.members) || !guild.members.length) {
            const errorMsg = await asyncReply(msg, `No se encontró la guild *${guildName}* en RubinOT.`);
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        const members = guild.members;
        const levels = members.map(m => m.level);
        const avg = Math.round(levels.reduce((s, l) => s + l, 0) / levels.length);
        const med = median(levels);

        const top = members.reduce((a, b) => (b.level > a.level ? b : a), members[0]);
        const lowest = members.reduce((a, b) => (b.level < a.level ? b : a), members[0]);

        const above = levels.filter(l => l > avg).length;
        const below = levels.filter(l => l < avg).length;

        const vocCount = {};
        for (const m of members) {
            const v = baseVocation(m.vocation);
            vocCount[v] = (vocCount[v] || 0) + 1;
        }

        const online = members.filter(m => m.isOnline).length;
        const offline = members.length - online;

        const rankCount = {};
        for (const m of members) {
            rankCount[m.rank] = (rankCount[m.rank] || 0) + 1;
        }

        let text = `📊 *Estadísticas Guild: ${guild.name}*\n`;
        text += `👥 Miembros totales: ${members.length}\n`;

        text += `\n🏆 *Top nivel:* ${vocIcon(baseVocation(top.vocation))} ${top.name} ${top.isOnline ? '🟢' : '🔴'} ${top.level}\n`;
        text += `📉 *Nivel más bajo:* ${vocIcon(baseVocation(lowest.vocation))} ${lowest.name} ${lowest.isOnline ? '🟢' : '🔴'} ${lowest.level}\n`;
        text += `⚖️ *Nivel promedio:* ${avg}\n`;
        text += `📐 *Mediana de nivel:* ${med}\n`;
        text += `📈 Sobre el promedio: ${above}\n`;
        text += `📉 Bajo el promedio: ${below}\n`;

        text += `\n🧙 *Vocaciones:*\n`;
        const vocOrder = ['Knight', 'Paladin', 'Druid', 'Sorcerer', 'Monk', 'Otro'];
        for (const v of vocOrder) {
            if (vocCount[v]) {
                text += `${vocIcon(v)} ${v}: ${vocCount[v]}\n`;
            }
        }

        text += `\n🟢 Conectados: ${online}\n`;
        text += `🔴 Desconectados: ${offline}\n`;

        text += `\n📜 *Rangos:*\n`;
        text += Object.entries(rankCount)
            .sort((a, b) => b[1] - a[1])
            .map(([rank, count]) => `${rank}: ${count}`)
            .join(' | ');

        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('ERROR rstats:', err.message);
        const errorMsg = await asyncReply(msg, `No se encontró la guild *${guildName}* en RubinOT.`);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
