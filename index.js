import fs from "fs";
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  jidDecode,
  Browsers
} from "shileys";
import Pino from "pino";
import { msgHandler as initialMsgHandler } from "./handler.js";
let msgHandler = initialMsgHandler;
import "./handler.js";
import chokidar from "chokidar";
import { Messages } from "./lib/Messages.js";
import config from "./config.js";
import log from "./lib/logger.js";
import db from "./lib/database.js";
import botSettings from "./lib/botSettings.js";
import plugins from "./lib/plugins.js";
import { checkUpdate, doUpdate } from "./lib/autoUpdate.js";

// ─── Graceful shutdown ───
process.on("SIGINT", () => { db.flush(); process.exit(0); });
process.on("SIGTERM", () => { db.flush(); process.exit(0); });

// ─── Suppress verbose session output dari library ───
const _origLog = console.log;
const _origErr = console.error;
const _filter = (s) => s.includes("SessionEntry") || s.includes("Closing session") || s.includes("_chains") || s.includes("libsignal") || s.includes("preKeyId") || s.includes("session_cipher") || s.includes("Decrypted message with closed");
console.log = (...args) => { const s = args.join(" "); if (!_filter(s)) _origLog(...args); };
console.error = (...args) => { const s = args.join(" "); if (!_filter(s)) _origErr(...args); };

// ─── Banner ───
log.banner();

// ─── Auto clear session cache ───
const SESSION_DIR = "./session";
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
  if (count > 0) log.cacheClear(count);
}
clearSessionCache();
setInterval(clearSessionCache, 30 * 60 * 1000);

const logger = Pino({ level: "silent" });

async function connectToWhatsApp() {
  await plugins.load();
  const { state, saveCreds } = await useMultiFileAuthState(`./session`);
  const { version } = await fetchLatestBaileysVersion();
  const { phoneNumber, pairingCode } = config;

  log.startSpinner("Connecting to WhatsApp...");

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
        log.stopSpinner("Waiting for pairing...");
        const code = await sock.requestPairingCode(phoneNumber, pairingCode);
        log.pairingCode(code);
      } catch (err) {
        log.error(`Pairing failed: ${err.message}`);
      }
    }, 5000);
  }

  sock.ev.process(async (ev) => {
    if (ev["connection.update"]) {
      const update = ev["connection.update"];
      const { connection, lastDisconnect } = update;
      const status = lastDisconnect?.error?.output?.statusCode;

      if (connection === "close") {
        log.stopSpinner("");
        const reason = Object.entries(DisconnectReason).find((i) => i[1] === status)?.[0] || "unknown";
        log.disconnected(reason, status);

        switch (reason) {
          case "multideviceMismatch":
          case "loggedOut":
            fs.rmSync(`./session`, { recursive: true, force: true });
            break;
          default:
            if (status === 403) {
              fs.rmSync(`./session`, { recursive: true, force: true });
            } else {
              connectToWhatsApp();
            }
        }
      } else if (connection === "open") {
        log.stopSpinner("Socket ready");
        log.connected(jidDecode(sock?.user?.id)?.user);
        log.divider();
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
      }, { ephemeralExpiration: upsert?.messages[0].contextInfo?.expiration });
    }

    // ─── Welcome & Goodbye ───
    if (ev["group-participants.update"]) {
      const update = ev["group-participants.update"];
      if (!botSettings.get("welcome")) return;
      const { id, participants, action } = update;
      const groupMeta = await sock.groupMetadata(id);
      const groupName = groupMeta.subject;
      for (const p of participants) {
        // participant bisa string atau object { jid, phoneNumber }
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

// ─── Auto Update (check every 30 min) ───
const AUTO_UPDATE_INTERVAL = 30 * 60 * 1000;
setInterval(async () => {
  if (!botSettings.get("autoupdate")) return;
  try {
    const check = await checkUpdate();
    if (check.hasUpdate) {
      log.info(`Auto-update: ${check.commits.length} update ditemukan, mengupdate...`);
      const result = await doUpdate();
      log.info(`Auto-update: ${result.message.replace(/\*+/g, "")}`);
    }
  } catch (err) {
    log.error(`Auto-update check failed: ${err.message}`);
  }
}, AUTO_UPDATE_INTERVAL);

// ─── Hot reload handler ───
const watcher = chokidar.watch("./handler.js", {
  ignored: /(^|[\/\\])\../,
  persistent: true,
});

watcher.on("change", async (path) => {
  try {
    const newHandlerModule = await import(`./handler.js?cacheBust=${Date.now()}`);
    msgHandler = newHandlerModule.msgHandler;
    log.success("Handler reloaded");
  } catch (err) {
    log.error(`Handler reload failed: ${err.message}`);
  }
});
