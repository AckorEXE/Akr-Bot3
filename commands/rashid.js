const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');

module.exports = async (msg) => {
  try {
    const rashidByDay = {
      1: {
        text: 'Los lunes se le puede encontrar en *Svargrond*, en la taberna de Dankwart, al sur del templo.',
        image: 'https://i.imgur.com/4By9VMT.jpeg'
      },
      2: {
        text: 'Los martes puedes encontrarle en *Liberty Bay*, en la taberna de Lyonel, al oeste del depot.',
        image: 'https://i.imgur.com/CkxkWZm.jpeg'
      },
      3: {
        text: 'Los miércoles puedes encontrarle en *Port Hope*, en la taberna de Clyde, al oeste del depot.',
        image: 'https://i.imgur.com/laKpglm.jpeg'
      },
      4: {
        text: 'Los jueves se le puede encontrar en *Ankrahmun*, en la taberna de Arito, encima de la oficina de correos.',
        image: 'https://i.imgur.com/ybYUrlW.jpeg'
      },
      5: {
        text: 'Los viernes puedes encontrarle en *Darashia*, en la taberna de Miraia, al sur de los gremios.',
        image: 'https://i.imgur.com/HS8sHAx.jpeg'
      },
      6: {
        text: 'Los sábados puedes encontrarlo en *Edron*, en la taberna de Mirabell, encima del depot.',
        image: 'https://i.imgur.com/YxClix3.jpeg'
      },
      0: {
        text: 'Los domingos se le puede encontrar en el depot de *Carlin*, un piso arriba.',
        image: 'https://i.imgur.com/vyhoj4T.jpeg'
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

    // ⬇ DESCARGA SEGURA DE LA IMAGEN
    const response = await axios.get(rashid.image, {
      responseType: 'arraybuffer'
    });

    const media = new MessageMedia(
      'image/jpeg',
      Buffer.from(response.data).toString('base64'),
      'rashid.jpg'
    );

    return await msg.reply(media, undefined, { caption });

  } catch (error) {
    console.error('Error en comando rashid:', error);

    try {
      await msg.react('❎');
    } catch {}

    throw error;
  }
};
