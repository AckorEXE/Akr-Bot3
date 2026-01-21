module.exports = async (msg) => {
    try {
        const args = msg.body.split(' ').slice(1);

        // ❌ Uso incorrecto
        if (args.length !== 1 || isNaN(args[0])) {
            const errorMsg = await msg.reply(
                'Uso correcto: *!shared <nivel>*\nEjemplo: *!shared 45*'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const level = parseInt(args[0], 10);

        const minLevel = Math.ceil(level / 1.5);
        const maxLevel = Math.ceil(level * 1.5);

        const text =`🧠 *Shared Experience*

Un nivel *${level}* puede compartir experiencia con niveles *${minLevel}* a *${maxLevel}*.`;

        // ✅ ÉXITO → devolver mensaje
        return await msg.reply(text);

    } catch (error) {
        console.error('Error en comando shared:', error);

        try {
            await msg.react('❎');
        } catch {}

        throw error;
    }
};
