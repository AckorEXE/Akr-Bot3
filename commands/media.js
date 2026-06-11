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
        return null;
    } catch { return null; }
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

// Busca cualquier archivo generado con el prefijo del basePath
function findDownloadedFiles(basePath) {
    const dir    = path.dirname(basePath);
    const prefix = path.basename(basePath);
    const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi'];
    const audioExts = ['mp3', 'm4a', 'ogg', 'opus', 'wav', 'flac'];
    const imageExts = ['jpg', 'jpeg', 'png', 'webp'];

    try {
        const files = fs.readdirSync(dir)
            .filter(f => f.startsWith(prefix))
            .map(f => path.join(dir, f));

        const videos = files.filter(f => videoExts.some(e => f.endsWith(`.${e}`)));
        const audios = files.filter(f => audioExts.some(e => f.endsWith(`.${e}`)));
        const images = files.filter(f => imageExts.some(e => f.endsWith(`.${e}`)));

        return { videos, audios, images, all: files };
    } catch { return { videos: [], audios: [], images: [], all: [] }; }
}

// ─── Detección de codec ────────────────────────────────────────────────────
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
async function ensureH264(filePath, basePath) {
    const codec  = await detectVideoCodec(filePath);
    const isMp4  = filePath.endsWith('.mp4');
    const isH264 = codec === 'h264' || codec === 'avc';
    console.log(`[MEDIA] Codec: ${codec} | mp4: ${isMp4}`);

    if (isH264 && isMp4) return filePath; // perfecto, sin tocar

    if (isH264 && !isMp4) {
        // Solo remux, sin re-encodear
        const outPath = `${basePath}_remux.mp4`;
        console.log('[MEDIA] Remuxing a mp4...');
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
                .toFormat('mp4').save(outPath)
                .on('end', resolve).on('error', reject);
        });
        return outPath;
    }

    // Re-encodear (hevc, av1, vp9, etc.)
    const outPath = `${basePath}_h264.mp4`;
    console.log(`[MEDIA] Re-encodando ${codec} → h264...`);
    await new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .outputOptions([
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
                '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
            ])
            .toFormat('mp4').save(outPath)
            .on('end', resolve).on('error', reject);
    });
    return outPath;
}

// ─── Compilar slideshow (imágenes + audio) en video mp4 ───────────────────
// TikTok slideshows descargan como fotos separadas + mp3.
// Los combinamos en un video donde cada imagen se muestra ~3s con la música.
async function buildSlideshowVideo(images, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        // Crear lista de imágenes para ffmpeg concat
        const listPath = `${outputPath}_imglist.txt`;
        const duration = 3; // segundos por imagen
        const lines = images.map(img => `file '${img}'\nduration ${duration}`).join('\n');
        // Agregar última imagen sin duración (requerido por concat demuxer)
        const content = lines + `\nfile '${images[images.length - 1]}'`;
        fs.writeFileSync(listPath, content);

        const cmd = ffmpeg();

        if (audioPath) {
            cmd.input(listPath).inputOptions(['-f', 'concat', '-safe', '0'])
               .input(audioPath)
               .outputOptions([
                   '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
                   '-pix_fmt', 'yuv420p',
                   '-c:a', 'aac', '-b:a', '128k',
                   '-movflags', '+faststart',
                   '-shortest',
                   '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black',
               ]);
        } else {
            cmd.input(listPath).inputOptions(['-f', 'concat', '-safe', '0'])
               .outputOptions([
                   '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
                   '-pix_fmt', 'yuv420p',
                   '-movflags', '+faststart',
                   '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black',
               ]);
        }

        cmd.toFormat('mp4').save(outputPath)
           .on('end', () => { try { fs.unlinkSync(listPath); } catch {} resolve(); })
           .on('error', (err) => { try { fs.unlinkSync(listPath); } catch {} reject(err); });
    });
}

// ─── yt-dlp: descarga normal (video) ──────────────────────────────────────
async function downloadVideo(ytDlpBin, url, basePath, platform) {
    const args = [
        '--no-playlist', '--no-warnings',
        '--no-check-certificates',
        '--max-filesize', `${MAX_FILE_SIZE_MB}m`,
        '-o', `${basePath}.%(ext)s`,
        '--no-part',
        '--socket-timeout', '30',
        '--retries', '3',
        '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
    ];

    if (platform === 'tiktok') {
        args.push('-f', 'mp4/best[ext=mp4]/best', '--merge-output-format', 'mp4');
    } else if (platform === 'instagram') {
        args.push('-f', 'best[ext=mp4][vcodec^=avc]/best[ext=mp4]/best', '--merge-output-format', 'mp4');
    } else if (platform === 'facebook') {
        args.push('-f', 'best[ext=mp4][vcodec^=avc]/sd/best[ext=mp4]/best', '--merge-output-format', 'mp4');
    }

    args.push(url);
    console.log(`[MEDIA] yt-dlp video [${platform}]`);

    try {
        const r = await execFileAsync(ytDlpBin, args, { timeout: 120_000 });
        console.log(`[MEDIA] yt-dlp OK: ${r.stdout?.slice(0, 150)}`);
        return { success: true };
    } catch (err) {
        const reason = (err.stderr || err.stdout || err.message || '').toLowerCase();
        console.log(`[MEDIA] yt-dlp error: ${reason.slice(0, 300)}`);
        return { error: 'failed', reason };
    }
}

// ─── yt-dlp: descarga slideshow TikTok (imágenes + audio por separado) ───
async function downloadSlideshow(ytDlpBin, url, basePath) {
    // Descargar imágenes
    const imgArgs = [
        '--no-warnings', '--no-check-certificates',
        '--no-part', '--socket-timeout', '30', '--retries', '3',
        '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
        '-o', `${basePath}_slide_%(autonumber)s.%(ext)s`,
        '--skip-download',          // no descarga video
        '--write-thumbnail',        // descarga thumbnails/imágenes
        url,
    ];

    // También descargar solo el audio
    const audioArgs = [
        '--no-warnings', '--no-check-certificates',
        '--no-part', '--socket-timeout', '30', '--retries', '3',
        '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
        '-o', `${basePath}_audio.%(ext)s`,
        '-f', 'bestaudio/best',
        '--extract-audio', '--audio-format', 'mp3',
        url,
    ];

    console.log('[MEDIA] Descargando slideshow TikTok (imágenes + audio)...');

    try {
        await Promise.all([
            execFileAsync(ytDlpBin, imgArgs, { timeout: 60_000 }).catch(() => {}),
            execFileAsync(ytDlpBin, audioArgs, { timeout: 60_000 }).catch(() => {}),
        ]);
        return { success: true };
    } catch (err) {
        return { error: 'failed', reason: err.message };
    }
}

// ─── Obtener info del contenido ────────────────────────────────────────────
async function getContentInfo(ytDlpBin, url) {
    try {
        const r = await execFileAsync(ytDlpBin, [
            '--no-warnings', '--no-check-certificates',
            '--skip-download', '--print', '%(ext)s|%(_type)s|%(playlist_count)s',
            '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
            url,
        ], { timeout: 30_000 });

        const [ext, type, count] = (r.stdout || '').trim().split('|');
        return { ext: ext?.trim(), type: type?.trim(), count: parseInt(count) || 0 };
    } catch {
        return null;
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
                'Compatible con:\n• TikTok (videos y fotos)\n• Facebook\n• Instagram'
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
        if (!platform) {
            const errorMsg = await msg.reply(
                'Plataforma no soportada.\n\nSolo se puede descargar de:\n• TikTok\n• Facebook\n• Instagram'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const ytDlpBin = await getYtDlpPath();
        if (!ytDlpBin) {
            const errorMsg = await msg.reply('No se pudo descargar. yt-dlp no está instalado en el servidor.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        console.log(`[MEDIA] URL: ${url} | Plataforma: ${platform}`);

        // ── Para TikTok: detectar si es slideshow o video ─────────────────
        let isSlideshow = false;
        if (platform === 'tiktok') {
            const info = await getContentInfo(ytDlpBin, url);
            console.log(`[MEDIA] TikTok info:`, info);
            // Si ext es jpg/png/webp o type es playlist, es slideshow
            if (info && (
                ['jpg', 'jpeg', 'png', 'webp'].includes(info.ext) ||
                info.type === 'playlist' ||
                info.count > 1
            )) {
                isSlideshow = true;
                console.log('[MEDIA] Detectado como SLIDESHOW');
            }
        }

        let finalPath = null;

        // ── Caso 1: Slideshow TikTok ───────────────────────────────────────
        if (isSlideshow) {
            await downloadSlideshow(ytDlpBin, url, basePath);

            const found = findDownloadedFiles(basePath);
            console.log(`[MEDIA] Archivos encontrados - imgs: ${found.images.length}, audio: ${found.audios.length}`);

            if (found.images.length > 0) {
                // Compilar imágenes + audio en video
                const audioPath = found.audios[0] || null;
                const slideshowOutput = `${basePath}_slideshow.mp4`;
                console.log('[MEDIA] Compilando slideshow en video...');
                await buildSlideshowVideo(found.images.sort(), audioPath, slideshowOutput);
                finalPath = slideshowOutput;
            } else {
                // Fallback: intentar descargar como video normal de todas formas
                console.log('[MEDIA] Sin imágenes de slideshow, intentando descarga normal...');
                await downloadVideo(ytDlpBin, url, basePath, platform);
                const found2 = findDownloadedFiles(basePath);
                if (found2.videos.length > 0) {
                    finalPath = await ensureH264(found2.videos[0], basePath).catch(() => found2.videos[0]);
                }
            }
        }

        // ── Caso 2: Video normal ───────────────────────────────────────────
        if (!finalPath) {
            const result = await downloadVideo(ytDlpBin, url, basePath, platform);

            if (result.error) {
                const reason = result.reason || '';
                let msg2 = 'No se pudo descargar el contenido.';
                if (reason.includes('not supported') || reason.includes('unsupported url'))
                    msg2 = 'URL no compatible o contenido no disponible. Verifica que sea público.';
                else if (reason.includes('filesize'))
                    msg2 = `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`;
                else if (reason.includes('private') || reason.includes('login') || reason.includes('unavailable'))
                    msg2 = 'El contenido es privado o requiere iniciar sesión.';
                else if (reason.includes('timeout') || reason.includes('network') || reason.includes('connection'))
                    msg2 = 'Error de conexión. Intenta de nuevo.';
                else if (reason.includes('copyright') || reason.includes('blocked'))
                    msg2 = 'El contenido no está disponible o fue bloqueado.';

                const errorMsg = await msg.reply(msg2);
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

            const found = findDownloadedFiles(basePath);
            console.log(`[MEDIA] Archivos: videos=${found.videos.length} audios=${found.audios.length}`);

            if (found.videos.length === 0) {
                console.log(`[MEDIA] Dir listing: ${found.all.map(f => path.basename(f)).join(', ')}`);
                const errorMsg = await msg.reply('No se encontró el archivo descargado.');
                await errorMsg.react('❎');
                await msg.react('❎');
                return null;
            }

            finalPath = await ensureH264(found.videos[0], basePath).catch(() => found.videos[0]);
        }

        if (!finalPath || !fs.existsSync(finalPath)) {
            const errorMsg = await msg.reply('No se pudo procesar el archivo.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ── Verificar tamaño final ─────────────────────────────────────────
        const finalStats = fs.statSync(finalPath);
        if (finalStats.size > MAX_FILE_SIZE_BYTES) {
            const sizeMb = (finalStats.size / 1024 / 1024).toFixed(1);
            const errorMsg = await msg.reply(`El archivo pesa *${sizeMb} MB* y supera el límite de ${MAX_FILE_SIZE_MB} MB de WhatsApp.`);
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const media = MessageMedia.fromFilePath(finalPath);
        console.log(`[MEDIA] Enviando [${platform}${isSlideshow ? '/slideshow' : ''}] ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);

        return await msg.reply(media, undefined, {
            caption: '⬇️ Descargado con AkR Bot',
        });

    } catch (error) {
        console.error('[MEDIA] Error general:', error);
        try { await msg.react('❎'); } catch {}
        throw error;

    } finally {
        try {
            const dir    = path.dirname(basePath);
            const prefix = path.basename(basePath);
            fs.readdirSync(dir)
                .filter(f => f.startsWith(prefix))
                .forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
        } catch {}
    }
};
