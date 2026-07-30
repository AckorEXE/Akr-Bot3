module.exports = async (msg) => {
    try {
        const text =
`🧩 *Ackor Client 8.60*

Descarga el cliente:
https://www.mediafire.com/file/s6x5cmetrqlieg3/AckorClient_RetroEK10_Jester_V3.rar/file`;

        // ✅ ÉXITO
        return await msg.reply(text, undefined, { linkPreview: false });

    } catch (error) {
        console.error('Error en comando client:', error);

        try {
            await msg.react('❎');
        } catch {}

        throw error;
    }
};
