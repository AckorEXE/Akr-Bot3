// utils/ultronotApi.js
// 🔧 Módulo compartido para los comandos de UltronOT (!uguild, !uchar).
// Usa el navegador embebido de whatsapp-web.js (puppeteer) para pasar
// Cloudflare. UltronOT no tiene API JSON, así que devolvemos el HTML ya
// renderizado y cada comando lo parsea.

const BASE_URL = 'https://ultronot.com';
const CACHE_TTL = 45 * 1000; // 45s
const CHALLENGE_TIMEOUT = 25 * 1000; // tiempo máx. para que Cloudflare nos deje pasar

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ¿Seguimos en la pantalla de verificación de Cloudflare?
function isChallenge(title, html) {
    if (/just a moment|un momento|attention required|checking your browser/i.test(title)) return true;
    if (/cf-browser-verification|challenge-error-text|Verifying you are human|Verificando que usted es humano/i.test(html)) return true;
    return false;
}

// Abre una pestaña, navega a url, espera a que Cloudflare se resuelva
// y devuelve el HTML final.
// Nota: las cookies (cf_clearance) quedan en el contexto del navegador, así
// que después de la primera vez las siguientes consultas suelen pasar directo.
async function fetchHtmlViaBrowser(client, url) {
    const page = await client.pupBrowser.newPage();

    try {
        await page.setUserAgent(USER_AGENT);

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'media', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const deadline = Date.now() + CHALLENGE_TIMEOUT;
        while (Date.now() < deadline) {
            // durante la redirección del challenge el contexto puede destruirse; lo ignoramos y reintentamos
            const title = await page.title().catch(() => '');
            const html = await page.content().catch(() => '');

            if (html && !isChallenge(title, html)) return html;
            await sleep(1000);
        }

        throw new Error('No se pudo pasar la verificación de Cloudflare');

    } finally {
        await page.close().catch(() => {});
    }
}

async function fetchHtml(client, url) {
    const cacheKey = `html:${url.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const html = await fetchHtmlViaBrowser(client, url);
    setCached(cacheKey, html);
    return html;
}

// Guild → HTML de la página de la guild
function fetchGuildHtml(client, guildName) {
    return fetchHtml(
        client,
        `${BASE_URL}/?subtopic=guilds&action=view&GuildName=${encodeURIComponent(guildName)}`
    );
}

// Character → HTML de la página del personaje
function fetchCharacterHtml(client, charName) {
    return fetchHtml(
        client,
        `${BASE_URL}/?subtopic=characters&name=${encodeURIComponent(charName)}`
    );
}

module.exports = { fetchGuildHtml, fetchCharacterHtml };
