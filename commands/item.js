const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (msg) => {
  try {
    const args = msg.body.split(' ').slice(1);

    // ❌ Sin argumentos
    if (args.length === 0) {
      const errorMsg = await msg.reply(
        'Uso correcto: *!item <nombre>*\nEjemplo: *!item magic sword*'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    // 🔧 Formato para TibiaWiki
    const itemName = args
      .join('_')
      .replace(/'/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .trim();

    const url = `https://tibia.fandom.com/wiki/${itemName}`;

    let response;
    try {
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
    } catch {
      const errorMsg = await msg.reply(
        'No se pudo obtener información del item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    const $ = cheerio.load(response.data);

    // 🧾 Descripción principal
    let description = $('.mw-parser-output p')
      .first()
      .text()
      .trim();

    // 📊 Info de tabla (atributos)
    let attributes = [];

    $('.infobox tr').each((i, el) => {
      const key = $(el).find('th').text().trim();
      const value = $(el).find('td').text().trim();

      if (key && value) {
        attributes.push(`• *${key}:* ${value}`);
      }
    });

    // 🧹 limpieza
    const clean = (text) =>
      text
        .replace(/\[\d+\]/g, '') // quita referencias tipo [1]
        .replace(/\s+/g, ' ')
        .trim();

    description = clean(description);
    attributes = attributes.map(clean);

    // ❌ Sin info
    if (!description) {
      const errorMsg = await msg.reply(
        'No se encontró información para ese item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    // ✉️ Construcción del mensaje
    let text = `📦 *${args.join(' ')}*\n\n`;

    text += `ℹ️ ${description}\n\n`;

    if (attributes.length > 0) {
      text += `📊 *Atributos:*\n`;
      text += attributes.slice(0, 8).join('\n'); // limitamos para no saturar
      text += `\n\n`;
    }

    text += `🔎 ${url}`;

    // ✅ Enviar
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
