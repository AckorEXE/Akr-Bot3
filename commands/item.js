const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    // uso incorrecto
    if (args.length === 0) {
      const errorMsg = await msg.reply(
        'Uso correcto: *!item <nombre>*\nEjemplo: *!item magic sword*'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const itemName = args.join('-').toLowerCase();
    const url = `https://tiblioteca.com/item/${encodeURIComponent(itemName)}`;

    let response;
    try {
      response = await axios.get(url);
    } catch {
      const errorMsg = await msg.reply(
        'No se pudo obtener información del item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const $ = cheerio.load(response.data);

    // info principal
    let mainInfo = $('.col.text-start.bg-texto-verde').text().trim();

    // drop info
    let droppedBy = $('.list-group li')
      .first()
      .clone()
      .children('strong')
      .remove()
      .end()
      .text()
      .trim();

    // limpieza
    const clean = (text) =>
      text
        .replace(/\s+/g, ' ')
        .replace(/\.([A-Za-z])/g, '. $1')
        .trim();

    mainInfo = clean(mainInfo);
    droppedBy = clean(droppedBy);

    // error, sin info
    if (!mainInfo && !droppedBy) {
      const errorMsg = await msg.reply(
        'No se encontró información para ese item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    // construcción del mensaje
    let text = `📦 *${args.join(' ')}*\n\n`;

    if (mainInfo) {
      text += `ℹ️ ${mainInfo}\n\n`;
    }

    if (droppedBy) {
      text += `🎁 *Dropped by:* ${droppedBy}\n\n`;
    }

    text += `🔎 ${url}`;

    // exito
    const sentMessage = await msg.reply(text);
    await sentMessage.react('📚');

    return sentMessage;

  } catch (error) {
    console.error('Error en comando item:', error);

    try {
      await msg.react('❎');
    } catch {}

    throw error;
  }
};
