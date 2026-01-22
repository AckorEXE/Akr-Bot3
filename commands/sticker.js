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

        const input = path.join(tempDir, 'input.png');
        const webp = path.join(tempDir, 'sticker.webp');

        fs.writeFileSync(input, Buffer.from(media.data, 'base64'));

        // 🧼 Normalizar imagen
        await sharp(input)
            .resize(512, 512, { fit: 'inside' })
            .png()
            .toFile(input);

        // 🧪 Convertir a WEBP (formato sticker real)
        execSync(`ffmpeg -y -i ${input} -vcodec libwebp -filter:v fps=fps=15 -lossless 1 -compression_level 6 -q:v 50 -loop 0 -preset default -an -vsync 0 ${webp}`);

        const sticker = MessageMedia.fromFilePath(webp);

        // ✅ Enviar como sticker REAL (sin sendMediaAsSticker)
        const sent = await msg.reply(sticker);

        fs.unlinkSync(input);
        fs.unlinkSync(webp);

        return sent;

    } catch (err) {
        console.error('Sticker error:', err);
        try { await msg.react('❎'); } catch {}
        return null;
    }
};
