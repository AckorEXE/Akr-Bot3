const { MessageMedia } = require('whatsapp-web.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
ffmpeg.setFfmpegPath(ffmpegPath);

// 📏 Límite REAL de WhatsApp para stickers animados (verificado: 500KB).
// Le damos un pequeño margen de tolerancia hasta 550KB como último recurso.
const TARGET_SIZE = 500 * 1024;
const HARD_CAP = 550 * 1024;

const CROP = "crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2";

// 🔥 Corre ffmpeg y devuelve el resultado como Buffer.
// NOTA: el output SÍ se escribe a disco (a diferencia de un intento anterior
// que lo mandaba por pipe). El contenedor WebP necesita "seek" hacia atrás
// para reescribir su header con el tamaño final una vez termina de codificar
// — eso es imposible en un stream/pipe, y produce archivos corruptos que
// whatsapp-web.js no puede leer ("Reached end while reading chunk header").
function encodeToWebp(inputPath, outputPath, { animated, fps, quality, compressionLevel, duration }) {
    return new Promise((resolve, reject) => {
        const vf = animated
            ? `${CROP},scale=512:512,fps=${fps}`
            : `${CROP},scale=512:512`;

        const command = ffmpeg(inputPath);

        if (animated) {
            command.inputOptions([`-t ${duration}`]);
        }

        const outputOptions = [
            '-vf', vf,
            '-vcodec', 'libwebp',
            '-lossless', '0',
            '-compression_level', String(compressionLevel),
            '-q:v', String(quality),
        ];

        if (animated) {
            outputOptions.push('-loop', '0', '-an', '-vsync', '0');
        }

        command
            .outputOptions(outputOptions)
            .toFormat('webp')
            .save(outputPath)
            .on('end', () => {
                try {
                    const buffer = fs.readFileSync(outputPath);
                    resolve(buffer);
                } catch (err) {
                    reject(err);
                } finally {
                    try { fs.unlinkSync(outputPath); } catch {}
                }
            })
            .on('error', reject);
    });
}

// 🎞️ VIDEO/GIF → WEBP animado.
// Antes: hasta 6 encodes completos (calidad 60→10 de 10 en 10).
// Ahora: hasta 3, empezando en un preset que casi siempre pasa a la primera,
// y con más fps (más fluido) porque acortamos la duración para compensar peso.
async function convertToWebpAnimated(inputPath, id) {
    const attempts = [
        { fps: 15, quality: 45 },
        { fps: 12, quality: 32 },
        { fps: 8,  quality: 20 },
    ];

    let lastBuffer = null;

    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        const outputPath = path.join(__dirname, `output_${id}_${i}.webp`);

        const buffer = await encodeToWebp(inputPath, outputPath, {
            animated: true,
            duration: 4, // antes 5s — más margen de tamaño para subir fps
            fps: attempt.fps,
            quality: attempt.quality,
            compressionLevel: 4, // antes 6 — encode notablemente más rápido
        });

        lastBuffer = buffer;
        if (buffer.length <= TARGET_SIZE) return buffer;
    }

    // Ninguno bajó del target ideal: si el último intento quedó razonablemente
    // cerca (bajo el hard cap), lo mandamos igual en vez de fallar por completo.
    if (lastBuffer && lastBuffer.length <= HARD_CAP) return lastBuffer;

    return null;
}

// 🖼️ IMAGEN → WEBP estático cuadrado (sin cambios de calidad, solo sin disco)
async function convertToWebpStatic(inputPath, id) {
    const outputPath = path.join(__dirname, `output_${id}.webp`);
    return encodeToWebp(inputPath, outputPath, {
        animated: false,
        quality: 80,
        compressionLevel: 4,
    });
}

module.exports = async (msg) => {
    const id = Date.now();
    let inputPath = '';

    try {
        // ⏳ No bloqueamos el flujo esperando la reacción, es "fire and forget"
        msg.react('⏳').catch(() => {});

        let media = null;

        // 📎 Media directa
        if (msg.hasMedia) {
            media = await msg.downloadMedia();
        }

        // 📎 Media citada
        if (!media && msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            if (quoted.hasMedia) {
                media = await quoted.downloadMedia();
            }
        }

        // ❌ Sin media → falla
        if (!media) {
            const errorMsg = await msg.reply('Envía o responde a una imagen, video o GIF.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // La entrada SÍ se escribe a disco: ffmpeg necesita poder "buscar"
        // (seek) dentro de algunos contenedores de video, algo que no es
        // seguro garantizar leyendo directo desde un stream/pipe.
        const ext = media.mimetype.split('/')[1];
        inputPath = path.join(__dirname, `input_${id}.${ext}`);
        const buffer = Buffer.from(media.data, 'base64');
        fs.writeFileSync(inputPath, buffer);

        const isVideo = media.mimetype.includes('video');
        const isGif = media.mimetype.includes('gif');

        let webpBuffer = null;

        if (isVideo || isGif) {
            webpBuffer = await convertToWebpAnimated(inputPath, id);
        } else {
            webpBuffer = await convertToWebpStatic(inputPath, id);
        }

        // ❌ No se pudo comprimir dentro del límite → falla
        if (!webpBuffer) {
            const errorMsg = await msg.reply('No se pudo procesar el sticker, el archivo es demasiado pesado.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const sticker = new MessageMedia('image/webp', webpBuffer.toString('base64'));

        // ✅ ÉXITO → devolver para que index.js ponga su reacción
        return await msg.reply(sticker, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

    } catch (error) {
        console.error('Error sticker ULTRA:', error);
        try {
            await msg.react('❎');
        } catch {}
        throw error;
    } finally {
        try { if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}
    }
};
