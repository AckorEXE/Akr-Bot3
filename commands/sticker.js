const { MessageMedia } = require('whatsapp-web.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

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

        // ✅ AHORA sí puedes usar media
        const ext = media.mimetype.split('/')[1];
        inputPath = path.join(__dirname, `input_${id}.${ext}`);

        // 📦 Guardar archivo
        const buffer = Buffer.from(media.data, 'base64');
        fs.writeFileSync(inputPath, buffer);

        const isVideo = media.mimetype.includes('video');
        const isGif = media.mimetype.includes('gif');

        // 🖼️ IMAGEN → directo
        if (!isVideo && !isGif) {
            const sent = await msg.reply(media, undefined, {
                sendMediaAsSticker: true,
                stickerAuthor: 'AkR Bot',
                stickerName: 'AkR'
            });

            await msg.react('🖼️');
            return sent;
        }

        // 🎥 VIDEO / GIF → ANIMADO
        await msg.react('⏳');

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .inputOptions(['-t 5'])
                .outputOptions([
                    '-vf',
                    'scale=512:512:force_original_aspect_ratio=decrease,' +
                    'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,' +
                    'fps=10',

                    '-vcodec', 'libwebp',
                    '-lossless', '0',
                    '-compression_level', '6',
                    '-q:v', '50',

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

        // 📏 Validar peso
        const stats = fs.statSync(outputPath);
        if (stats.size > 1000000) {
            throw new Error('Sticker demasiado pesado');
        }

        const webp = fs.readFileSync(outputPath, { encoding: 'base64' });

        const sticker = new MessageMedia('image/webp', webp);

        const sent = await msg.reply(sticker, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

        await msg.react('🎞️');

        return sent;

    } catch (error) {
        console.error('Error sticker PRO:', error);

        try {
            await msg.react('❎');
        } catch {}

        throw error;

    } finally {
        // 🧹 limpieza segura
        try { if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    }
};
