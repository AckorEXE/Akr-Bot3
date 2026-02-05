client.on('message', async (msg) => {
  try {
    if (!msg.body) return;

    const body = msg.body.toLowerCase().trim();

    if (body !== '!rashid') return;

    const rashidByDay = {
      1: {
        text: 'Los lunes se le puede encontrar en *Svargrond*, en la taberna de Dankwart, al sur del templo.',
        image: 'https://static.wikia.nocookie.net/tibia/images/6/64/Rashid_Svargrond.png'
      },
      2: {
        text: 'Los martes puedes encontrarle en *Liberty Bay*, en la taberna de Lyonel, al oeste de la estación.',
        image: 'https://static.wikia.nocookie.net/tibia/images/0/09/Rashid_Liberty_Bay.png'
      },
      3: {
        text: 'Los miércoles puedes encontrarle en *Port Hope*, en la taberna de Clyde, al oeste de la estación.',
        image: 'https://static.wikia.nocookie.net/tibia/images/2/2b/Rashid_Port_Hope.png'
      },
      4: {
        text: 'Los jueves se le puede encontrar en *Ankrahmun*, en la taberna de Arito, encima de la oficina de correos.',
        image: 'https://static.wikia.nocookie.net/tibia/images/4/4c/Rashid_Ankrahmun.png'
      },
      5: {
        text: 'Los viernes puedes encontrarle en *Darashia*, en la taberna de Miraia, al sur de los gremios.',
        image: 'https://static.wikia.nocookie.net/tibia/images/9/92/Rashid_Darashia.png'
      },
      6: {
        text: 'Los sábados puedes encontrarlo en *Edron*, en la taberna de Mirabell, encima del depósito.',
        image: 'https://static.wikia.nocookie.net/tibia/images/5/52/Rashid_Edron.png'
      },
      0: {
        text: 'Los domingos se le puede encontrar en el depósito de *Carlin*, un piso arriba.',
        image: 'https://static.wikia.nocookie.net/tibia/images/8/86/Rashid_Carlin.png'
      }
    };

    const today = new Date().getDay();
    const rashid = rashidByDay[today];

    if (!rashid) {
      await msg.reply('❌ No se pudo determinar la ubicación de Rashid hoy.');
      return;
    }

    const caption =
      `🧞 *Rashid – Comerciante Viajero*\n\n` +
      `${rashid.text}\n\n` +
      `💰 Compra armas, armaduras y objetos valiosos.\n` +
      `📅 Rashid cambia de ciudad cada día.`;

    const media = await MessageMedia.fromUrl(rashid.image);

    await client.sendMessage(msg.from, media, { caption });

  } catch (err) {
    console.error('Error en comando !rashid:', err);
    await msg.reply('❌ Ocurrió un error al obtener la información de Rashid.');
  }
});
