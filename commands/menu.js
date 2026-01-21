module.exports = async (msg) => {
    const text =
`┌─ [ 🤖Comandos🤖 ]  
📂 *Grupos*  
├👥 *!mp* <mensaje>  
├🔗 *!link*  
├🚫 *!kick* <@usuario>  

🎨 *Multimedia*  
├🖼️ *!sticker* | *!s*  

🐉 *Tibia*  
├🛡️ *!item* <nombre>  
├👾 *!monster* <nombre>  
├🤝 *!shared* <nivel>  

📥 *Descargas*  
├🧩 *!elfbot*  
├🧩 *!client860* <cliente 8.60>  
├🧩 *!helper* <macro tibia 13> 
└───────────`;

    return await msg.reply(text);
};