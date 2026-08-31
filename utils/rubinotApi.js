// utils/rubinotApi.js
// 🔧 Módulo compartido para todos los comandos de RubinOT.
// Centraliza el navegador embebido (para pasar Cloudflare) y agrega
// una caché corta para no abrir pestaña dos veces si alguien usa
// !rguild y !rstats seguido sobre la misma guild.

const CACHE_TTL = 45 * 1000; // 45s

const cache = new Map();

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.time > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function setCached(key, value) {
    cache.set(key, { value, time: Date.now() });
}

// limpieza periódica para no dejar crecer el Map indefinidamente
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.time > CACHE_TTL) cache.delete(key);
    }
}, 60 * 1000).unref();

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Abre una pestaña en el navegador de whatsapp-web.js, navega a pageUrl,
// e intercepta la respuesta JSON cuya URL contenga matchUrl.
async function fetchViaBrowser(client, { pageUrl, matchUrl }) {
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

        page.on('response', async (response) => {
            if (!response.url().includes(matchUrl)) return;
            try {
                result = await response.json();
            } catch {}
        });

        await page.setUserAgent(USER_AGENT);

        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        if (!result) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return result;

    } finally {
        await page.close();
    }
}

// Guild (usado por !rguild y !rstats)
async function fetchGuild(client, guildName) {
    const cacheKey = `guild:${guildName.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const json = await fetchViaBrowser(client, {
        pageUrl: `https://rubinot.com.br/guilds/${encodeURIComponent(guildName)}`,
        matchUrl: '/api/guilds/'
    });

    if (json?.error) throw new Error(json.error);

    const guild = json?.guild || null;
    if (guild) setCached(cacheKey, guild);
    return guild;
}

// Character (usado por !rchar)
async function fetchCharacter(client, charName) {
    const cacheKey = `char:${charName.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const json = await fetchViaBrowser(client, {
        pageUrl: `https://rubinot.com.br/characters?name=${encodeURIComponent(charName)}`,
        matchUrl: '/api/characters/search'
    });

    if (json?.player) setCached(cacheKey, json);
    return json;
}

module.exports = { fetchGuild, fetchCharacter };
