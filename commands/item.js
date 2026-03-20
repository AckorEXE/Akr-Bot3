const axios = require('axios');

// 🔧 Capitalizar tipo "Wand Of Vortex" → Wand_of_Vortex
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

    const rawQuery = args.join(' ').trim();
    const formattedName = formatItemName(rawQuery);

    console.log('🔍 Intento directo:', formattedName);

    // 🔹 1. Intento directo
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
      const displayTitle = selected.title;

      console.log('✅ Usando resultado:', correctTitle);

      // 🔹 Obtener info
      infoUrl = `https://tibia.fandom.com/api.php?action=query&prop=extracts&titles=${correctTitle}&format=json&exintro=1&explaintext=1`;
      infoRes = await axios.get(infoUrl);
      page = Object.values(infoRes.data.query.pages)[0];

      // 🔥 FALLBACK SI NO HAY EXTRACT
      if (!page || !page.extract) {
        console.log('⚠️ Sin extract, usando contenido crudo...');

        const rawUrl = `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${correctTitle}&rvprop=content&format=json`;
        const rawRes = await axios.get(rawUrl);

        const rawPages = rawRes.data.query.pages;
        const rawPage = Object.values(rawPages)[0];

        let content = rawPage?.revisions?.[0]?.['*'] || '';

        if (!content) {
          const errorMsg = await msg.reply('❌ No se pudo obtener información.');
          await errorMsg.react('❎');
          await msg.react('❎');
          return null;
        }

        // 🧹 limpiar markup wiki
        content = content
          .replace(/\{\{[^}]+\}\}/g, '')
          .replace(/\[\[|\]\]/g, '')
          .replace(/==.*==/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (content.length > 700) {
          content = content.slice(0, 700) + '...';
        }

        return sendResponse(msg, displayTitle, content);
      }

      return sendResponse(msg, displayTitle, page.extract);
    }

    // ✅ éxito directo
    return sendResponse(msg, rawQuery, page.extract);

  } catch (err) {
    console.log('❌ ERROR COMPLETO:');
    console.log('Mensaje:', err.message);

    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Data:', err.response.data);
    }

    try {
      const errorMsg = await msg.reply(
        `❌ Error real:\n${err.response?.status || ''} ${err.message}`
      );
      await errorMsg.react('❎');
      await msg.react('❎');
    } catch {}

    return null;
  }
};

// 📦 RESPUESTA FINAL
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
