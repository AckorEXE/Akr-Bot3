const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

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
            await msg.reply('Solo imágenes compatibles para sticker.');
            await msg.react('❎');
            return null;
        }

        // 📁 Guardar temporal
        const input = path.join(__dirname, '../temp/input.png');
        const output = path.join(__dirname, '../temp/output.png');

        fs.mkdirSync(path.dirname(input), { recursive: true });

        fs.writeFileSync(input, Buffer.from(media.data, 'base64'));

        // 🧪 Normalizar imagen
        await sharp(input)
            .resize(512, 512, { fit: 'inside' })
            .png()
            .toFile(output);

        const sticker = MessageMedia.fromFilePath(output);

        const sent = await msg.reply(sticker, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

        fs.unlinkSync(input);
        fs.unlinkSync(output);

        return sent;

    } catch (err) {
        console.error('Sticker error:', err);
        try { await msg.react('❎'); } catch {}
        return null;
    }
};
