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

    const query = args.join(' ').trim().toLowerCase();
    console.log('🔍 Buscando:', query);

    // 🔎 BUSCAR EN LA API
    const searchUrl = `https://tibia.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
    const searchRes = await axios.get(searchUrl);

    const results = searchRes.data?.query?.search || [];
    console.log('📄 Resultados:', results.map(r => r.title));

    if (results.length === 0) {
      const errorMsg = await msg.reply('❌ No se encontró ese item.');
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    // 🧠 FILTRO INTELIGENTE
    const blacklist = [
      'quest',
      'spoiler',
      'book',
      'full set',
      'outfit',
      'mount',
      'achievement'
    ];

    let filtered = results.filter(r => {
      const title = r.title.toLowerCase();

      return !blacklist.some(word => title.includes(word));
    });

    // 🎯 Priorizar coincidencias exactas o parciales
    let bestMatch = filtered.find(r =>
      r.title.toLowerCase() === query
    );

    if (!bestMatch) {
      bestMatch = filtered.find(r =>
        r.title.toLowerCase().includes(query)
      );
    }

    if (!bestMatch) {
      bestMatch = filtered[0];
    }

    // ❗ Si hay muchos resultados confusos → sugerir
    if (!bestMatch || filtered.length > 5) {
      let suggestions = results
        .slice(0, 5)
        .map(r => `• ${r.title}`)
        .join('\n');

      const suggestMsg = await msg.reply(
        `🤔 No fue claro el resultado.\n\nQuizás quisiste decir:\n${suggestions}`
      );

      await suggestMsg.react('❓');
      await msg.react('❓');
      return null;
    }

    const correctTitle = bestMatch.title;
    const formattedTitle = correctTitle.replace(/ /g, '_');

    console.log('✅ Item elegido:', correctTitle);

    // 📦 OBTENER INFO
    const infoUrl = `https://tibia.fandom.com/api.php?action=query&prop=extracts&titles=${encodeURIComponent(formattedTitle)}&format=json&exintro=1&explaintext=1`;

    const infoRes = await axios.get(infoUrl);
    const pages = infoRes.data.query.pages;
    const page = Object.values(pages)[0];

    if (!page || page.missing || !page.extract) {
      const errorMsg = await msg.reply(
        '❌ No se encontró información detallada del item.'
      );
      await errorMsg.react('❎');
      await msg.react('❎');
      return null;
    }

    // 🧹 LIMPIEZA
    let description = page.extract
      .replace(/\s+/g, ' ')
      .replace(/\[\d+\]/g, '')
      .trim();

    if (description.length > 700) {
      description = description.slice(0, 700) + '...';
    }

    const wikiUrl = `https://tibia.fandom.com/wiki/${formattedTitle}`;

    // ✉️ MENSAJE FINAL
    let text = `📦 *${correctTitle}*\n\n`;
    text += `ℹ️ ${description}\n\n`;
    text += `🔎 ${wikiUrl}`;

    const sentMessage = await msg.reply(text);
    await sentMessage.react('📚');

    return sentMessage;

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
