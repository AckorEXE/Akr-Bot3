module.exports = async (msg) => {
    try {
        const chat = await msg.getChat();
        const mentionedIds = msg.mentionedIds;

        // ❌ Uso incorrecto → falla
        if (!mentionedIds || mentionedIds.length === 0) {
            const errorMsg = await msg.reply(
                'Debes mencionar a uno o más usuarios para expulsar.'
            );

            // ❎ el bot se autoreacciona
            await errorMsg.react('❎');

            // ❎ el usuario también
            await msg.react('❎');

            // ⛔ NO devolver nada (no hay éxito)
            return null;
        }

        let kicked = [];
        let failed = [];

        for (const userId of mentionedIds) {
            try {
                await chat.removeParticipants([userId]);
                kicked.push(userId);
            } catch {
                failed.push(userId);
            }
        }

        // ❌ No se expulsó a nadie → falla
        if (kicked.length === 0) {
            let text = 'No se pudo expulsar a ningún usuario.';
            if (failed.length > 0) {
                text += `\nUsuarios fallidos: ${failed.length}`;
            }

            const errorMsg = await msg.reply(text);

            await errorMsg.react('❎');
            await msg.react('❎');

            return null;
        }

        // ✅ ÉXITO (al menos uno expulsado)
        let response = `*Expulsados:* ${kicked.length}`;

        if (failed.length > 0) {
            response += `*No se pudieron expulsar:* ${failed.length}`;
        }

        // 👉 DEVOLVER para que index.js ponga 😂
        return await msg.reply(response);

    } catch (error) {
        console.error('Error en comando kick:', error);

        // ❎ en error inesperado
        try {
            await msg.react('❎');
        } catch {}

        throw error;
    }
};
