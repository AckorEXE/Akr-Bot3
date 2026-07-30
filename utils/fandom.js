const axios = require('axios');
const https = require('https');

const cache = new Map();

const api = axios.create({
    httpsAgent: new https.Agent({
        keepAlive: true
    }),
    timeout: 6000,
    headers: {
        'User-Agent': 'AkR-Bot'
    }
});


async function cacheGet(key, callback) {

    if (cache.has(key)) {
        return cache.get(key);
    }

    const data = await callback();

    if (data) {
        cache.set(key, data);

        setTimeout(() => {
            cache.delete(key);
        }, 60 * 60 * 1000);
    }

    return data;
}



async function getPage(title) {

    return cacheGet(`page:${title.toLowerCase()}`, async () => {

        try {

            const res = await api.get(
                `https://tibia.fandom.com/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvprop=content&format=json`
            );


            const pages = res.data?.query?.pages;

            if (!pages)
                return null;


            const page = Object.values(pages)[0];


            if (page.missing !== undefined)
                return null;


            return page?.revisions?.[0]?.['*'] || null;


        } catch (err) {

            console.log('❌ Fandom getPage:', err.message);
            return null;

        }

    });

}



async function search(query) {

    return cacheGet(`search:${query.toLowerCase()}`, async () => {

        try {

            const res = await api.get(
                `https://tibia.fandom.com/api.php?action=query&list=search&srlimit=5&srsearch=${encodeURIComponent(query)}&format=json`
            );


            return res.data?.query?.search || [];


        } catch (err) {

            console.log('❌ Fandom search:', err.message);
            return [];

        }

    });

}



module.exports = {
    getPage,
    search
};
