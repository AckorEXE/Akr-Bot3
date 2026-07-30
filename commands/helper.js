module.exports = async (msg) => {
    try {
        const text =
`🧩 *Tibia Helper (v13)*

Descarga el macro:
https://www.mediafire.com/file/9k3fbhk13c7fzys/TibiaHelper.rar/file`;

        // ✅ ÉXITO
        return await msg.reply(text, undefined, { linkPreview: false });

    } catch (error) {
        console.error('Error en comando helper:', error);

        try {
            await msg.react('❎');
        } catch {}

        throw error;
    }
};
