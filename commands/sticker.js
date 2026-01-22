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
            await msg.reply('Debes enviar o responder a una imagen para crear un sticker.');
            await msg.react('❎');
            return null;
        }

        // ❌ Validar imagen
        if (!media.mimetype.startsWith('image/')) {
            await msg.reply('Solo imágenes son compatibles para sticker.');
            await msg.react('❎');
            return null;
        }

        // ✅ Enviar como sticker (FIX aplicado)
        const sent = await msg.reply(media, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

        return sent;

    } catch (error) {
        console.error('Sticker error:', error);
        try { await msg.react('❎'); } catch {}
        return null;
    }
};
