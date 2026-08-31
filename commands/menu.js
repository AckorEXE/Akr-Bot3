module.exports = async (msg) => {
    const text =
`┌─ [ 🤖Comandos🤖 ]  
📂 *Grupos*  
├👥 *!mp* <mensaje>  
├🔗 *!link*  
├🚫 *!kick* <@usuario>  

🎨 *Multimedia*  
├🖼️ *!sticker* | *!s*
├⬇️ *!media* | <link>

🐉 *Tibia*  
├🛡️ *!item* <nombre>  
├👾 *!monster* <nombre>  
├🤝 *!shared* <nivel>  
├🧞 *!rashid*
├🔥 *!imbuement*

⭐ *RubinOT*  
├🔰 *!rchar* <nombre>
├🔰 *!rguild* <nombre>
├🔰 *!rstats* <nombre>
├🔰 *!rwar* <guild1, guild2>

📥 *Descargas*  
├🧩 *!elfbot*  
├🧩 *!client860* <cliente 8.60>  
├🧩 *!helper* <macro tibia 13> 
└───────────`;

    return await msg.reply(text);

};
