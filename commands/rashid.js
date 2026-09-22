const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');

module.exports = async (msg) => {
  try {
    const rashidByDay = {
      1: {
        text: 'Los *lunes* se le puede encontrar en *Svargrond*, en la taberna de Dankwart, al sur del templo.',
        file: 'rashid_svargrond.jpg'
      },
      2: {
        text: 'Los *martes* puedes encontrarle en *Liberty Bay*, en la taberna de Lyonel, al oeste del depot.',
        file: 'rashid_libertybay.jpg'
      },
      3: {
        text: 'Los *miércoles* puedes encontrarle en *Port Hope*, en la taberna de Clyde, al oeste del depot.',
        file: 'rashid_porthope.jpg'
      },
      4: {
        text: 'Los *jueves* se le puede encontrar en *Ankrahmun*, en la taberna de Arito, encima de la oficina de correos.',
        file: 'rashid_ankrahmun.jpg'
      },
      5: {
        text: 'Los *viernes* puedes encontrarle en *Darashia*, en la taberna de Miraia, al sur de los gremios.',
        file: 'rashid_darashia.jpg'
      },
      6: {
        text: 'Los *sábados* puedes encontrarlo en *Edron*, en la taberna de Mirabell, encima del depot.',
        file: 'rashid_edron.jpg'
      },
      0: {
        text: 'Los *domingos* se le puede encontrar en el depot de *Carlin*, un piso arriba.',
        file: 'rashid_carlin.jpg'
      }
    };

    // 🕒 Hora actual en Alemania
    const nowBerlin = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })
    );

    const serverSaveHour = 10; // 10:00 AM Berlín
    let day = nowBerlin.getDay();

    // ⏳ Si aún NO pasa el Server Save, usar el día anterior
    if (nowBerlin.getHours() < serverSaveHour) {
      day = (day - 1 + 7) % 7;
    }

    const rashid = rashidByDay[day];
    if (!rashid) {
      return await msg.reply('No se pudo determinar la ubicación de Rashid hoy.');
    }

    // ⏱️ Calcular tiempo restante para el próximo Server Save
    const nextSS = new Date(nowBerlin);
    nextSS.setHours(serverSaveHour, 0, 0, 0);

    if (nowBerlin >= nextSS) {
      nextSS.setDate(nextSS.getDate() + 1);
    }

    const diffMs = nextSS - nowBerlin;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);

    const timeRemaining = `${diffHours}h ${diffMinutes}m`;

    const caption =
      `${rashid.text}\n\n` +
      `_Tiempo restante para SS:_ *${timeRemaining}*`;

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
