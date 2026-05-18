// ─── Bot Worker (forked per bot instance) ───
import fs from "fs";
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  jidDecode,
  Browsers,
} from "shileys";
import Pino from "pino";
import { msgHandler as initialMsgHandler } from "./handler.js";
let msgHandler = initialMsgHandler;
import chokidar from "chokidar";
import { Messages } from "./lib/Messages.js";
import log from "./lib/logger.js";
import db from "./lib/database.js";
import botSettings from "./lib/botSettings.js";

const BOT_NAME = process.env.BOT_NAME || "bot";
const BOT_PHONE = process.env.BOT_PHONE || "";
const BOT_PAIRING = process.env.BOT_PAIRING || "";
const SESSION_DIR = process.env.BOT_SESSION_DIR || "./session";

// ─── Graceful shutdown ───
process.on("SIGINT", () => { db.flush(); process.exit(0); });
process.on("SIGTERM", () => { db.flush(); process.exit(0); });

// ─── Suppress verbose session output ───
const _origLog = console.log;
const _origErr = console.error;
const _filter = (s) => s.includes("SessionEntry") || s.includes("Closing session") || s.includes("_chains") || s.includes("libsignal") || s.includes("preKeyId") || s.includes("session_cipher") || s.includes("Decrypted message with closed");
console.log = (...args) => { const s = args.join(" "); if (!_filter(s)) _origLog(...args); };
console.error = (...args) => { const s = args.join(" "); if (!_filter(s)) _origErr(...args); };

// ─── Auto clear session cache ───
function clearSessionCache() {
  if (!fs.existsSync(SESSION_DIR)) return;
  const keep = ["creds.json", "app-state-sync"];
  const files = fs.readdirSync(SESSION_DIR);
  let count = 0;
  for (const file of files) {
    if (keep.some((k) => file.startsWith(k))) continue;
    fs.rmSync(`${SESSION_DIR}/${file}`, { force: true });
    count++;
  }
  if (count > 0) console.log(`[${BOT_NAME}] Cache cleared ${count} files`);
}
clearSessionCache();
setInterval(clearSessionCache, 30 * 60 * 1000);

async function connectToWhatsApp() {
  const logger = Pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[${BOT_NAME}] Connecting...`);

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    retryRequestDelayMs: 300,
    maxMsgRetryCount: 10,
    version,
    logger,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    browser: Browsers.ubuntu("Chrome"),
  });

  // ─── Pairing code ───
  if (!state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(BOT_PHONE, BOT_PAIRING || undefined);
        console.log(`[${BOT_NAME}] Pairing Code: ${code}`);
        if (process.send) process.send({ type: "pairing", code, name: BOT_NAME });
      } catch (err) {
        console.log(`[${BOT_NAME}] Pairing failed: ${err.message}`);
      }
    }, 5000);
  }

  sock.ev.process(async (ev) => {
    if (ev["connection.update"]) {
      const update = ev["connection.update"];
      const { connection, lastDisconnect } = update;
      const status = lastDisconnect?.error?.output?.statusCode;

      if (connection === "close") {
        const reason = Object.entries(DisconnectReason).find((i) => i[1] === status)?.[0] || "unknown";
        console.log(`[${BOT_NAME}] Disconnected: ${reason} (${status})`);
        if (process.send) process.send({ type: "disconnected", reason, code: status, name: BOT_NAME });

        switch (reason) {
          case "multideviceMismatch":
          case "loggedOut":
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            connectToWhatsApp();
            break;
          default:
            if (status === 403) {
              fs.rmSync(SESSION_DIR, { recursive: true, force: true });
              fs.mkdirSync(SESSION_DIR, { recursive: true });
              connectToWhatsApp();
            } else {
              connectToWhatsApp();
            }
        }
      } else if (connection === "open") {
        const number = jidDecode(sock?.user?.id)?.user || BOT_PHONE;
        console.log(`[${BOT_NAME}] Connected as ${number}`);
        if (process.send) process.send({ type: "connected", number, name: BOT_NAME });
      }
    }

    if (ev["creds.update"]) {
      await saveCreds();
    }

    const upsert = ev["messages.upsert"];
    if (upsert) {
      if (upsert.type !== "notify") return;
      const message = Messages(upsert, sock);
      if (message.key && message.key.remoteJid === "status@broadcast") return;
      if (message.key.fromMe) return;
      if (!message) return;
      msgHandler(upsert, sock, message);
    }

    if (ev["call"]) {
      const call = ev["call"];
      let { id, chatId, isGroup } = call[0];
      if (isGroup) return;
      await sock.rejectCall(id, chatId);
      await sock.sendMessage(chatId, {
        text: "Tidak bisa menerima panggilan suara/video.",
      });
    }

    // ─── Welcome & Goodbye ───
    if (ev["group-participants.update"]) {
      const update = ev["group-participants.update"];
      if (!botSettings.get("welcome")) return;
      const { id, participants, action } = update;
      const groupMeta = await sock.groupMetadata(id);
      const groupName = groupMeta.subject;
      for (const p of participants) {
        const jid = typeof p === "string" ? p : (p.jid || p.phoneNumber + "@s.whatsapp.net" || p);
        const num = typeof jid === "string" ? jid.split("@")[0] : String(jid);
        if (action === "add") {
          await sock.sendMessage(id, {
            text: `👋 *Selamat Datang!*\n\n@${num}\n\nSelamat bergabung di *${groupName}*! 🎉\n\nJangan lupa intro ya~`,
            mentions: [jid]
          });
        } else if (action === "remove") {
          await sock.sendMessage(id, {
            text: `👋 *Selamat Tinggal!*\n\n@${num} telah keluar dari grup.\n\nSemoga sukses selalu! 🫡`,
            mentions: [jid]
          });
        }
      }
    }
  });
}

connectToWhatsApp();

// ─── Hot reload handler ───
const watcher = chokidar.watch("./handler.js", { persistent: true });
watcher.on("change", async () => {
  try {
    const newMod = await import(`./handler.js?cacheBust=${Date.now()}`);
    msgHandler = newMod.msgHandler;
    console.log(`[${BOT_NAME}] Handler reloaded`);
  } catch (err) {
    console.log(`[${BOT_NAME}] Handler reload failed: ${err.message}`);
  }
});
