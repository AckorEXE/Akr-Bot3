// commands/rchar.js
const { fetchCharacter } = require('../utils/rubinotApi');

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
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });
}

function formatDeath(d) {
    let text = `Muerto en el nivel ${d.level} por ${d.killed_by}`;
    if (d.mostdamage_by && d.mostdamage_by !== d.killed_by) {
        text += ` (mayor daño por ${d.mostdamage_by})`;
    }
    return text;
}

// 🏘️ La casa viene como objeto { id, name, town_id, rent, size } o null
function formatHouse(house) {
    if (!house) return null;
    if (typeof house === 'string') return house;
    if (typeof house === 'object' && house.name) return house.name;
    return null;
}

// 🟢🔴 Solo se puede determinar buscando al propio personaje dentro de
// otherCharacters (aparece si la cuenta tiene más de un char y no está oculta).
// Si no aparece (ej. char único, o isHidden), no hay dato → usar emoji neutro.
function statusEmoji(player, otherCharacters) {
    if (!Array.isArray(otherCharacters) || !otherCharacters.length) return '👤';

    const self = otherCharacters.find(c => c.name === player.name);
    if (!self || typeof self.isOnline !== 'boolean') return '👤';

    return self.isOnline ? '🟢' : '🔴';
}

async function asyncReply(msg, text) {
    try { return await msg.reply(text); } catch { return null; }
}

async function asyncReact(target, emoji) {
    try { await target.react(emoji); } catch {}
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
        const data = await fetchCharacter(msg.client, charName);
        const player = data?.player;

        if (!player || !player.name) {
            const errorMsg = await asyncReply(msg, `No se encontró el personaje *${charName}* en RubinOT.`);
            await asyncReact(errorMsg, '❎');
            await asyncReact(msg, '❎');
            return null;
        }

        const emoji = statusEmoji(player, data.otherCharacters);
        let text = `${emoji} *${player.name}*\n`;

        if (data.foundByOldName) {
            text += `🔎 _Encontrado por nombre anterior_\n`;
        }

        text += `${vocationEmoji(player.vocation)} *Vocación:* ${player.vocation}\n`;
        text += `⭐ *Nivel:* ${player.level}\n`;
        text += `🌍 *Mundo:* ${player.world}\n`;
        text += `🚻 *Sexo:* ${player.sex}\n`;
        if (player.residence) text += `🏠 *Residencia:* ${player.residence}\n`;

        if (player.title) text += `🏷️ *Título:* ${player.title}\n`;
        if (player.achievementPoints) text += `🏆 *Achievement Points:* ${player.achievementPoints}\n`;

        if (player.guild?.name) {
            text += `🛡️ *Guild:* ${player.guild.name}${player.guild.rank ? ` (${player.guild.rank})` : ''}\n`;
        }

        const houseText = formatHouse(player.house);
        if (houseText) text += `🏘️ *Casa:* ${houseText}\n`;

        if (Array.isArray(player.formerNames) && player.formerNames.length) {
            text += `📛 *Nombre(s) anterior(es):* ${player.formerNames.join(', ')}\n`;
        }

        const lastLogin = formatDate(player.lastlogin);
        if (lastLogin) text += `🕓 *Último login:* ${lastLogin}\n`;

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
        console.log('ERROR rchar:', err.message);
        const errorMsg = await asyncReply(msg, `No se encontró el personaje *${charName}* en RubinOT.`);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
