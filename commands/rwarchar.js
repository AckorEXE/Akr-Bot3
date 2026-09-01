// commands/rwarchar.js
const axios = require('axios');

// 🌍 Mundos conocidos, usados para auto-detectar en qué mundo está el personaje
// cuando el usuario no lo especifica.
const WORLDS = [
    'Auroria', 'Belaria', 'Bellum', 'Drakaria', 'Eldrian',
    'Malveria', 'Obsidian', 'Tenebrium', 'Vesperia'
];

const API_URL = 'https://api.rubinottools.com/api/character-search';

/* =========================
   HELPERS
========================= */

function normalizeWorld(input) {
    const found = WORLDS.find(w => w.toLowerCase() === input.toLowerCase());
    if (found) return found;
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

// La API devuelve el nombre tal cual lo buscó el usuario (ej. "null byte").
// Lo normalizamos a Title Case para mostrarlo bonito: "Null Byte".
function titleCase(str) {
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// RubinotTools usa el ciclo mensual con corte a las 00:00 hora de Brasilia (UTC-3).
function getCurrentMonthYear() {
    const now = new Date();
    const brasiliaNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return { month: brasiliaNow.getUTCMonth() + 1, year: brasiliaNow.getUTCFullYear() };
}

function getCycleLabel(month, year) {
    const date = new Date(Date.UTC(year, month - 1, 1));
    const label = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateTime(iso) {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('es-MX', {
        day: '2-digit', month: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });
    const timePart = d.toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'America/Sao_Paulo'
    });
    return `${datePart}, ${timePart}`;
}

function hasData(data) {
    return !!data?.found;
}

/* =========================
   API
========================= */

async function fetchCharacterWar(world, name, month, year) {
    const { data } = await axios.get(API_URL, {
        params: { world, name, month, year },
        headers: {
            'Accept': '*/*',
            'Origin': 'https://www.rubinottools.com',
            'Referer': 'https://www.rubinottools.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
        },
        timeout: 10000
    });

    return { world, data };
}

// Busca al personaje probando todos los mundos en paralelo cuando no se
// especifica uno. Se queda con el primero que exista (found: true); si hay
// más de uno (nombre repetido entre mundos), toma el de mayor actividad.
async function findCharacterAcrossWorlds(name, month, year) {
    const attempts = await Promise.allSettled(
        WORLDS.map(world => fetchCharacterWar(world, name, month, year))
    );

    const rejectedCount = attempts.filter(a => a.status === 'rejected').length;
    if (rejectedCount === WORLDS.length) {
        const err = new Error('ALL_REQUESTS_FAILED');
        err.isAllFailed = true;
        throw err;
    }

    const valid = attempts
        .filter(a => a.status === 'fulfilled')
        .map(a => a.value)
        .filter(r => hasData(r.data));

    if (!valid.length) return null;

    valid.sort((a, b) => {
        const totalA = (a.data.stats?.kills || 0) + (a.data.stats?.deaths || 0);
        const totalB = (b.data.stats?.kills || 0) + (b.data.stats?.deaths || 0);
        return totalB - totalA;
    });

    return valid[0];
}

/* =========================
   FORMATO DEL MENSAJE
========================= */

function formatVictims(victims, limit = 5) {
    if (!Array.isArray(victims) || !victims.length) return '_Sin registros_\n';

    const sorted = [...victims].sort((a, b) => new Date(b.last_kill) - new Date(a.last_kill));

    return sorted.slice(0, limit)
        .map(v => {
            const sign = v.score >= 0 ? '+' : '';
            return `🗓️ ${formatDateTime(v.last_kill)} — ${v.target_name} (${v.level}) ${sign}${v.score}`;
        })
        .join('\n') + '\n';
}

function formatKillers(killers, limit = 5) {
    if (!Array.isArray(killers) || !killers.length) return '_Sin registros_\n';

    const sorted = [...killers].sort((a, b) => new Date(b.last_death) - new Date(a.last_death));

    return sorted.slice(0, limit)
        .map(k => {
            const sign = k.score >= 0 ? '+' : '';
            return `🗓️ ${formatDateTime(k.last_death)} — ${k.killer_name} (${k.level}) ${sign}${k.score}`;
        })
        .join('\n') + '\n';
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
        'Uso correcto: *!rwarchar nombre, mundo*\n' +
        'Ejemplo: *!rwarchar null byte, Drakaria*\n' +
        '_El mundo es opcional — si lo omites, lo busco en todos los mundos._';

    if (!body) {
        const errorMsg = await asyncReply(msg, usage);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    const parts = body.split(',').map(p => p.trim()).filter(Boolean);
    const [name, worldRaw] = parts;

    if (!name) {
        const errorMsg = await asyncReply(msg, usage);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }

    const { month, year } = getCurrentMonthYear();

    try {
        let result;

        if (worldRaw) {
            const world = normalizeWorld(worldRaw);
            result = await fetchCharacterWar(world, name, month, year);

            if (!hasData(result.data)) {
                const errorMsg = await asyncReply(
                    msg,
                    `No se encontró a *${name}* en ${world} este ciclo.`
                );
                await asyncReact(errorMsg, '❎');
                await asyncReact(msg, '❎');
                return null;
            }
        } else {
            result = await findCharacterAcrossWorlds(name, month, year);

            if (!result) {
                const errorMsg = await asyncReply(
                    msg,
                    `No se encontró a *${name}* en ningún mundo este ciclo.`
                );
                await asyncReact(errorMsg, '❎');
                await asyncReact(msg, '❎');
                return null;
            }
        }

        const { world, data } = result;
        const s = data.stats;

        let text = `👤 *${titleCase(s.name)}*\n`;
        text += `🏅 *Rank* #${s.rank}  ·  ⭐ *Nivel:* ${s.level}\n🛡️ *${s.guild ? s.guild : 'Sin Guild'}*\n`;
        text += `🌍 ${world} · 🗓️ ${getCycleLabel(month, year)}\n\n`;

        text += `🏆 *Puntuación total:* ${s.final_score}\n`;
        text += `☠️ *Asesinatos:* ${s.kills}  |  💀 *Muertes:* ${s.deaths}\n`;
        if (s.top_prey?.name) text += `🎯 *Víctima Destacada:* ${s.top_prey.name} (${s.top_prey.count}x)\n`;
        if (s.top_predator?.name) text += `🩸 *Rival Principal:* ${s.top_predator.name} (${s.top_predator.count}x)\n`;
        text += `📊 *Nivel prom. víctimas:* ${s.avg_victim_level}\n`;

        text += `\n🗡️ *Últimas víctimas*\n`;
        text += formatVictims(data.victims);

        text += `\n☠️ *Últimas muertes*\n`;
        text += formatKillers(data.killers);

        return asyncReply(msg, text.trim());

    } catch (err) {
        console.log('ERROR rwarchar:', err.response?.status || err.code || err.message);

        const failMessage = err.isAllFailed
            ? `No se pudo contactar la API de RubinotTools ahora mismo. Intenta de nuevo en un momento.`
            : `No se pudo obtener el personaje *${name}*. Verifica el nombre.`;

        const errorMsg = await asyncReply(msg, failMessage);
        await asyncReact(errorMsg, '❎');
        await asyncReact(msg, '❎');
        return null;
    }
};
