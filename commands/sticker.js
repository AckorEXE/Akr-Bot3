const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async (msg) => {
    try {
        let media;

        if (msg.hasMedia) {
            media = await msg.downloadMedia();
        } else if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            if (quoted.hasMedia) media = await quoted.downloadMedia();
        }

        if (!media || !media.mimetype.startsWith('image/')) {
            await msg.reply('Solo imágenes para sticker.');
            await msg.react('❎');
            return null;
        }

        const tempDir = path.join(__dirname, '../temp');
        fs.mkdirSync(tempDir, { recursive: true });

        const raw = path.join(tempDir, 'raw.png');
        const normalized = path.join(tempDir, 'normalized.png');
        const webp = path.join(tempDir, 'sticker.webp');

        // Guardar imagen original
        fs.writeFileSync(raw, Buffer.from(media.data, 'base64'));

        // 🧼 Normalizar imagen (archivo NUEVO)
        await sharp(raw)
            .resize(512, 512, { fit: 'inside' })
            .png()
            .toFile(normalized);

        // 🎯 Convertir a WEBP (sticker real)
        execSync(
            `ffmpeg -y -i ${normalized} ` +
            `-vcodec libwebp -filter:v fps=15 ` +
            `-lossless 1 -compression_level 6 ` +
            `-q:v 50 -loop 0 -an -vsync 0 ${webp}`
        );

        const sticker = MessageMedia.fromFilePath(webp);

        const sent = await msg.reply(sticker);

        // 🧹 Limpieza
        fs.unlinkSync(raw);
        fs.unlinkSync(normalized);
        fs.unlinkSync(webp);

        return sent;

    } catch (err) {
        console.error('Sticker error:', err);
        try { await msg.react('❎'); } catch {}
        return null;
    }
};
