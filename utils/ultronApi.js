// utils/ultronApi.js
// 🔧 Módulo compartido para todos los comandos de Ultron.
// Usa el navegador embebido del bot (client.pupBrowser) para pasar Cloudflare,
// igual que hace rubinotApi.js. Incluye caché corta para no repetir visitas.

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

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.time > CACHE_TTL) cache.delete(key);
    }
}, 60 * 1000).unref();

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Abre una pestaña en el navegador del bot, navega a pageUrl y devuelve el HTML.
// Detecta si Cloudflare sigue en "Just a moment..." y lanza error en ese caso.
async function fetchHtmlViaBrowser(client, pageUrl) {
    const page = await client.pupBrowser.newPage();

    try {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent(USER_AGENT);

        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        // Esperar un poco por si Cloudflare tarda en resolver el challenge
        await new Promise(r => setTimeout(r, 3000));

        const html = await page.content();

        if (html.includes('Just a moment') || html.includes('challenge-platform')) {
            throw new Error('Cloudflare sigue bloqueando (incluso con el navegador del bot).');
        }

        return html;
    } finally {
        await page.close();
    }
}

// Devuelve el HTML de la página de una guild de Ultron
async function fetchGuildHtml(client, guildName) {
    const cacheKey = `guild:${guildName.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const encoded = encodeURIComponent(guildName);
    const url = `https://www.ultronot.com/?subtopic=guilds&action=view&GuildName=${encoded}`;
    const html = await fetchHtmlViaBrowser(client, url);

    setCached(cacheKey, html);
    return html;
}

// Devuelve el HTML de la página de warsystem (para !uwarsystem)
async function fetchWarsystemHtml(client) {
    const cacheKey = 'warsystem:html';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = 'https://www.ultronot.com/?subtopic=warsystem';
    const html = await fetchHtmlViaBrowser(client, url);

    setCached(cacheKey, html);
    return html;
}

module.exports = { fetchGuildHtml, fetchWarsystemHtml };
