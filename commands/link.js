// Parche para el bug fetchMexGroupInviteCode (issue #201916)
async function getInviteCodeFix(client, chatId) {
    const codeRes = await client.pupPage.evaluate(async (chatId) => {
        try {
            if (!window.__WWebJSGroupInviteBundleLoaded) {
                try {
                    await window
                        .require('WAWebGroupInviteLinkDrawerLoadable')
                        .requireBundle();
                } catch (_e) {
                    // best-effort
                }
                window.__WWebJSGroupInviteBundleLoaded = true;
            }

            return await window
                .require('WAWebMexFetchGroupInviteCodeJob')
                .fetchMexGroupInviteCode(chatId);
        } catch (err) {
            if (err.name === 'ServerStatusCodeError') return undefined;
            throw err;
        }
    }, chatId);

    return codeRes?.code ? codeRes.code : codeRes;
}

module.exports = async (msg) => {
    try {
        const chat = await msg.getChat();

        if (!chat.isGroup) {
            return msg.reply('Este comando solo funciona en grupos.');
        }

        // Obtener código de invitación (con el parche)
        const inviteCode = await getInviteCodeFix(msg.client, chat.id._serialized);

        if (!inviteCode) {
            return msg.reply('No pude obtener el enlace. ¿El bot es admin del grupo?');
        }

        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        const caption =
            `👥 *${chat.name}*\n` +
            `📌 Invitación oficial al grupo\n\n` +
            `🔗 ${inviteLink}`;

        // ✅ Mandamos SOLO texto (sin imagen adjunta) para que WhatsApp
        // reconozca el link de invitación y genere su propia tarjeta
        // nativa con foto del grupo + botón "Ver grupo".
        return await chat.sendMessage(caption, { linkPreview: false });

    } catch (error) {
        console.error('Error en comando link (avanzado):', error);
        throw error;
    }
};
