// commands/rwar.js
const axios = require('axios');

// 🌍 Mundos conocidos, usados para auto-detectar en qué mundo pelean las guilds
// cuando el usuario no lo especifica.
const WORLDS = [
    'Auroria', 'Belaria', 'Bellum', 'Drakaria', 'Eldrian',
    'Malveria', 'Obsidian', 'Tenebrium', 'Vesperia'
];

const API_URL = 'https://api.rubinottools.com/api/battles';

/* =========================
   HELPERS
========================= */

function normalizeWorld(input) {
    const found = WORLDS.find(w => w.toLowerCase() === input.toLowerCase());
    if (found) return found;
    // Fallback por si el usuario escribe un mundo fuera de la lista conocida
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

// La API de RubinotTools es sensible a mayúsculas en los nombres de guild
// (ej. "blinders team" no matchea, "Blinders Team" sí). Normalizamos a Title Case.
function titleCase(str) {
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// RubinotTools resetea el ciclo mensual a las 00:00 hora de Brasilia (UTC-3),
// es decir 03:00 UTC. Calculamos el ciclo del mes actual dinámicamente.
function getCurrentCycle() {
    const now = new Date();
    const brasiliaNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const year = brasiliaNow.getUTCFullYear();
    const month = brasiliaNow.getUTCMonth(); // 0-indexed

    const startDate = new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month + 1, 1, 2, 59, 59, 999));

    return { startDate, endDate };
}

function getCycleLabel(startDate) {
    const label = startDate.toLocaleDateString('es-MX', {
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo'
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDeathTime(iso) {
    return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });
}

function hasActivity(data) {
    const s1 = data?.guild1_stats;
    const s2 = data?.guild2_stats;
    if (!s1 || !s2) return false;
    return (s1.kills + s1.deaths + s2.kills + s2.deaths) > 0;
}

/* =========================
   API
========================= */

async function fetchBattle(world, guild1, guild2) {
    const { startDate, endDate } = getCurrentCycle();

    const { data } = await axios.get(API_URL, {
        params: {
            world,
            guild1,
            guild2,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            minLevel: 0
        },
        headers: {
            'Accept': '*/*',
            'Origin': 'https://www.rubinottools.com',
            'Referer': 'https://www.rubinottools.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
        },
        timeout: 10000
    });

    return { world, data, startDate };
}

// Busca la guerra probando todos los mundos en paralelo y se queda con el
// que tenga actividad real (kills/deaths). Si varios mundos tienen datos
// (poco común), se queda con el de mayor actividad total.
async function findBattleAcrossWorlds(guild1, guild2) {
    const attempts = await Promise.allSettled(
        WORLDS.map(world => fetchBattle(world, guild1, guild2))
    );

    // 🔍 DEBUG: log de cada intento fallido para diagnosticar bloqueos/errores
    attempts.forEach((a, i) => {
        if (a.status === 'rejected') {
            const err = a.reason;
            console.log(
                `[rwar DEBUG] ${WORLDS[i]} FALLÓ →`,
                err.response?.status || err.code || err.message
            );
        }
    });

    const rejectedCount = attempts.filter(a => a.status === 'rejected').length;
    if (rejectedCount === WORLDS.length) {
        // Todas las peticiones fallaron (no es que no haya datos, es que la API no respondió)
        const err = new Error('ALL_REQUESTS_FAILED');
        err.isAllFailed = true;
        throw err;
    }

    const valid = attempts
        .filter(a => a.status === 'fulfilled')
        .map(a => a.value)
        .filter(r => hasActivity(r.data));

    if (!valid.length) return null;

    valid.sort((a, b) => {
        const totalA = a.data.guild1_stats.kills + a.data.guild1_stats.deaths +
                       a.data.guild2_stats.kills + a.data.guild2_stats.deaths;
        const totalB = b.data.guild1_stats.kills + b.data.guild1_stats.deaths +
                       b.data.guild2_stats.kills + b.data.guild2_stats.deaths;
        return totalB - totalA;
    });

    return valid[0];
}

/* =========================
   FORMATO DEL MENSAJE
========================= */

function formatGuildBlock(name, stats, emoji) {
    let text = `${emoji} *${name}*\n`;
    text += `☠️ Asesinatos: ${stats.kills}  |  💀 Muertes: ${stats.deaths}\n`;
    text += `🏆 Puntuación: ${stats.total_score}  (+${stats.score_gain} / -${stats.score_penalty})\n`;
    if (stats.top_killer?.name) {
        text += `🎯 Top Asesino: ${stats.top_killer.name} (${stats.top_killer.count})\n`;
    }
    if (stats.top_feeder?.name) {
        text += `🪦 Top Asesinado: ${stats.top_feeder.name} (${stats.top_feeder.count})\n`;
    }
    text += `📊 Nivel prom. rival: ${stats.avg_victim_level}\n`;
    return text;
}

function guildEmoji(guildName, guild1, guild2) {
    if (guildName === guild1) return '🟩';
    if (guildName === guild2) return '🟥';
    return '';
}

function formatKillfeed(deaths, guild1, guild2, limit = 5) {
    if (!Array.isArray(deaths) || !deaths.length) return '';

    let text = `\n☠️ *Últimas muertes*\n`;
    deaths.slice(0, limit).forEach(d => {
        const emoji = guildEmoji(d.killer_guild, guild1, guild2);
        text += `🗓️ ${formatDeathTime(d.death_time)} — ${emoji} ${d.killer_name} ➜ ${d.victim_name} (${d.victim_level}) +${d.frag_score}\n`;
    });
    return text;
}

async function asyncReply(msg, text) {
    try { return await msg.reply(text); } catch { return null; }
}

async function asyncReact(target, emoji) {
    try { await target.react(emoji); } catch {}
}

/* =========================
   COMANDO
========================= */

module.exports = async (msg) => {
    const body = msg.body.split(' ').slice(1).join(' ').trim();

    const usage =
        'Uso correcto: *!rwar guild1, guild2, mundo*\n' +
        'Ejemplo: *!rwar Blinders Team, Warfire Leidorasga, Drakaria*\n' +
        '_El mundo es opcional — si lo omites, lo busco en todos los mundos._';

    if (!body) {
        const errorMsg = await asyncReply(msg, usage);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    const parts = body.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length < 2) {
        const errorMsg = await asyncReply(msg, usage);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    const [guild1Raw, guild2Raw, worldRaw] = parts;
    const guild1 = titleCase(guild1Raw);
    const guild2 = titleCase(guild2Raw);

    try {
        let result;

        if (worldRaw) {
            const world = normalizeWorld(worldRaw);
            result = await fetchBattle(world, guild1, guild2);

            if (!hasActivity(result.data)) {
                const errorMsg = await asyncReply(
                    msg,
                    `No se encontraron enfrentamientos entre *${guild1}* y *${guild2}* en ${world} este ciclo.`
                );
                await asyncReact(errorMsg, '❎');
                await asyncReact(msg, '❎');
                return null;
            }
        } else {
            result = await findBattleAcrossWorlds(guild1, guild2);

            if (!result) {
                const errorMsg = await asyncReply(
                    msg,
                    `No se encontraron enfrentamientos entre *${guild1}* y *${guild2}* en ningún mundo este ciclo.`
                );
                await asyncReact(errorMsg, '❎');
                await asyncReact(msg, '❎');
                return null;
            }
        }

        const { world, data, startDate } = result;
        const stats1 = data.guild1_stats;
        const stats2 = data.guild2_stats;

        let text = `⚔️ *${guild1}* 🆚 *${guild2}*\n`;
        text += `🌍 ${world} · 🗓️ ${getCycleLabel(startDate)}\n\n`;

        text += formatGuildBlock(guild1, stats1, '🟩') + '\n';
        text += formatGuildBlock(guild2, stats2, '🟥') + '\n';

        if (stats1.total_score !== stats2.total_score) {
            const winner = stats1.total_score > stats2.total_score
                ? { name: guild1, diff: stats1.total_score - stats2.total_score }
                : { name: guild2, diff: stats2.total_score - stats1.total_score };
            text += `👑 Ganando: *${winner.name}* (+${winner.diff} pts)\n`;
        } else {
            text += `🤝 Empate en score.\n`;
        }

        text += formatKillfeed(data.deaths, guild1, guild2);

        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('ERROR rwar:', err.response?.status || err.code || err.message);

        const failMessage = err.isAllFailed
            ? `No se pudo contactar la API de RubinotTools ahora mismo. Intenta de nuevo en un momento.`
            : `No se pudo obtener la guerra entre *${guild1}* y *${guild2}*. Verifica los nombres de las guilds.`;

        const errorMsg = await asyncReply(msg, failMessage);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
