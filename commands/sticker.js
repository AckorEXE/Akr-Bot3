const { MessageMedia } = require('whatsapp-web.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

// 🔥 FUNCIÓN PRO: compresión automática + recorte cuadrado
async function convertToWebp(inputPath, outputPath) {
    let quality = 60;

    while (quality >= 10) {
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .inputOptions(['-t 5'])
                .outputOptions([
                    '-vf',
                    // 🔥 RECORTE AUTOMÁTICO 1:1 (CENTRO)
                    "crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2,scale=512:512,fps=10",

                    '-vcodec', 'libwebp',
                    '-lossless', '0',
                    '-compression_level', '6',
                    `-q:v ${quality}`,

                    '-loop', '0',
                    '-an',
                    '-vsync', '0'
                ])
                .toFormat('webp')
                .save(outputPath)
                .on('end', resolve)
                .on('error', (err) => {
                    console.error('FFmpeg error real:', err);
                    reject(err);
                });
        });

        const stats = fs.statSync(outputPath);
        console.log(`Intento calidad ${quality} → ${stats.size} bytes`);

        if (stats.size <= 1000000) {
            return true; // ✅ listo
        }

        quality -= 10; // 🔻 bajar calidad
    }

    return false; // ❌ no se pudo comprimir suficiente
}

module.exports = async (msg) => {
    const id = Date.now();

    let inputPath = '';
    let outputPath = path.join(__dirname, `output_${id}.webp`);

    try {
        await msg.react('⏳');

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

        // ❌ No hay media
        if (!media) {
            await msg.react('❎');
            return msg.reply('Envía o responde a una imagen, video o GIF.');
        }

        // 📂 Extensión correcta
        const ext = media.mimetype.split('/')[1];
        inputPath = path.join(__dirname, `input_${id}.${ext}`);

        // 💾 Guardar archivo
        const buffer = Buffer.from(media.data, 'base64');
        fs.writeFileSync(inputPath, buffer);

        const isVideo = media.mimetype.includes('video');
        const isGif = media.mimetype.includes('gif');

        // 🖼️ IMAGEN → sticker normal
        if (!isVideo && !isGif) {
            const sent = await msg.reply(media, undefined, {
                sendMediaAsSticker: true,
                stickerAuthor: 'AkR Bot',
                stickerName: 'AkR'
            });

            await msg.react('🖼️');
            return sent;
        }

        const success = await convertToWebp(inputPath, outputPath);

        if (!success) {
            throw new Error('No se pudo comprimir el sticker lo suficiente');
        }

        const webp = fs.readFileSync(outputPath, { encoding: 'base64' });

        const sticker = new MessageMedia('image/webp', webp);

        const sent = await msg.reply(sticker, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

        return sent;

    } catch (error) {
        console.error('Error sticker ULTRA:', error);

        try {
            await msg.react('❎');
        } catch { }

        throw error;

    } finally {
        // 🧹 limpieza segura
        try { if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch { }
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { }
    }
};
