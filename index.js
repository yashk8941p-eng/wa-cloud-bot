const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Server on port ${PORT}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "918941048044"; // Apna number yahan confirm kar lena
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`PAIRING CODE: ${code}`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('CONNECTED SUCCESSFULLY!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                if (!msg.message) continue;
                const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const sender = msg.pushName || msg.key.remoteJid;

                const voContainer = msg.message.viewOnceMessageV2?.message ||
                                    msg.message.viewOnceMessage?.message;
                const imgMsg = voContainer?.imageMessage || msg.message.imageMessage?.viewOnce;
                const vidMsg = voContainer?.videoMessage || msg.message.videoMessage?.viewOnce;

                if (imgMsg || vidMsg) {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    if (imgMsg) {
                        await sock.sendMessage(myJid, { image: buffer, caption: `🔓 View Once Photo Saved from ${sender}` });
                    } else if (vidMsg) {
                        await sock.sendMessage(myJid, { video: buffer, caption: `🔓 View Once Video Saved from ${sender}` });
                    }
                }
            } catch (e) {}
        }
    });
}

startBot();
