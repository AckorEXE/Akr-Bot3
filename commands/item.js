const axios = require('axios');

// 🔧 Capitalizar tipo "Wand Of Vortex"
function formatItemName(text) {
  const exceptions = ['of', 'the', 'and', 'in', 'on', 'at'];

  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (exceptions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('_');
}

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    if (args.length === 0) {
      const errorMsg = await msg.reply(
        'Uso correcto: *!item <nombre>*\nEjemplo: *!item magic sword*'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const rawQuery = args.join(' ');
    const formattedName = formatItemName(rawQuery);

    console.log('🔍 Intento directo:', formattedName);

    // 🔹 1. Intento directo (rápido)
    let infoUrl = `https://tibia.fandom.com/api.php?action=query&prop=extracts&titles=${formattedName}&format=json&exintro=1&explaintext=1`;

    let infoRes = await axios.get(infoUrl);
    let page = Object.values(infoRes.data.query.pages)[0];

    // 🔁 2. Si falla → buscar
    if (!page || page.missing || !page.extract) {
      console.log('⚠️ No encontrado directo, buscando...');

      const searchUrl = `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(rawQuery)}&format=json`;
      const searchRes = await axios.get(searchUrl);

      const results = searchRes.data?.query?.search || [];

      console.log('📄 Resultados:', results.map(r => r.title));

      if (results.length === 0) {
        const errorMsg = await msg.reply('❌ No se encontró ese item.');
        await errorMsg.react('❎');
        await msg.react('❎');
        return null;
      }

      // 🧠 FILTRO BÁSICO
      const blacklist = ['quest', 'spoiler'];

      const valid = results.find(r => {
        const title = r.title.toLowerCase();
        return !blacklist.some(b => title.includes(b));
      });

      const selected = valid || results[0];
      const correctTitle = selected.title.replace(/ /g, '_');

      console.log('✅ Usando resultado:', correctTitle);

      // volver a pedir info
      infoUrl = `https://tibia.fandom.com/api.php?action=query&prop=extracts&titles=${correctTitle}&format=json&exintro=1&explaintext=1`;
      infoRes = await axios.get(infoUrl);
      page = Object.values(infoRes.data.query.pages)[0];

      if (!page || !page.extract) {
        const errorMsg = await msg.reply('❌ No se pudo obtener información.');
        await errorMsg.react('❎');
        await msg.react('❎');
        return null;
      }

      return sendResponse(msg, selected.title, page.extract);
    }

    // ✅ éxito directo
    return sendResponse(msg, rawQuery, page.extract);

  } catch (err) {
    console.log('❌ ERROR:', err.message);

    if (err.response) {
      console.log('Status:', err.response.status);
    }

    try {
      const errorMsg = await msg.reply(`❌ Error: ${err.message}`);
      await errorMsg.react('❎');
      await msg.react('❎');
    } catch {}

    return null;
  }
};

// 📦 respuesta limpia
async function sendResponse(msg, title, extract) {
  let description = extract
    .replace(/\s+/g, ' ')
    .replace(/\[\d+\]/g, '')
    .trim();

  if (description.length > 700) {
    description = description.slice(0, 700) + '...';
  }

  const url = `https://tibia.fandom.com/wiki/${title.replace(/ /g, '_')}`;

  let text = `📦 *${title}*\n\n`;
  text += `ℹ️ ${description}\n\n`;
  text += `🔎 ${url}`;

  const sentMessage = await msg.reply(text);
  await sentMessage.react('📚');

  return sentMessage;
}
