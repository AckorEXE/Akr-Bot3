
const { MessageMedia } = require('whatsapp-web.js');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

// ─── Límite de tamaño: 50 MB (WhatsApp limita archivos pesados) ────────────
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── MIME types según extensión ────────────────────────────────────────────
const MIME_BY_EXT = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
};

// ─── Detectar extensión real del archivo descargado ────────────────────────
function detectFile(basePath) {
    const exts = Object.keys(MIME_BY_EXT);
    for (const ext of exts) {
        const candidate = `${basePath}.${ext}`;
        if (fs.existsSync(candidate)) return { filePath: candidate, ext };
    }
    return null;
}

// ─── Obtener MIME del archivo ───────────────────────────────────────────────
function getMime(ext) {
    return MIME_BY_EXT[ext.toLowerCase()] || 'application/octet-stream';
}

// ─── Validar URL básica ────────────────────────────────────────────────────
function isValidUrl(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

// ─── Obtener yt-dlp desde el sistema o ruta relativa ──────────────────────
async function getYtDlpPath() {
    // Primero intenta el sistema
    try {
        await execFileAsync('yt-dlp', ['--version']);
        return 'yt-dlp';
    } catch { }

    // Luego ruta local (por si fue instalado manualmente junto al bot)
    const localPath = path.join(process.cwd(), 'yt-dlp');
    if (fs.existsSync(localPath)) return localPath;

    return null;
}

module.exports = async (msg) => {
    const id = Date.now();
    const basePath = path.join(process.cwd(), `media_tmp_${id}`);
    let downloadedFile = null;

    try {
        const args = msg.body.split(' ').slice(1);

        // ❌ Sin argumentos
        if (!args.length || !args[0]) {
            const errorMsg = await msg.reply(
                '⬇️ *Uso correcto:* !media <url>\n' +
                'Ejemplo: *!media https://www.youtube.com/watch?v=...*\n\n' +
                'Compatible con YouTube, TikTok, Instagram, Twitter/X, Reddit, SoundCloud y más.'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const url = args[0].trim();

        // ❌ URL inválida
        if (!isValidUrl(url)) {
            const errorMsg = await msg.reply('URL inválida. Asegúrate de incluir https://');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ─── Verificar que yt-dlp está disponible ───────────────────────────
        const ytDlpBin = await getYtDlpPath();
        if (!ytDlpBin) {
            const errorMsg = await msg.reply(
                '❌ *yt-dlp* no está instalado en el servidor.\n' +
                'El administrador debe instalarlo con:\n`pip install yt-dlp`'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        console.log(`[MEDIA] Descargando: ${url}`);

        // ─── Descargar con yt-dlp ──────────────────────────────────────────
        // Formato: preferir MP4 ≤ 50MB, si no audio M4A; limitar a 5 min para VPS
        const ytArgs = [
            '--no-playlist',
            '--no-warnings',
            '--max-filesize', `${MAX_FILE_SIZE_MB}m`,
            '-f', 'bestvideo[ext=mp4][filesize<?50M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<?50M]/best[filesize<?50M]/bestaudio/best',
            '--merge-output-format', 'mp4',
            '-o', `${basePath}.%(ext)s`,
            '--no-part',
            '--socket-timeout', '30',
            url
        ];

        try {
            await execFileAsync(ytDlpBin, ytArgs, { timeout: 120_000 });
        } catch (dlErr) {
            console.error('[MEDIA] yt-dlp error:', dlErr.stderr || dlErr.message);

            // Mensaje de error más claro
            const reason = (dlErr.stderr || dlErr.message || '').toLowerCase();
            let friendlyMsg = 'No se pudo descargar el contenido.';

            if (reason.includes('not supported') || reason.includes('no video formats')) {
                friendlyMsg = 'La URL no es compatible o el contenido no está disponible.';
            } else if (reason.includes('filesize')) {
                friendlyMsg = `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB y no puede enviarse por WhatsApp.`;
            } else if (reason.includes('private') || reason.includes('login')) {
                friendlyMsg = 'El contenido es privado y no se puede descargar.';
            } else if (reason.includes('timeout') || reason.includes('network')) {
                friendlyMsg = 'Tiempo de espera agotado. Intenta de nuevo en unos momentos.';
            }

            const errorMsg = await msg.reply(`❌ ${friendlyMsg}`);
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ─── Detectar archivo descargado ────────────────────────────────────
        const detected = detectFile(basePath);
        if (!detected) {
            const errorMsg = await msg.reply('No se encontró el archivo descargado.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        downloadedFile = detected.filePath;
        console.log(`[MEDIA] Archivo detectado: ${downloadedFile}`);

        // ─── Verificar tamaño final ──────────────────────────────────────────
        const stats = fs.statSync(downloadedFile);
        if (stats.size > MAX_FILE_SIZE_BYTES) {
            const sizeMb = (stats.size / 1024 / 1024).toFixed(1);
            const errorMsg = await msg.reply(
                `❌ El archivo pesa *${sizeMb} MB* y supera el límite de ${MAX_FILE_SIZE_MB} MB permitido por WhatsApp.`
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ─── Leer y enviar ───────────────────────────────────────────────────
        const mime = getMime(detected.ext);
        const data = fs.readFileSync(downloadedFile, { encoding: 'base64' });
        const media = new MessageMedia(mime, data);

        console.log(`[MEDIA] Enviando ${detected.ext} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        // ✅ Enviar como documento para máxima compatibilidad y sin compresión
        const sent = await msg.reply(media, undefined, {
            sendMediaAsDocument: detected.ext !== 'mp4' && !detected.ext.startsWith('mp'),
            caption: `⬇️ Descargado con AkR Bot`
        });

        return sent;

    } catch (error) {
        console.error('[MEDIA] Error general:', error);

        try {
            await msg.react('❎');
        } catch { }

        throw error;

    } finally {
        // 🗑️ Limpiar archivo temporal siempre, sin importar el resultado
        if (downloadedFile) {
            try {
                if (fs.existsSync(downloadedFile)) {
                    fs.unlinkSync(downloadedFile);
                    console.log(`[MEDIA] Archivo temporal eliminado: ${downloadedFile}`);
                }
            } catch (cleanErr) {
                console.warn('[MEDIA] No se pudo eliminar temporal:', cleanErr.message);
            }
        }

        // Limpiar cualquier .part o archivo con otro ext que haya quedado
        try {
            const dir = path.dirname(basePath);
            const prefix = path.basename(basePath);
            const leftover = fs.readdirSync(dir).filter(f => f.startsWith(prefix));
            leftover.forEach(f => {
                try { fs.unlinkSync(path.join(dir, f)); } catch { }
            });
        } catch { }
    }
};
