const axios = require('axios');

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

    const query = args.join(' ');

    // 🔍 1. Buscar nombre correcto
    const searchUrl = `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;

    const searchRes = await axios.get(searchUrl);
    const results = searchRes.data.query.search;

    if (!results || results.length === 0) {
      const errorMsg = await msg.reply('No se encontró ese item.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const correctTitle = results[0].title.replace(/ /g, '_');

    // 📦 2. Obtener descripción
    const infoUrl = `https://tibia.fandom.com/api.php?action=query&prop=extracts&titles=${encodeURIComponent(correctTitle)}&format=json&exintro=1&explaintext=1`;

    const infoRes = await axios.get(infoUrl);
    const pages = infoRes.data.query.pages;
    const page = Object.values(pages)[0];

    if (!page || !page.extract) {
      const errorMsg = await msg.reply(
        'No se pudo obtener información del item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    let description = page.extract
      .replace(/\s+/g, ' ')
      .trim();

    if (description.length > 700) {
      description = description.slice(0, 700) + '...';
    }

    const wikiUrl = `https://tibia.fandom.com/wiki/${correctTitle}`;

    let text = `📦 *${results[0].title}*\n\n`;
    text += `ℹ️ ${description}\n\n`;
    text += `🔎 ${wikiUrl}`;

    const sentMessage = await msg.reply(text);
    await sentMessage.react('📚');

    return sentMessage;

  } catch (error) {
    console.error('Error en comando item:', error);

    try {
      await msg.react('❎');
    } catch {}

    return null;
  }
};
