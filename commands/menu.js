module.exports = async (msg) => {
    const text =
'`🤖 *Comandos Disponibles*

👥 *GRUPOS*
• `!mp` - Mensaje masivo a miembros
• `!link` - Link del grupo
• `!kick @usuario` - Expulsar usuario

🎨 *MULTIMEDIA*
• `!sticker` o `!s` - Crea sticker
• `!media <link>` - Descarga de links

🐉 *TIBIA*
• `!item <nombre>` - Info de item
• `!monster <nombre>` - Info de monstruo
• `!shared <nivel>` - Calcula shared exp
• `!rashid` - Ubicación de Rashid hoy
• `!imbuement <list | type | nombre>` - Info de imbuements

⭐ *RUBINOT*
• `!rchar <nombre>` - Ver personaje
• `!rguild <nombre>` - Ver guild
• `!rstats <guild>` - Análisis de guild
• `!rwar <guild1, guild2>` - Estado de la war
• `!rwarchar <nombre>` - Desempeño en war

📥 *DESCARGAS*
• `!elfbot` - Descargar ElfBot
• `!client860` - Cliente 8.60
• `!helper` - Macro Tibia 13`';

    return await msg.reply(text);

};
