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

    const itemName = args.join('_');

    const url = `https://tibia.fandom.com/api.php?action=query&prop=extracts&titles=${encodeURIComponent(itemName)}&format=json&exintro=1&explaintext=1`;

    let response;
    try {
      response = await axios.get(url);
    } catch (err) {
      console.log('ERROR API:', err.message);

      const errorMsg = await msg.reply(
        'No se pudo obtener información del item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const pages = response.data.query.pages;
    const page = Object.values(pages)[0];

    if (!page || page.missing || !page.extract) {
      const errorMsg = await msg.reply(
        'No se encontró información para ese item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    let description = page.extract
      .replace(/\s+/g, ' ')
      .trim();

    // limitar tamaño (whatsapp)
    if (description.length > 700) {
      description = description.slice(0, 700) + '...';
    }

    const wikiUrl = `https://tibia.fandom.com/wiki/${itemName}`;

    let text = `📦 *${args.join(' ')}*\n\n`;
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
