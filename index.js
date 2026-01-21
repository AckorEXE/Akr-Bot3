const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { getFreshGroupChat } = require('./utils/groupSync');

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

    // tibia
    item: '🛡️',
    monster: '👾',
    shared: '🧠',

    // menú
    menu: '💛',
    help: '💛',
    commands: '💛',

    // descargas
    elfbot: '🧩',
    client860: '🧩',
    helper: '🧩'
};


const adminOnlyCommands = ['mp', 'kick', 'link'];

const cooldownCommands = {
    mp: 10,
    link: 10,
    kick: 10,
    sticker: 5,
    item: 5,
    monster: 5,
    shared: 5
};

// cooldowns[userId][command] = { last, warned }
const cooldowns = {};

/* =========================
   UTILIDADES
========================= */

async function safeReact(message, emoji) {
    try {
        await message.react(emoji);
    } catch {}
}

function checkCooldown(userId, command) {
    if (!cooldownCommands[command]) return { allowed: true };

    const now = Date.now();
    cooldowns[userId] ??= {};
    cooldowns[userId][command] ??= { last: 0, warned: false };

    const entry = cooldowns[userId][command];
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
    cooldowns[userId][command] = { last: now, warned: false };
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
const sticker = require('./commands/sticker');
const elfbot = require('./commands/elfbot');
const client860 = require('./commands/client860');
const helper = require('./commands/helper');

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

    sticker,
    s: sticker,

    elfbot,
    client860,
    helper
};

/* =========================
   CLIENTE
========================= */

const client = new Client({
  authStrategy: new LocalAuth()
});

client.initialize();

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
    console.log('🤖 AkR-Bot conectado correctamente');
});

/* =========================
   HANDLER PRINCIPAL
========================= */

client.on('message', async (msg) => {
    try {
        // ❌ Ignorar privados
        const rawChat = await msg.getChat();
        if (!rawChat.isGroup) return;

        // 🔄 Chat fresco (evita bugs de admin)
        const chat = await getFreshGroupChat(client, rawChat.id._serialized);
        if (!chat) return;

        if (!msg.body.startsWith('!')) return;

        const args = msg.body.slice(1).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        const command = commands[commandName];
        if (!command) return;

        const contact = await msg.getContact();
        const userId = contact.id._serialized;
        const userName = contact.pushname || 'Sin nombre';

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

        // 🔐 Admin check
        if (adminOnlyCommands.includes(commandName)) {
            const admin = await isAdmin(chat, userId, client);
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
                await safeReact(msg, '❎');
                await safeReact(errMsg, '❎');
                return;
            }
        }

        // ▶ Ejecutar comando
        const botMessage = await command(msg);

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
