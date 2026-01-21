module.exports = async (msg) => {
    try {
        const text =
`🧩 *ElfBot NG*

Descarga ElfBot (no requiere crack):
https://www.mediafire.com/file/iahkvgwwnopmcxk/ElfBot_NG_4.5.9.rar/file`;

        // ✅ ÉXITO
        return await msg.reply(text);

    } catch (error) {
        console.error('Error en comando elfbot:', error);

        try {
            await msg.react('❎');
        } catch {}

        throw error;
    }
};
