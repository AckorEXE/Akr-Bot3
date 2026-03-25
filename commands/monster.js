const axios = require('axios');

module.exports = async (msg) => {
    try {
        const args = msg.body.split(' ').slice(1);

        // ❌ Uso incorrecto
        if (args.length === 0) {
            const errorMsg = await msg.reply(
                'Uso correcto: *!monster <nombre>*\nEjemplo: *!monster dragon lord*'
            );
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const monsterName = args.join(' ');
        const url = `https://api.tibiadata.com/v4/creature/${encodeURIComponent(monsterName)}`;

        let response;
        try {
            response = await axios.get(url);
        } catch {
            const errorMsg = await msg.reply('No se encontró el monster.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        const monster = response.data?.creature;
        if (!monster) {
            const errorMsg = await msg.reply('No se encontró información del monster.');
            await errorMsg.react('❎');
            await msg.react('❎');
            return null;
        }

        // 🔒 Normalizar datos (CLAVE)
        const name = monster.name ?? 'Unknown';
        const hitpoints = monster.hitpoints ?? 'N/A';
        const experience = monster.experience_points ?? 'N/A';

        const immune = Array.isArray(monster.immune) ? monster.immune : [];
        const strong = Array.isArray(monster.strong) ? monster.strong : [];
        const weakness = Array.isArray(monster.weakness) ? monster.weakness : [];
        const loot = Array.isArray(monster.loot_list) ? monster.loot_list : [];

        const damageText =
`🚫 *Inmune a:* ${immune.length ? immune.join(', ') : 'none'}
💪 *Fuerte contra:* ${strong.length ? strong.join(', ') : 'none'}
💔 *Débil a:* ${weakness.length ? weakness.join(', ') : 'none'}`;

        let text =
`👾 *${name}*

❤️ *Vida:* ${hitpoints}
⭐ *Experiencia:* ${experience}

*Daño recibido de los elementos:*
${damageText}`;

        if (loot.length) {
            text += `\n\n🎁 *Loot:*\n${loot.join(', ')}`;
        }

        // ✅ ÉXITO
        return await msg.reply(text);

    } catch (error) {
        console.error('Error en comando monster:', error);

        try {
            await msg.react('❎');
        } catch {}

        throw error;
    }
};
