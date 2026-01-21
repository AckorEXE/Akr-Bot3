function logCommand(msg, commandName) {
    const time = new Date().toLocaleTimeString();
    const user = msg._data.notifyName || msg.from;
    const chatName = msg._data.chat?.name || msg.from;

    console.log(
        `[CMD] ${commandName} | User: ${user} | Chat: ${chatName} | ${time}`
    );
}

module.exports = { logCommand };
