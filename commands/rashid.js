const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');

module.exports = async (msg) => {
  try {
    const rashidByDay = {
      1: {
        text: 'Los lunes se le puede encontrar en *Svargrond*, en la taberna de Dankwart, al sur del templo.',
        file: 'rashid_svargrond.jpg'
      },
      2: {
        text: 'Los martes puedes encontrarle en *Liberty Bay*, en la taberna de Lyonel, al oeste del depot.',
        file: 'rashid_libertybay.jpg'
      },
      3: {
        text: 'Los miércoles puedes encontrarle en *Port Hope*, en la taberna de Clyde, al oeste del depot.',
        file: 'rashid_porthope.jpg'
      },
      4: {
        text: 'Los jueves se le puede encontrar en *Ankrahmun*, en la taberna de Arito, encima de la oficina de correos.',
        file: 'rashid_ankrahmun.jpg'
      },
      5: {
        text: 'Los viernes puedes encontrarle en *Darashia*, en la taberna de Miraia, al sur de los gremios.',
        file: 'rashid_darashia.jpg'
      },
      6: {
        text: 'Los sábados puedes encontrarlo en *Edron*, en la taberna de Mirabell, encima del depot.',
        file: 'rashid_edron.jpg'
      },
      0: {
        text: 'Los domingos se le puede encontrar en el depot de *Carlin*, un piso arriba.',
        file: 'rashid_carlin.jpg'
      }
    };

    const today = new Date().getDay();
    const rashid = rashidByDay[today];

    if (!rashid) {
      return await msg.reply('❌ No se pudo determinar la ubicación de Rashid hoy.');
    }

    const caption =
      `*Rashid*\n\n` +
      `${rashid.text}\n\n` +
      `💰 Compra armas, armaduras y objetos valiosos.\n` +
      `📅 Rashid cambia de ciudad cada día.`;

    const imagePath = path.join(__dirname, '..', 'images', rashid.file);
    const media = MessageMedia.fromFilePath(imagePath);

    return await msg.reply(media, undefined, { caption });

  } catch (error) {
    console.error('Error en comando rashid:', error);

    try {
      await msg.react('❎');
    } catch {}

    throw error;
  }
};
