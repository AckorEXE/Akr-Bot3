const { MessageMedia } = require('whatsapp-web.js');
const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const execFileAsync = promisify(execFile);

// ─── Config ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB   = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const COOKIES_FILE       = path.join(process.cwd(), 'cookies_twitter.txt');

// ─── Reconversión de video a h264 (requerido por WhatsApp Web) ────────────
// WhatsApp Web SOLO acepta MP4 con codec libx264. TikTok, X, Instagram
// usan h265/hevc/av1 → causa el error "t: t" en Puppeteer al enviar.
async function reencodeToH264(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '28',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart',
                '-pix_fmt', 'yuv420p',
            ])
            .toFormat('mp4')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

// Instancias de cobalt a intentar en orden (fallback automático)
// Agrega o quita según disponibilidad; la primera que responda gana
const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt.api.royalehosting.net',
    'https://co.wuk.sh',
];

// ─── MIME types ────────────────────────────────────────────────────────────
const MIME_BY_EXT = {
    mp4:  'video/mp4',
    webm: 'video/webm',
    mkv:  'video/x-matroska',
    mov:  'video/quicktime',
    avi:  'video/x-msvideo',
    mp3:  'audio/mpeg',
    m4a:  'audio/mp4',
    ogg:  'audio/ogg',
    opus: 'audio/ogg',
    wav:  'audio/wav',
    flac: 'audio/flac',
    webp: 'image/webp',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    gif:  'image/gif',
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function detectFile(basePath) {
    for (const ext of Object.keys(MIME_BY_EXT)) {
        const candidate = `${basePath}.${ext}`;
        if (fs.existsSync(candidate)) return { filePath: candidate, ext };
    }
    return null;
}

function getMime(ext) {
    return MIME_BY_EXT[ext.toLowerCase()] || 'application/octet-stream';
}

function isValidUrl(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
}

function isTwitterUrl(url) {
    try {
        const h = new URL(url).hostname.replace('www.', '');
        return ['x.com', 'twitter.com', 't.co'].includes(h);
    } catch { return false; }
}

async function getYtDlpPath() {
    try { await execFileAsync('yt-dlp', ['--version']); return 'yt-dlp'; } catch {}
    const local = path.join(process.cwd(), 'yt-dlp');
    if (fs.existsSync(local)) return local;
    return null;
}

// ──────────────────────────────────────────────────────────────────────────
// MÉTODO 1: Cobalt API
// Intenta cada instancia en orden hasta obtener una URL de descarga válida.
// Cobalt devuelve: { status: 'tunnel'|'redirect', url, filename }
// ──────────────────────────────────────────────────────────────────────────
async function tryViaCoablt(url) {
    const payload = {
        url,
        videoQuality:    '1080',
        audioFormat:     'mp3',
        audioBitrate:    '128',
        filenameStyle:   'basic',
        downloadMode:    'auto',
    };

    for (const instance of COBALT_INSTANCES) {
        try {
            console.log(`[MEDIA] Cobalt → probando ${instance}`);
            const res = await axios.post(`${instance}/`, payload, {
                headers: {
                    'Content-Type':  'application/json',
                    'Accept':        'application/json',
                    // Simular browser exactamente como en el debug que tienes
                    'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0',
                    'Origin':        'https://cobalt.tools',
                    'Referer':       'https://cobalt.tools/',
                },
                timeout: 15000,
            });

            const data = res.data;
            console.log(`[MEDIA] Cobalt ${instance} respondió:`, data?.status);

            // Respuesta directa con URL
            if ((data?.status === 'tunnel' || data?.status === 'redirect') && data?.url) {
                return { downloadUrl: data.url, filename: data.filename || null, instance };
            }

            // Picker (ej: TikTok con múltiples medios) → tomar el primero
            if (data?.status === 'picker' && data?.picker?.length) {
                const first = data.picker[0];
                if (first?.url) {
                    return { downloadUrl: first.url, filename: data.audioFilename || null, instance };
                }
            }

        } catch (err) {
            const status = err?.response?.status;
            const errData = err?.response?.data;
            console.log(`[MEDIA] Cobalt ${instance} falló: ${status || err.message}`, errData?.error?.code || '');
            // Continúa al siguiente
        }
    }
    return null; // Todas fallaron
}

// ──────────────────────────────────────────────────────────────────────────
// MÉTODO 2: yt-dlp
// Fallback robusto; usa cookies para X/Twitter
// ──────────────────────────────────────────────────────────────────────────
async function tryViaYtDlp(url, basePath) {
    const ytDlpBin = await getYtDlpPath();
    if (!ytDlpBin) return { error: 'no_ytdlp' };

    const needsCookies = isTwitterUrl(url);
    if (needsCookies && !fs.existsSync(COOKIES_FILE)) {
        return { error: 'no_cookies' };
    }

    const ytArgs = [
        '--no-playlist',
        '--no-warnings',
        '--max-filesize', `${MAX_FILE_SIZE_MB}m`,
        '-f', 'bestvideo[ext=mp4][filesize<?50M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<?50M]/best[filesize<?50M]/bestaudio/best',
        '--merge-output-format', 'mp4',
        '-o', `${basePath}.%(ext)s`,
        '--no-part',
        '--socket-timeout', '30',
    ];

    if (needsCookies) ytArgs.push('--cookies', COOKIES_FILE);
    ytArgs.push(url);

    console.log(`[MEDIA] yt-dlp → descargando${needsCookies ? ' (con cookies)' : ''}`);

    try {
        await execFileAsync(ytDlpBin, ytArgs, { timeout: 120_000 });
        return { success: true };
    } catch (err) {
        const reason = (err.stderr || err.message || '').toLowerCase();
        return { error: 'ytdlp_failed', reason };
    }
}

// ──────────────────────────────────────────────────────────────────────────
// DESCARGA de URL directa (resultado de cobalt) a disco
// ──────────────────────────────────────────────────────────────────────────
async function downloadUrlToFile(downloadUrl, basePath) {
    const res = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 120_000,
        maxContentLength: MAX_FILE_SIZE_BYTES + 1024 * 1024, // +1MB margen
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    // Detectar extensión por Content-Type o URL
    const contentType = res.headers['content-type'] || '';
    let ext = 'mp4';
    if      (contentType.includes('audio/mpeg'))  ext = 'mp3';
    else if (contentType.includes('audio/mp4'))   ext = 'm4a';
    else if (contentType.includes('audio/ogg'))   ext = 'ogg';
    else if (contentType.includes('video/webm'))  ext = 'webm';
    else if (contentType.includes('video/mp4'))   ext = 'mp4';
    else {
        // Fallback: intentar leer de la URL
        const urlExt = downloadUrl.split('?')[0].split('.').pop().toLowerCase();
        if (MIME_BY_EXT[urlExt]) ext = urlExt;
    }

    const filePath = `${basePath}.${ext}`;

    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        res.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
        res.data.on('error', reject);
    });

    return { filePath, ext };
}

// ──────────────────────────────────────────────────────────────────────────
// COMANDO PRINCIPAL
// ──────────────────────────────────────────────────────────────────────────
module.exports = async (msg) => {
    const id       = Date.now();
    const basePath = path.join(process.cwd(), `media_tmp_${id}`);

    try {
        const args = msg.body.split(' ').slice(1);

        if (!args.length || !args[0]) {
            const errorMsg = await msg.reply(
                '⬇️ *Uso correcto:* !media <url>\n' +
                'Ejemplo: *!media https://x.com/usuario/status/...*\n\n' +
                'Compatible con YouTube, TikTok, Instagram, Twitter/X, Reddit, SoundCloud y más.'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const url = args[0].trim();

        if (!isValidUrl(url)) {
            const errorMsg = await msg.reply('URL inválida. Asegúrate de incluir https://');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        console.log(`[MEDIA] URL recibida: ${url}`);

        let filePath = null;
        let ext      = null;

        // ── INTENTO 1: Cobalt API ──────────────────────────────────────────
        const cobaltResult = await tryViaCoablt(url);

        if (cobaltResult) {
            console.log(`[MEDIA] Cobalt OK (${cobaltResult.instance}) → descargando stream`);
            try {
                const downloaded = await downloadUrlToFile(cobaltResult.downloadUrl, basePath);
                filePath = downloaded.filePath;
                ext      = downloaded.ext;
                console.log(`[MEDIA] Stream descargado: ${filePath}`);
            } catch (streamErr) {
                console.warn('[MEDIA] Cobalt stream falló, usando yt-dlp como fallback:', streamErr.message);
            }
        }

        // ── INTENTO 2: yt-dlp (fallback) ──────────────────────────────────
        if (!filePath) {
            console.log('[MEDIA] Intentando con yt-dlp...');
            const ytResult = await tryViaYtDlp(url, basePath);

            if (ytResult.error === 'no_ytdlp') {
                const errorMsg = await msg.reply(
                    '❌ No se pudo descargar el contenido.\n' +
                    '_yt-dlp no está instalado en el servidor._'
                );
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

            if (ytResult.error === 'no_cookies') {
                const errorMsg = await msg.reply(
                    '❌ Para descargar videos de *X (Twitter)* se necesita el archivo de cookies.\n\n' +
                    'El administrador debe colocar `cookies_twitter.txt` en la carpeta del bot.\n' +
                    'Exporta tus cookies desde x.com con la extensión *"Get cookies.txt LOCALLY"*.'
                );
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

            if (ytResult.error === 'ytdlp_failed') {
                const reason = ytResult.reason || '';
                let friendlyMsg = 'No se pudo descargar el contenido.';
                if (reason.includes('not supported') || reason.includes('no video formats'))
                    friendlyMsg = 'La URL no es compatible o el contenido no está disponible.';
                else if (reason.includes('filesize'))
                    friendlyMsg = `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`;
                else if (reason.includes('private') || reason.includes('login') || reason.includes('unavailable'))
                    friendlyMsg = isTwitterUrl(url)
                        ? 'El video no está disponible. Las cookies pueden haber expirado, vuelve a exportarlas.'
                        : 'El contenido es privado y no se puede descargar.';
                else if (reason.includes('timeout') || reason.includes('network'))
                    friendlyMsg = 'Tiempo de espera agotado. Intenta de nuevo.';

                const errorMsg = await msg.reply(`❌ ${friendlyMsg}`);
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

            // yt-dlp OK → detectar archivo
            const detected = detectFile(basePath);
            if (!detected) {
                const errorMsg = await msg.reply('No se encontró el archivo descargado.');
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

            filePath = detected.filePath;
            ext      = detected.ext;
        }

        // ── Verificar tamaño ──────────────────────────────────────────────
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE_BYTES) {
            const sizeMb = (stats.size / 1024 / 1024).toFixed(1);
            const errorMsg = await msg.reply(
                `❌ El archivo pesa *${sizeMb} MB* y supera el límite de ${MAX_FILE_SIZE_MB} MB de WhatsApp.`
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ── Enviar ────────────────────────────────────────────────────────
        const isAudio = ['mp3', 'm4a', 'ogg', 'opus', 'wav', 'flac'].includes(ext);
        const isVideo = ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext);

        // ── Reconvertir video a h264 si es necesario ──────────────────────
        // WhatsApp Web solo acepta MP4 + libx264. TikTok, X, Instagram
        // suelen entregar h265/hevc/av1, lo que causa el error "t: t".
        // Siempre reconvertimos para garantizar compatibilidad.
        let finalPath = filePath;
        if (isVideo) {
            const convertedPath = filePath.replace(/\.\w+$/, '_h264.mp4');
            console.log(`[MEDIA] Reconvirtiendo a h264...`);
            try {
                await reencodeToH264(filePath, convertedPath);
                finalPath = convertedPath;
                console.log(`[MEDIA] Reconversión OK → ${convertedPath}`);
            } catch (convErr) {
                console.warn('[MEDIA] Reconversión falló, intentando enviar original:', convErr.message);
                finalPath = filePath; // fallback al original
            }
        }

        // Verificar tamaño del archivo final (puede haber cambiado tras reencoding)
        const finalStats = fs.statSync(finalPath);
        if (finalStats.size > MAX_FILE_SIZE_BYTES) {
            const sizeMb = (finalStats.size / 1024 / 1024).toFixed(1);
            const errorMsg = await msg.reply(
                `❌ El archivo pesa *${sizeMb} MB* tras procesar y supera el límite de ${MAX_FILE_SIZE_MB} MB de WhatsApp.`
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // fromFilePath evita pasar el base64 por Puppeteer (sin límite de tamaño)
        const media = MessageMedia.fromFilePath(finalPath);

        console.log(`[MEDIA] Enviando .${isVideo ? 'mp4(h264)' : ext} (${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`);

        return await msg.reply(media, undefined, {
            sendMediaAsDocument: !isAudio && !isVideo,
            caption: '⬇️ Descargado con AkR Bot',
        });

    } catch (error) {
        console.error('[MEDIA] Error general:', error);
        try { await msg.react('❎'); } catch {}
        throw error;

    } finally {
        // 🗑️ Limpiar todos los temporales generados
        try {
            const dir    = path.dirname(basePath);
            const prefix = path.basename(basePath);
            fs.readdirSync(dir)
                .filter(f => f.startsWith(prefix))
                .forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
        } catch {}
    }
};
