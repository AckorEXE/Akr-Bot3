function isBotAdmin(chat, client) {
    const botId = client.info.wid._serialized;
    const p = chat.participants?.find(x => x.id._serialized === botId);
    return !!(p && (p.isAdmin || p.isSuperAdmin));
}

function isUserAdmin(chat, contacto) {
    const p = chat.participants?.find(
        x => x.id._serialized === contacto.id._serialized
    );
    return !!(p && (p.isAdmin || p.isSuperAdmin));
}

module.exports = { isBotAdmin, isUserAdmin };
