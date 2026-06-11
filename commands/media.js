const { MessageMedia } = require('whatsapp-web.js');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const execFileAsync = promisify(execFile);

// ─── Config ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB    = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── Plataformas soportadas ────────────────────────────────────────────────
function detectPlatform(url) {
    try {
        const h = new URL(url).hostname.replace('www.', '');
        if (['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(h))         return 'tiktok';
        if (['instagram.com', 'instagr.am'].includes(h))                           return 'instagram';
        if (['facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com'].includes(h)) return 'facebook';
        return null; // plataforma no soportada
    } catch {
        return null;
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
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

// Busca cualquier archivo que empiece con el basePath (yt-dlp puede generar
// nombres con título, ID, etc. dependiendo del template usado)
function findDownloadedFile(basePath) {
    const dir    = path.dirname(basePath);
    const prefix = path.basename(basePath);
    const videoExts  = ['mp4', 'webm', 'mkv', 'mov', 'avi'];
    const audioExts  = ['mp3', 'm4a', 'ogg', 'opus', 'wav', 'flac'];
    const allExts    = [...videoExts, ...audioExts];

    try {
        const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix));

        // Priorizar mp4
        for (const ext of allExts) {
            const found = files.find(f => f.endsWith(`.${ext}`));
            if (found) {
                return {
                    filePath: path.join(dir, found),
                    ext,
                    isVideo: videoExts.includes(ext),
                    isAudio: audioExts.includes(ext),
                };
            }
        }
    } catch {}
    return null;
}

// ─── Detección de codec con ffprobe ───────────────────────────────────────
async function detectVideoCodec(filePath) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) { resolve(null); return; }
            const stream = metadata?.streams?.find(s => s.codec_type === 'video');
            resolve(stream?.codec_name || null);
        });
    });
}

// ─── Procesamiento de video ────────────────────────────────────────────────
// - Si ya es h264 en mp4 → enviar directo (TikTok y Facebook casi siempre lo son)
// - Si es h264 en otro container → remux rápido a mp4 (sin re-encodear)
// - Si es otro codec (hevc, av1, vp9) → re-encodear a h264
async function ensureH264(filePath, basePath) {
    const codec = await detectVideoCodec(filePath);
    console.log(`[MEDIA] Codec detectado: ${codec}`);

    const isH264 = codec === 'h264' || codec === 'avc';
    const isMp4  = filePath.endsWith('.mp4');

    if (isH264 && isMp4) {
        console.log('[MEDIA] Ya es h264/mp4, no se necesita procesamiento');
        return filePath;
    }

    if (isH264 && !isMp4) {
        // Solo cambiar container, sin re-encodear (muy rápido)
        const outPath = `${basePath}_remux.mp4`;
        console.log('[MEDIA] Remuxing a mp4 (sin re-encode)...');
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
                .toFormat('mp4')
                .save(outPath)
                .on('end', resolve)
                .on('error', reject);
        });
        return outPath;
    }

    // Codec incompatible → re-encodear
    const outPath = `${basePath}_h264.mp4`;
    console.log(`[MEDIA] Re-encodando ${codec || 'desconocido'} → h264...`);
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

// ─── Argumentos yt-dlp por plataforma ─────────────────────────────────────
function buildYtDlpArgs(basePath, platform) {
    const base = [
        '--no-playlist',
        '--no-warnings',
        '--max-filesize', `${MAX_FILE_SIZE_MB}m`,
        '-o', `${basePath}.%(ext)s`,
        '--no-part',
        '--socket-timeout', '30',
        '--retries', '3',
    ];

    if (platform === 'tiktok') {
        // TikTok: pedir mp4 h264 directamente. También intentar sin marca de agua.
        return [
            ...base,
            '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
            '-f', 'mp4/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
        ];
    }

    if (platform === 'instagram') {
        // Instagram: preferir h264 mp4, evitar dash con hevc
        return [
            ...base,
            '-f', 'best[ext=mp4][vcodec^=avc]/best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best',
            '--merge-output-format', 'mp4',
        ];
    }

    if (platform === 'facebook') {
        // Facebook: h264 mp4 explícito, calidad SD primero (más estable)
        return [
            ...base,
            '-f', 'best[ext=mp4][vcodec^=avc]/sd/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
        ];
    }

    return base;
}

async function tryViaYtDlp(url, basePath, platform) {
    const ytDlpBin = await getYtDlpPath();
    if (!ytDlpBin) return { error: 'no_ytdlp' };

    const ytArgs = buildYtDlpArgs(basePath, platform);
    ytArgs.push(url);

    console.log(`[MEDIA] yt-dlp [${platform}] iniciando...`);

    try {
        const result = await execFileAsync(ytDlpBin, ytArgs, { timeout: 120_000 });
        console.log(`[MEDIA] yt-dlp stdout: ${result.stdout?.slice(0, 200)}`);
        return { success: true };
    } catch (err) {
        const reason = (err.stderr || err.stdout || err.message || '').toLowerCase();
        console.log(`[MEDIA] yt-dlp falló: ${reason.slice(0, 300)}`);
        return { error: 'ytdlp_failed', reason };
    }
}

// ─── Comando principal ─────────────────────────────────────────────────────
module.exports = async (msg) => {
    const id       = Date.now();
    const basePath = path.join(process.cwd(), `media_tmp_${id}`);

    try {
        const args = msg.body.split(' ').slice(1);

        if (!args.length || !args[0]) {
            const errorMsg = await msg.reply(
                '⬇️ *Uso correcto:* !media <url>\n\n' +
                'Compatible con:\n' +
                '• TikTok\n' +
                '• Facebook\n' +
                '• Instagram'
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

        if (!platform) {
            const errorMsg = await msg.reply(
                'Plataforma no soportada.\n\n' +
                'Solo se puede descargar de:\n' +
                '• TikTok\n' +
                '• Facebook\n' +
                '• Instagram'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ── Descargar con yt-dlp ───────────────────────────────────────────
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

        if (ytResult.error === 'ytdlp_failed') {
            const reason = ytResult.reason || '';
            let friendlyMsg = 'No se pudo descargar el contenido.';

            if (reason.includes('not supported') || reason.includes('no video formats') || reason.includes('unsupported url'))
                friendlyMsg = 'No se pudo acceder al contenido. Verifica que la URL sea correcta y el contenido sea público.';
            else if (reason.includes('filesize'))
                friendlyMsg = `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`;
            else if (reason.includes('private') || reason.includes('login') || reason.includes('unavailable') || reason.includes('restricted'))
                friendlyMsg = 'El contenido es privado o requiere iniciar sesión.';
            else if (reason.includes('timeout') || reason.includes('network') || reason.includes('connection'))
                friendlyMsg = 'Error de conexión. Intenta de nuevo.';
            else if (reason.includes('copyright') || reason.includes('blocked'))
                friendlyMsg = 'El contenido no está disponible en esta región o fue bloqueado.';

            const errorMsg = await msg.reply(friendlyMsg);
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ── Buscar archivo descargado ──────────────────────────────────────
        const detected = findDownloadedFile(basePath);

        if (!detected) {
            console.log(`[MEDIA] No se encontró archivo con prefijo: ${path.basename(basePath)}`);
            console.log(`[MEDIA] Archivos en dir: ${fs.readdirSync(path.dirname(basePath)).filter(f => f.includes('media_tmp')).join(', ')}`);
            const errorMsg = await msg.reply('No se encontró el archivo descargado.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const { filePath, ext, isVideo, isAudio } = detected;
        console.log(`[MEDIA] Archivo encontrado: ${filePath}`);

        // ── Verificar tamaño ──────────────────────────────────────────────
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE_BYTES) {
            const sizeMb = (stats.size / 1024 / 1024).toFixed(1);
            const errorMsg = await msg.reply(`El archivo pesa *${sizeMb} MB* y supera el límite de ${MAX_FILE_SIZE_MB} MB de WhatsApp.`);
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ── Procesar video (solo si hace falta) ───────────────────────────
        let finalPath = filePath;
        if (isVideo) {
            try {
                finalPath = await ensureH264(filePath, basePath);
            } catch (convErr) {
                console.warn('[MEDIA] Procesamiento de video falló, enviando original:', convErr.message);
                finalPath = filePath;
            }
        }

        // Verificar tamaño final
        const finalStats = fs.statSync(finalPath);
        if (finalStats.size > MAX_FILE_SIZE_BYTES) {
            const sizeMb = (finalStats.size / 1024 / 1024).toFixed(1);
            const errorMsg = await msg.reply(`El archivo pesa *${sizeMb} MB* tras procesar y supera el límite de ${MAX_FILE_SIZE_MB} MB.`);
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const media = MessageMedia.fromFilePath(finalPath);
        console.log(`[MEDIA] Enviando [${platform}] .${isVideo ? 'mp4' : ext} ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);

        return await msg.reply(media, undefined, {
            sendMediaAsDocument: !isAudio && !isVideo,
            caption: '⬇️ Descargado con AkR Bot',
        });

    } catch (error) {
        console.error('[MEDIA] Error general:', error);
        try { await msg.react('❎'); } catch {}
        throw error;

    } finally {
        // Limpiar todos los temporales
        try {
            const dir    = path.dirname(basePath);
            const prefix = path.basename(basePath);
            fs.readdirSync(dir)
                .filter(f => f.startsWith(prefix))
                .forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
        } catch {}
    }
};
