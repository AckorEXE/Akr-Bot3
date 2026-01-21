const commandTimestamps = {};

function checkCommandDelay(userId, command, delay = 10000) {
    const now = Date.now();
    commandTimestamps[userId] ??= {};

    if (commandTimestamps[userId][command]) {
        const elapsed = now - commandTimestamps[userId][command];
        if (elapsed < delay) {
            return {
                allowed: false,
                remainingTime: ((delay - elapsed) / 1000).toFixed(1)
            };
        }
    }

    commandTimestamps[userId][command] = now;
    return { allowed: true };
}

module.exports = { checkCommandDelay };
