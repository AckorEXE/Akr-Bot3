module.exports = async (msg) => {
    try {
        const chat = await msg.getChat();

        // Obtener código de invitación
        const inviteCode = await chat.getInviteCode();
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        const caption =
            `👥 *${chat.name}*\n` +
            `📌 Invitación oficial al grupo\n\n` +
            `🔗 ${inviteLink}`;

        // ✅ Mandamos SOLO texto (sin imagen adjunta) para que WhatsApp
        // reconozca el link de invitación y genere su propia tarjeta
        // nativa con foto del grupo + botón "Ver grupo".
        // Si se manda como caption de una imagen, WhatsApp NO activa
        // esa tarjeta especial y solo muestra un preview genérico feo.
        return await chat.sendMessage(caption, { linkPreview: true });

    } catch (error) {
        console.error('Error en comando link (avanzado):', error);
        throw error;
    }
};
