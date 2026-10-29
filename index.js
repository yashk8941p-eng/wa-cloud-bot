const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WA Bot is Alive & Running!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        // Yahan apna WhatsApp number 91 ke sath likhein (jaise: 918941048044)
        const phoneNumber = "918941048044"; 
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n========================================`);
        console.log(`🔑 AAPKA PAIRING CODE: ${code}`);
        console.log(`========================================\n`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('✅ CLOUD BOT SUCCESSFULLY CONNECTED!');
        }
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
                const sender = msg.pushName || msg.key.participant || msg.key.remoteJid;

                const voContainer = msg.message.viewOnceMessageV2?.message ||
                                    msg.message.viewOnceMessage?.message ||
                                    msg.message.viewOnceMessageV2Extension?.message;

                const directImg = msg.message.imageMessage?.viewOnce ? msg.message.imageMessage : null;
                const directVid = msg.message.videoMessage?.viewOnce ? msg.message.videoMessage : null;
                const directAud = msg.message.audioMessage?.viewOnce ? msg.message.audioMessage : null;

                const imgMsg = voContainer?.imageMessage || directImg;
                const vidMsg = voContainer?.videoMessage || directVid;
                const audMsg = voContainer?.audioMessage || directAud;

                if (imgMsg || vidMsg || audMsg) {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    if (imgMsg) {
                        await sock.sendMessage(myJid, { image: buffer, caption: `🔓 *View Once Photo Saved (Cloud)*\nFrom: ${sender}` });
                    } else if (vidMsg) {
                        await sock.sendMessage(myJid, { video: buffer, caption: `🔓 *View Once Video Saved (Cloud)*\nFrom: ${sender}` });
                    } else if (audMsg) {
                        await sock.sendMessage(myJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                    }
                }
            } catch (err) {}
        }
    });
}

startBot();
