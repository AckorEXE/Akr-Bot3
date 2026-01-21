async function getFreshGroupChat(client, chatId) {
    const chats = await client.getChats();
    return chats.find(c => c.id._serialized === chatId);
}

module.exports = { getFreshGroupChat };
