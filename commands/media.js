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
const MAX_FILE_SIZE_MB    = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const COOKIES_FILE        = path.join(process.cwd(), 'cookies_twitter.txt');

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

// ─── Plataformas ───────────────────────────────────────────────────────────
function detectPlatform(url) {
    try {
        const h = new URL(url).hostname.replace('www.', '');
        if (['x.com', 'twitter.com', 't.co'].includes(h))                    return 'twitter';
        if (['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(h))    return 'tiktok';
        if (['instagram.com', 'instagr.am'].includes(h))                      return 'instagram';
        if (['facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com'].includes(h)) return 'facebook';
        if (['youtube.com', 'youtu.be', 'm.youtube.com'].includes(h))         return 'youtube';
        if (['reddit.com', 'redd.it', 'v.redd.it'].includes(h))               return 'reddit';
        return 'generic';
    } catch {
        return 'generic';
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function detectFile(basePath) {
    for (const ext of Object.keys(MIME_BY_EXT)) {
        const candidate = `${basePath}.${ext}`;
        if (fs.existsSync(candidate)) return { filePath: candidate, ext };
    }
    return null;
}

function isValidUrl(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
}

async function getYtDlpPath() {
    try { await execFileAsync('yt-dlp', ['--version']); return 'yt-dlp'; } catch {}
    const local = path.join(process.cwd(), 'yt-dlp');
    if (fs.existsSync(local)) return local;
    return null;
}

// ─── Detección de codec ────────────────────────────────────────────────────
// Revisa si el video ya está en h264. Si sí, no re-encodea (evita degradar
// TikToks que vienen en h264 nativo y eran los que "fallaban" por convertirse
// innecesariamente).
async function detectVideoCodec(filePath) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) { resolve(null); return; }
            const stream = metadata?.streams?.find(s => s.codec_type === 'video');
            resolve(stream?.codec_name || null);
        });
    });
}

// ─── Re-encode solo si es necesario ───────────────────────────────────────
// WhatsApp Web requiere h264 + aac en mp4. Pero muchos TikToks y Facebook
// ya vienen en h264 → re-encodear era lo que los rompía. Solo convertimos
// si el codec no es h264/avc.
async function ensureH264(filePath, basePath) {
    const codec = await detectVideoCodec(filePath);
    console.log(`[MEDIA] Codec detectado: ${codec}`);

    // Ya es h264 → usar directo, sin re-encodear
    if (codec && (codec === 'h264' || codec === 'avc')) {
        // Si no es mp4 en extension, renombrar/copiar container
        if (!filePath.endsWith('.mp4')) {
            const outPath = `${basePath}_final.mp4`;
            await remuxToMp4(filePath, outPath);
            return outPath;
        }
        return filePath;
    }

    // Codec incompatible (hevc, av1, vp9, etc.) → re-encodear
    const outPath = `${basePath}_h264.mp4`;
    console.log(`[MEDIA] Re-encodando ${codec} → h264...`);
    await new Promise((resolve, reject) => {
        ffmpeg(filePath)
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
            .save(outPath)
            .on('end', resolve)
            .on('error', reject);
    });
    return outPath;
}

// Remux: solo cambia el container a mp4 sin re-encodear (muy rápido)
async function remuxToMp4(filePath, outPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
            .toFormat('mp4')
            .save(outPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

// ─── Cobalt API ────────────────────────────────────────────────────────────
const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt.api.royalehosting.net',
    'https://co.wuk.sh',
];

async function tryViaCobalt(url) {
    const payload = {
        url,
        videoQuality:  '1080',
        audioFormat:   'mp3',
        audioBitrate:  '128',
        filenameStyle: 'basic',
        downloadMode:  'auto',
    };

    for (const instance of COBALT_INSTANCES) {
        try {
            console.log(`[MEDIA] Cobalt → ${instance}`);
            const res = await axios.post(`${instance}/`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept':       'application/json',
                    'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                    'Origin':       'https://cobalt.tools',
                    'Referer':      'https://cobalt.tools/',
                },
                timeout: 15000,
            });

            const data = res.data;
            console.log(`[MEDIA] Cobalt ${instance} status: ${data?.status}`);

            if ((data?.status === 'tunnel' || data?.status === 'redirect') && data?.url) {
                return { downloadUrl: data.url, filename: data.filename || null };
            }

            if (data?.status === 'picker' && data?.picker?.length) {
                const first = data.picker[0];
                if (first?.url) return { downloadUrl: first.url, filename: data.audioFilename || null };
            }
        } catch (err) {
            console.log(`[MEDIA] Cobalt ${instance} falló: ${err?.response?.status || err.message}`);
        }
    }
    return null;
}

// ─── yt-dlp ────────────────────────────────────────────────────────────────
// Formatos optimizados por plataforma para evitar codecs incompatibles
// y reducir tamaño de descarga.
function buildYtDlpArgs(url, basePath, platform) {
    const base = [
        '--no-playlist',
        '--no-warnings',
        '--max-filesize', `${MAX_FILE_SIZE_MB}m`,
        '-o', `${basePath}.%(ext)s`,
        '--no-part',
        '--socket-timeout', '30',
    ];

    // TikTok: pedir mp4 directamente en h264 (casi siempre disponible)
    if (platform === 'tiktok') {
        return [
            ...base,
            '-f', 'mp4/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
        ];
    }

    // Instagram: videos en mp4, evitar formatos dash que traen hevc
    if (platform === 'instagram') {
        return [
            ...base,
            '-f', 'best[ext=mp4][vcodec^=avc]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
        ];
    }

    // Facebook: preferir h264 mp4 explícitamente
    if (platform === 'facebook') {
        return [
            ...base,
            '-f', 'best[ext=mp4][vcodec^=avc]/best[ext=mp4]/best[filesize<?50M]',
            '--merge-output-format', 'mp4',
        ];
    }

    // Twitter/X: necesita cookies, formato genérico bueno
    if (platform === 'twitter') {
        return [
            ...base,
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
        ];
    }

    // Genérico / YouTube / Reddit
    return [
        ...base,
        '-f', 'bestvideo[ext=mp4][filesize<?50M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<?50M]/best[filesize<?50M]/bestaudio/best',
        '--merge-output-format', 'mp4',
    ];
}

async function tryViaYtDlp(url, basePath, platform) {
    const ytDlpBin = await getYtDlpPath();
    if (!ytDlpBin) return { error: 'no_ytdlp' };

    if (platform === 'twitter' && !fs.existsSync(COOKIES_FILE)) {
        return { error: 'no_cookies' };
    }

    const ytArgs = buildYtDlpArgs(url, basePath, platform);
    if (platform === 'twitter') ytArgs.push('--cookies', COOKIES_FILE);

    // Instagram y Facebook también pueden necesitar cookies si el contenido es privado
    // pero para contenido público no hacen falta
    ytArgs.push(url);

    console.log(`[MEDIA] yt-dlp [${platform}] → descargando`);

    try {
        await execFileAsync(ytDlpBin, ytArgs, { timeout: 120_000 });
        return { success: true };
    } catch (err) {
        const reason = (err.stderr || err.message || '').toLowerCase();
        return { error: 'ytdlp_failed', reason };
    }
}

// ─── Descarga de URL directa (resultado de Cobalt) ────────────────────────
async function downloadUrlToFile(downloadUrl, basePath) {
    const res = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 120_000,
        maxContentLength: MAX_FILE_SIZE_BYTES + 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    const contentType = res.headers['content-type'] || '';
    let ext = 'mp4';
    if      (contentType.includes('audio/mpeg'))  ext = 'mp3';
    else if (contentType.includes('audio/mp4'))   ext = 'm4a';
    else if (contentType.includes('audio/ogg'))   ext = 'ogg';
    else if (contentType.includes('video/webm'))  ext = 'webm';
    else if (contentType.includes('video/mp4'))   ext = 'mp4';
    else {
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

// ─── Comando principal ─────────────────────────────────────────────────────
module.exports = async (msg) => {
    const id       = Date.now();
    const basePath = path.join(process.cwd(), `media_tmp_${id}`);

    try {
        const args = msg.body.split(' ').slice(1);

        if (!args.length || !args[0]) {
            const errorMsg = await msg.reply(
                '⬇️ *Uso correcto:* !media <url>\n' +
                'Ejemplo: *!media https://www.tiktok.com/@user/video/...*\n\n' +
                'Compatible con TikTok, Facebook, Instagram.'
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

        const platform = detectPlatform(url);
        console.log(`[MEDIA] URL: ${url} | Plataforma: ${platform}`);

        let filePath = null;
        let ext      = null;

        // ── INTENTO 1: Cobalt (rápido, sin yt-dlp) ────────────────────────
        // Cobalt es ideal para TikTok, Instagram y Twitter sin necesitar binario externo.
        // Para Facebook es menos confiable, se prefiere yt-dlp directamente.
        if (platform !== 'facebook') {
            const cobaltResult = await tryViaCobalt(url);
            if (cobaltResult) {
                console.log(`[MEDIA] Cobalt OK → descargando stream`);
                try {
                    const downloaded = await downloadUrlToFile(cobaltResult.downloadUrl, basePath);
                    filePath = downloaded.filePath;
                    ext      = downloaded.ext;
                    console.log(`[MEDIA] Stream descargado: ${filePath}`);
                } catch (streamErr) {
                    console.warn('[MEDIA] Cobalt stream falló:', streamErr.message);
                    filePath = null;
                }
            }
        }

        // ── INTENTO 2: yt-dlp (fallback robusto) ──────────────────────────
        if (!filePath) {
            console.log(`[MEDIA] Usando yt-dlp [${platform}]...`);
            const ytResult = await tryViaYtDlp(url, basePath, platform);

            if (ytResult.error === 'no_ytdlp') {
                const errorMsg = await msg.reply(
                    'No se pudo descargar el contenido.\n' +
                    '_yt-dlp no está instalado en el servidor._'
                );
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

            if (ytResult.error === 'no_cookies') {
                const errorMsg = await msg.reply(
                    'Para descargar videos de *X (Twitter)* se necesita el archivo de cookies.\n\n' +
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
                else if (reason.includes('private') || reason.includes('login') || reason.includes('unavailable')) {
                    if (platform === 'twitter')
                        friendlyMsg = 'El video no está disponible. Las cookies pueden haber expirado, vuelve a exportarlas.';
                    else if (platform === 'instagram' || platform === 'facebook')
                        friendlyMsg = 'El contenido es privado o requiere iniciar sesión para descargarse.';
                    else
                        friendlyMsg = 'El contenido es privado y no se puede descargar.';
                }
                else if (reason.includes('timeout') || reason.includes('network'))
                    friendlyMsg = 'Tiempo de espera agotado. Intenta de nuevo.';

                const errorMsg = await msg.reply(friendlyMsg);
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

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
                `El archivo pesa *${sizeMb} MB* y supera el límite de ${MAX_FILE_SIZE_MB} MB de WhatsApp.`
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const isAudio = ['mp3', 'm4a', 'ogg', 'opus', 'wav', 'flac'].includes(ext);
        const isVideo = ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext);

        // ── Procesamiento de video: solo si es necesario ──────────────────
        // Se detecta el codec real. Si ya es h264, se envía directo o se
        // hace un remux ligero al container mp4. Solo se re-encodea si el
        // codec es incompatible (hevc, av1, vp9...).
        let finalPath = filePath;
        if (isVideo) {
            try {
                finalPath = await ensureH264(filePath, basePath);
                console.log(`[MEDIA] Video listo: ${finalPath}`);
            } catch (convErr) {
                console.warn('[MEDIA] Procesamiento de video falló, enviando original:', convErr.message);
                finalPath = filePath;
            }
        }

        // Verificar tamaño del archivo final
        const finalStats = fs.statSync(finalPath);
        if (finalStats.size > MAX_FILE_SIZE_BYTES) {
            const sizeMb = (finalStats.size / 1024 / 1024).toFixed(1);
            const errorMsg = await msg.reply(
                `El archivo pesa *${sizeMb} MB* tras procesar y supera el límite de ${MAX_FILE_SIZE_MB} MB de WhatsApp.`
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const media = MessageMedia.fromFilePath(finalPath);

        console.log(`[MEDIA] Enviando (${platform}) .${isVideo ? 'mp4' : ext} ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);

        return await msg.reply(media, undefined, {
            sendMediaAsDocument: !isAudio && !isVideo,
            caption: '⬇️ Descargado con AkR Bot',
        });

    } catch (error) {
        console.error('[MEDIA] Error general:', error);
        try { await msg.react('❎'); } catch {}
        throw error;

    } finally {
        // Limpiar todos los archivos temporales
        try {
            const dir    = path.dirname(basePath);
            const prefix = path.basename(basePath);
            fs.readdirSync(dir)
                .filter(f => f.startsWith(prefix))
                .forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
        } catch {}
    }
};
