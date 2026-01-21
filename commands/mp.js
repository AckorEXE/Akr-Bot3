module.exports = async (msg) => {
    try {
        const chat = await msg.getChat();
        const contacto = await msg.getContact();

        if (!chat.isGroup) {
            return await msg.reply('Este comando solo se puede usar en grupos.');
        }

        const participant = chat.participants.find(
            p => p.id._serialized === contacto.id._serialized
        );

        const isAdmin = participant?.isAdmin || participant?.isSuperAdmin;

        if (!isAdmin) {
            return await msg.reply('Este comando solo puede ser usado por administradores.');
        }

        let userMessage = '';

        if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            userMessage = quoted.body;
        } else {
            userMessage = msg.body.slice(3).trim();
        }

        if (!userMessage) {
            return await msg.reply('Escribe un mensaje para el mass poke.');
        }

        const text = `💢𝘔𝘈𝘚𝘚 𝘗𝘖𝘒𝘌💢\n${userMessage}\u200B`;

        const mentions = chat.participants.map(p => p.id._serialized);

        // ⬅️ MUY IMPORTANTE: devolver el mensaje enviado
        const sent = await chat.sendMessage(text, { mentions });
        return sent;

    } catch (error) {
        console.error('❌ Error en comando mp:', error);
        throw error;
    }
};
