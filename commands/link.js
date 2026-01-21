const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (msg) => {
    try {
        const chat = await msg.getChat();

        // Obtener código de invitación
        const inviteCode = await chat.getInviteCode();
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        // Obtener foto del grupo (si existe)
        let media = null;
        try {
            const photoUrl = await chat.getProfilePicUrl();
            if (photoUrl) {
                media = await MessageMedia.fromUrl(photoUrl);
            }
        } catch (e) {
            // Si no hay foto o falla, seguimos sin imagen
            media = null;
        }

        const caption =
            `👥 *${chat.name}*\n` +
            `📌 Invitación oficial al grupo\n\n` +
            `🔗 ${inviteLink}`;

        // Si hay imagen, enviar imagen + caption
        if (media) {
            return await chat.sendMessage(media, { caption });
        }

        // Si NO hay imagen, enviar solo texto bonito
        return await chat.sendMessage(caption);

    } catch (error) {
        console.error('Error en comando link (avanzado):', error);
        throw error;
    }
};
