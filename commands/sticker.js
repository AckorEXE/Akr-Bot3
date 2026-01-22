const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async (msg) => {
    try {
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

        // ❌ No hay imagen
        if (!media || !media.mimetype.startsWith('image/')) {
            await msg.reply('Debes enviar o responder a una imagen para crear un sticker.');
            await msg.react('❎');
            return null;
        }

        // 📁 Carpeta temporal
        const tempDir = path.join(__dirname, '../temp');
        fs.mkdirSync(tempDir, { recursive: true });

        const raw = path.join(tempDir, 'raw.png');
        const normalized = path.join(tempDir, 'normalized.png');
        const webp = path.join(tempDir, 'sticker.webp');

        // 💾 Guardar imagen original
        fs.writeFileSync(raw, Buffer.from(media.data, 'base64'));

        // 🧼 Normalizar imagen
        await sharp(raw)
            .resize(512, 512, { fit: 'inside' })
            .png()
            .toFile(normalized);

        // 🎯 Convertir a WEBP (sticker real)
        execSync(
            `ffmpeg -y -i "${normalized}" ` +
            `-vcodec libwebp -filter:v fps=15 ` +
            `-lossless 1 -compression_level 6 ` +
            `-q:v 50 -loop 0 -an -vsync 0 "${webp}"`
        );

        // 🧩 Crear media como STICKER
        const sticker = MessageMedia.fromFilePath(webp);
        sticker.mimetype = 'image/webp';
        sticker.filename = 'sticker.webp';

        // 📤 Enviar como sticker real
        const chat = await msg.getChat();
        const sent = await chat.sendMessage(sticker, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

        // 🧹 Limpieza
        fs.unlinkSync(raw);
        fs.unlinkSync(normalized);
        fs.unlinkSync(webp);

        return sent;

    } catch (error) {
        console.error('Sticker error:', error);
        try { await msg.react('❎'); } catch {}
        return null;
    }
};
