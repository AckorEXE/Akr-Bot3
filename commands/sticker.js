const { MessageMedia } = require('whatsapp-web.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
ffmpeg.setFfmpegPath(ffmpegPath);

// 🔥 VIDEO/GIF → WEBP animado con compresión
async function convertToWebp(inputPath, outputPath) {
    let quality = 60;
    while (quality >= 10) {
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .inputOptions(['-t 5'])
                .outputOptions([
                    '-vf',
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
                .on('error', reject);
        });
        const stats = fs.statSync(outputPath);
        if (stats.size <= 1000000) return true;
        quality -= 10;
    }
    return false;
}

// 🔥 IMAGEN → WEBP estático cuadrado
async function convertImageToWebp(inputPath, outputPath) {
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-vf',
                "crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2,scale=512:512",
                '-vcodec', 'libwebp',
                '-lossless', '0',
                '-q:v', '80'
            ])
            .toFormat('webp')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
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

        // ❌ Sin media → falla
        if (!media) {
            const errorMsg = await msg.reply('Envía o responde a una imagen, video o GIF.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const ext = media.mimetype.split('/')[1];
        inputPath = path.join(__dirname, `input_${id}.${ext}`);
        const buffer = Buffer.from(media.data, 'base64');
        fs.writeFileSync(inputPath, buffer);

        const isVideo = media.mimetype.includes('video');
        const isGif = media.mimetype.includes('gif');
        let success = false;

        if (isVideo || isGif) {
            success = await convertToWebp(inputPath, outputPath);
        } else {
            await convertImageToWebp(inputPath, outputPath);
            success = true;
        }

        // ❌ No se pudo comprimir → falla
        if (!success) {
            const errorMsg = await msg.reply('No se pudo procesar el sticker, el archivo es demasiado pesado.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const webp = fs.readFileSync(outputPath, { encoding: 'base64' });
        const sticker = new MessageMedia('image/webp', webp);

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
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    }
};
