const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

/* =========================
   CONFIGURACIÓN
========================= */

const commandEmojis = {
    // grupos
    mp: '👥',
    link: '🔗',
    kick: '🚫',

    // multimedia
    sticker: '🖼️',
    s: '🖼️',
    media: '⬇️',

    // tibia
    item: '🛡️',
    monster: '👾',
    shared: '🧠',
    rashid: '🧞',
    imbuement: '🔥',

    // menú
    menu: '💛',
    help: '💛',
    commands: '💛',

    // descargas
    elfbot: '🧩',
    client860: '🧩',
    helper: '🧩',
};


const adminOnlyCommands = ['mp', 'kick', 'link'];

const cooldownCommands = {
    mp: 10,
    link: 10,
    kick: 10,
    sticker: 5,
    item: 5,
    monster: 5,
    rashid: 5,
    imbuement: 5,
    shared: 5,
    media: 5
};

// cooldowns[userId][command] = { last, warned }
const cooldowns = new Map();

// Cache simple de contactos (5 minutos)
const contactCache = new Map();
const CONTACT_CACHE_TTL = 5 * 60 * 1000;

function getCachedContact(userId) {
    const entry = contactCache.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.time > CONTACT_CACHE_TTL) {
        contactCache.delete(userId);
        return null;
    }
    return entry.value;
}

function setCachedContact(userId, value) {
    contactCache.set(userId, { value, time: Date.now() });
}

// Limpieza automática de cooldowns cada 10 minutos
setInterval(() => {
    const now = Date.now();
    for (const [userId, commandsMap] of cooldowns.entries()) {
        for (const [cmd, entry] of Object.entries(commandsMap)) {
            if (now - entry.last > 60 * 60 * 1000) {
                delete commandsMap[cmd];
            }
        }
        if (Object.keys(commandsMap).length === 0) {
            cooldowns.delete(userId);
        }
    }
}, 10 * 60 * 1000).unref();

/* =========================
   UTILIDADES
========================= */

async function safeReact(message, emoji) {
    try {
        await message.react(emoji);
    } catch { }
}

function checkCooldown(userId, command) {
    if (!cooldownCommands[command]) return { allowed: true };

    const now = Date.now();
    if (!cooldowns.has(userId)) cooldowns.set(userId, {});
    const userCooldowns = cooldowns.get(userId);
    userCooldowns[command] ??= { last: 0, warned: false };

    const entry = userCooldowns[command];
    const cdMs = cooldownCommands[command] * 1000;

    // Aún en cooldown
    if (now - entry.last < cdMs) {
        const remaining = Math.ceil((cdMs - (now - entry.last)) / 1000);

        // Ya avisó → silencio total
        if (entry.warned) {
            return { allowed: false, silent: true };
        }

        entry.warned = true;
        return { allowed: false, silent: false, remaining };
    }

    // Cooldown terminado → reset
    userCooldowns[command] = { last: now, warned: false };
    return { allowed: true };
}

async function isAdmin(chat, userId, client) {
    try {
        // 🔄 Forzar refresh del contacto
        const contact = await client.getContactById(userId);

        // 🔄 Buscar participante ACTUAL
        const participant = chat.participants.find(
            p => p.id._serialized === contact.id._serialized
        );

        return participant?.isAdmin || participant?.isSuperAdmin || false;
    } catch (err) {
        console.error('Error verificando admin:', err);
        return false;
    }
}

/* =========================
   LOGGER
========================= */

function logCommand(type, {
    command,
    user,
    userId,
    group,
    extra = ''
}) {
    const time = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
    });

    console.log(
        `[CMD] ${command} | ${type} | ${user} | ${userId} | Grupo: ${group}${extra ? ' | ' + extra : ''} | ${time}`
    );
}

/* =========================
   COMANDOS
========================= */

const menu = require('./commands/menu');
const mp = require('./commands/mp');
const link = require('./commands/link');
const kick = require('./commands/kick');
const shared = require('./commands/shared');
const item = require('./commands/item');
const monster = require('./commands/monster');
const rashid = require('./commands/rashid');
const sticker = require('./commands/sticker');
const elfbot = require('./commands/elfbot');
const client860 = require('./commands/client860');
const helper = require('./commands/helper');
const imbuement = require('./commands/imbuements');
const media = require('./commands/media');

const commands = {
    menu,
    commands: menu,
    help: menu,
    mp,
    link,
    kick,
    shared,
    item,
    monster,
    rashid,
    imbuement,

    sticker,
    s: sticker,

    elfbot,
    client860,
    helper,
    media
};

/* =========================
   CLIENTE
========================= */

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--disable-features=site-per-process'
        ]
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
    console.log('🤖 AkR-Bot conectado correctamente');
});

// Muestra error de porque se desconecta
client.on('disconnected', (reason) => {
    console.error('WhatsApp desconectado:', reason);
    process.exit(1);
});

/* =========================
   HANDLER PRINCIPAL
========================= */

client.on('message', async (msg) => {
    try {
        // Salir rápido si no parece comando
        if (!msg.body || msg.body[0] !== '!') return;

        // ❌ Ignorar privados
        const chat = await msg.getChat();
        if (!chat.isGroup) return;

        const args = msg.body.slice(1).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        const command = commands[commandName];
        if (!command) return;

        let contact = getCachedContact(msg.author || msg.from);
        if (!contact) {
            contact = await msg.getContact();
            setCachedContact(msg.author || msg.from, contact);
        }
        const userId = contact.id._serialized;
        const userName = contact.pushname || contact.name || 'Sin nombre';

        /* ========= COOLDOWN (ANTES DE REACCIONAR) ========= */

        const cd = checkCooldown(userId, commandName);
        if (!cd.allowed) {
            if (cd.silent) {
                logCommand('COOLDOWN-SILENT', {
                    command: commandName,
                    user: userName,
                    userId,
                    group: chat.name
                });
                return; // ❌ NO reacción, ❌ NO mensaje
            }

            logCommand('COOLDOWN', {
                command: commandName,
                user: userName,
                userId,
                group: chat.name,
                extra: `wait ${cd.remaining}s`
            });

            const cooldownMsg = await msg.reply(
                `Espera ${cd.remaining}s para usar este comando.`
            );
            await safeReact(cooldownMsg, '⏱');
            return;
        }

        /* ========= A PARTIR DE AQUÍ, SÍ SE EJECUTA ========= */

        // ⏳ Detecta comando
        await safeReact(msg, '⏳');

        // 🔐 Admin check (solo refrescamos el chat aquí)
        if (adminOnlyCommands.includes(commandName)) {
            const freshChat = await client.getChatById(chat.id._serialized);
            const admin = await isAdmin(freshChat, userId, client);
            if (!admin) {
                logCommand('NO-ADMIN', {
                    command: commandName,
                    user: userName,
                    userId,
                    group: chat.name
                });

                const errMsg = await msg.reply(
                    'Este comando solo puede ser utilizado por administradores.'
                );
                await Promise.allSettled([
                    safeReact(msg, '❎'),
                    safeReact(errMsg, '❎')
                ]);
                return;
            }
        }

        // ▶ Ejecutar comando
        const started = Date.now();
        const botMessage = await command(msg);
        const elapsed = Date.now() - started;
        if (elapsed > 1500) {
            console.log(`⚠️ Comando lento: ${commandName} tardó ${elapsed}ms`);
        }

        logCommand('OK', {
            command: commandName,
            user: userName,
            userId,
            group: chat.name
        });

        // 🤖 OK al usuario
        await safeReact(msg, '🤖');

        // Emoji final al mensaje del BOT
        if (botMessage && commandEmojis[commandName]) {
            await safeReact(botMessage, commandEmojis[commandName]);
        }

    } catch (err) {
        console.error('Error general:', err);

        logCommand('ERROR', {
            command: 'unknown',
            user: msg.from,
            userId: msg.from,
            group: 'unknown',
            extra: err.message
        });

        await safeReact(msg, '❎');
    }
});

client.initialize();

/**
 * ========================= MANEJO DE ERRORES CRÍTICOS =========================
 *
 * Puppeteer y WhatsApp Web pueden fallar internamente (contextos destruidos,
 * promesas no manejadas, crashes silenciosos, etc.).
 *
 * Estos handlers evitan que el bot quede "vivo pero roto":
 * - Si ocurre un error fatal no controlado
 * - El proceso se cierra intencionalmente
 * - PM2 lo reinicia automáticamente en limpio
 *
 * Esto mejora la estabilidad del bot y permite que PM2 lo reinicie limpio.
 * y garantiza operación 24/7 sin intervención manual.
 * ============================================================================
 */

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});
