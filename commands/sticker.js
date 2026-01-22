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
            const errorMsg = await msg.reply(
                'Debes enviar o responder a una imagen para crear un sticker.'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // ✅ ENVIAR STICKER COMO REPLY (CLAVE)
        const sent = await msg.reply(media, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'AkR Bot',
            stickerName: 'AkR'
        });

        // 👉 DEVOLVER mensaje para que index.js reaccione 🖼️
        return sent;

    } catch (error) {
        console.error('Error en comando sticker:', error);

        try {
            await msg.react('❎');
        } catch {}

        throw error;
    }
};
