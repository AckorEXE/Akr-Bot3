const { MessageMedia } = require('whatsapp-web.js');

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

        // ❌ No hay media
        if (!media) {
            await msg.reply('Debes enviar o responder a una imagen o video para crear un sticker.');
            await msg.react('❎');
            return null;
        }

        // ❌ Validar tipo de archivo
        const allowed = [
            'image/jpeg',
            'image/png',
            'video/mp4'
        ];

        if (!allowed.includes(media.mimetype)) {
            await msg.reply(
                `Este archivo no es compatible para stickers.\n` +
                `Tipo detectado: ${media.mimetype}`
            );
            await msg.react('❎');
            return null;
        }

        // ✅ Enviar sticker
        const sent = await msg.reply(media, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

        return sent;

    } catch (error) {
        console.error('Error en comando sticker:', error);

        try {
            await msg.react('❎');
        } catch {}

        return null;
    }
};
