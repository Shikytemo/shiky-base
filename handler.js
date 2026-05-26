import {
  downloadMediaMessage,
  getContentType,
  urlButton,
  singleSelectButton
} from "shileys";
import moment from "moment-timezone";
import anyAscii from "any-ascii";
import Pino from "pino";

import { msgFilter } from "./lib/utils.js";
import * as scrape from "./lib/scrape/index.js";
const { catboxUpload, tiktokDl, snapDl, threadsDl, douyinDl, pinterestDl, Jawa, mlbbHero, searchLirik, ttSearch, npmstalk, igstalk, githubstalk, mediafireDl, scdl, jooxSearch, jooxDl, sfileSearch, sfileDl, capcutDl, searchMp3, appSearch, stickerSearch, ttRandom, surah, ssstik, dailyMotion, searchAppleMusic, snapinsta, fbdl2, ocrBuffer, whatMusic, nanoBanana, upscaleImage, upscaleVideo, wiki, define, kurs, currencyConvert, cuaca, googleSearch, animeInfo, movieInfo, berita, dolphinAI, editImg, ghibliAI, removeBg, qwenTTS, cekResi, nikParse, teraboxDL, ssweb, kbbiSearch, cookpadSearch, transcribe, perplexed, turboseek, bypassCity, lyricsSearch, unsplashSearch, pexelsSearch, claude3, geminiAI, megaDL, gdriveDL, scribdDL, animeQuote, getppWA, waifu2x, photoEnhancer, unblurVideo, artinama, tafsirmimpi, zodiak, nomorhoki, cekpenyakit, cocoknama, rejekiweton, gemini, deepseek, duckai, duckimg, gptoss, metaai, llama, ttdl, igdl, ytdl, fbdl, twdl, spdl, scdl2, pindl, ccdl, tebakgambar, caklontong, family100, tebakbendera, tebakkata, tebaklagu, susunkata, asahotak, cnn, cnbc, antara, kompas, liputan6, tribun, brat, blur, greyscale, invert, duck, brave, ytsearch2, ttsearch2, igsearch, ghsearch, igstalk2, ttstalk, twstalk, ghstalk2, cuaca2, bmkg, jadwaltv, ss, rwaifu, rneko, rmeme, rjoke, rquote, kv } = scrape;
import log from "./lib/logger.js";
import db from "./lib/database.js";
import { TIERS } from "./lib/database.js";
import game from "./lib/game.js";
import botSettings from "./lib/botSettings.js";
import { checkUpdate, doUpdate } from "./lib/autoUpdate.js";
import { createSticker } from "./lib/sticker.js";
import { search, download, playSong, formatSearch } from "./lib/spotify.js";

import setting from "./setting.js";
moment.tz.setDefault("Asia/Jakarta").locale("id");

// ─── Caches (TTL 5 menit) ───
const _metaCache = {};   // chatId → { data, ts }
const _blockCache = { data: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000;

async function getCachedMeta(sock, chatId) {
  const now = Date.now();
  const c = _metaCache[chatId];
  if (c && now - c.ts < CACHE_TTL) return c.data;
  const data = await sock.groupMetadata(chatId);
  _metaCache[chatId] = { data, ts: now };
  return data;
}

async function getCachedBlocklist(sock) {
  const now = Date.now();
  if (_blockCache.data && now - _blockCache.ts < CACHE_TTL) return _blockCache.data;
  const data = await sock.fetchBlocklist();
  _blockCache.data = data;
  _blockCache.ts = now;
  return data;
}

// ─── Battle UI helper ───
async function sendBattleUI(sock, m, text, prefix) {
  await sock.sendMessage(m.chat, {
    image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
    caption: text,
    footer: `⚔️ Battle | ${setting.name}`,
    interactiveButtons: [
      singleSelectButton("⚔️ Pilih Aksi", [
        {
          title: "Battle Actions",
          rows: [
            { title: "⚔️ Attack", description: "Serangan normal (80-120% ATK)", id: `${prefix}attack` },
            { title: "💥 Skill", description: "Critical hit! (130-200% ATK)", id: `${prefix}skill` },
            { title: "🛡️ Defend", description: "Bertahan, kurangi damage 70%", id: `${prefix}defend` },
            { title: "🏃 Flee", description: "Kabur (50% berhasil)", id: `${prefix}flee` },
          ]
        }
      ])
    ]
  }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
}

let msgHandler = async (upsert, sock, m) => {
  try {
    let { text } = m;
    // handle sender kosong
    if (m.sender === "") return;
    const t = m.messageTimestamp;
    const verifquoted = m.quoted ? true : false;
    const msg = verifquoted ? { message: m.quoted.message } : { message: m.message };
    let quotedMsg = m.quoted ? m.quoted : m;
    const groupMetadata = m.isGroup
    ? await getCachedMeta(sock, m.chat)
    : {};
    const isGroup = m.isGroup;
    
    // Gunakan bawaan shileys untuk handle LID & PN
    let sender;
    if (isGroup) {
      sender = m.key.addressingMode === "pn" ? m.sender : (m.key.participantAlt || m.key.participant || m.sender);
    } else {
      sender = m.key.addressingMode === "pn" ? m.sender : (m.key.remoteJidAlt || m.key.remoteJid || m.sender);
    }
    
    // Normalize JID (hapus device id spt :12)
    if (sender && sender.includes(":")) {
      sender = sender.split(":")[0] + (sender.endsWith("@lid") ? "@lid" : "@s.whatsapp.net");
    }

    // Bot group admin check
    let isBotGroupAdmins = false;
    if (isGroup) {
      const adminIds = groupMetadata.participants
        .filter(p => p.admin)
        .map(p => p.id || p.phoneNumber);
      isBotGroupAdmins = adminIds.includes(sock.user.id);
    }

    const groupName = isGroup ? groupMetadata.subject : "";
    const pushname = m.pushName || sender;
    const botNumber = sock.user.id;
    if (!sender) return
    const ownerNumber = setting.owner + "@s.whatsapp.net";

    // ─── Auto Register & Database ───
    if (!db.isRegistered(sender)) {
      db.register(sender, pushname);
    }
    const user = db.getUser(sender);
    if (user) user.name = pushname; // sync nama

    // Auto-set owner dari setting
    if (sender === ownerNumber && !db.isOwner(sender)) {
      db.setOwner(sender);
    }
    // Auto-set admin dari setting
    if (setting.admins?.length > 0) {
      for (const adm of setting.admins) {
        const admJid = adm + "@s.whatsapp.net";
        if (db.isRegistered(admJid) && !db.isAdmin(admJid)) db.setAdmin(admJid);
      }
    }

    const isOwner = db.isOwner(sender) || sender === ownerNumber;
    const isBotAdmin = db.isAdmin(sender);
    const isPremium = db.isPremium(sender);

    const groupAdmins = isGroup ? groupMetadata.participants.filter(p => p.admin).map(p => p.id) : [];
    const isAdmin = isGroup ? groupAdmins.includes(sender) : false;

    const userLimit = db.getLimit(sender);

    let budy = (typeof m.text == 'string' ? m.text : '')
    const cmd = budy || "";

    let command;
    if (cmd.startsWith(". ") || cmd.startsWith("! ") || cmd.startsWith("# ") || cmd.startsWith("/ ")) {
      const parts = cmd.toLowerCase().split(" ");
      command = parts[0] + parts[1];
    } else {
      command = cmd.toLowerCase().split(" ")[0] || "";
    }
    command = anyAscii(command).toLowerCase()
    const prefix = /^[.#!]/.test(command) ? command.match(/^[.#!]/gi) : "/"; 
    const cmdName = command.replace(/^[.#!\/]/, "");
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    let args;
    if (cmd.startsWith(". ") || cmd.startsWith("! ") || cmd.startsWith("# ") || cmd.startsWith("/ ")) {
      args = budy.trim().split(/ +/).slice(2);
    } else {
      args = budy.trim().split(/ +/).slice(1);
    }
    const string = args.slice().join(" ");
    const isCmd = budy.startsWith(prefix);
    const url = args.length !== 0 ? args[0] : "";
    const q = args.join(" ");
    const isImage = m.mtype === "image/jpeg" || m.mtype === "image/png";
    const isVideo = m.mtype === "video/mp4" || m.mtype === "image/gif";
    const isQuotedImage = quotedMsg && (quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedVideo = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/gif");
    const isQuotedVandI = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/gif" || quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedGif = quotedMsg && quotedMsg.mtype === "video/mp4";
    const isQuotedSticker = quotedMsg && quotedMsg.mtype === "image/webp";
    const isQuotedAudio = quotedMsg && (quotedMsg.mtype === "audio/mpeg" || quotedMsg.mtype === "audio/ogg; codecs=opus" || quotedMsg.mtype === "audio/mp4");
    const isQuotedAudioVn = quotedMsg && quotedMsg.mtype === "audio/mpeg";
    const isQuotedFile = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedText = quotedMsg && quotedMsg.mtype === "conversation";
    const isQuotedpdf = quotedMsg && quotedMsg.mtype === "application/pdf";
    const stickerName = setting.name;
    const stickerAuthor = "github.com/Shikytemo/shiky-base";

        if (isGroup) {
          const listBlocked = await getCachedBlocklist(sock)
        const isBlocked = listBlocked.includes(sender)
        if (isBlocked) return; 
    }

    if (isCmd && msgFilter.isFiltered(m.chat) && botSettings.get("antispam")) {
      return log.spam(command, args.length, pushname, isGroup ? groupName : "");
    }

    // Selfmode: hanya owner yang bisa pakai bot
    if (botSettings.get("selfmode") && !isOwner && sender !== ownerNumber) return;
     
    if (!isCmd) return;
    log.exec(command, args.length, pushname, isGroup ? groupName : "");
    
    if (botSettings.get("autoread")) await sock.readMessages([m.key]); // Auto read

    const reply = (text) => sock.sendMessage(m.chat, {
      text,
      footer: `© ${setting.name}`,
      interactiveButtons: [urlButton("GitHub", "https://github.com/shikytemo")]
    }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });

    // ─── Legacy Fitur (Switch) ───
  let validCmd = true;
  switch (cmdName) {
    case "menu": case "help":
      {
        const hour = moment().hour();
        let greeting = "Selamat Malam";
        if (hour >= 4 && hour < 10) greeting = "Selamat Pagi";
        else if (hour >= 10 && hour < 15) greeting = "Selamat Siang";
        else if (hour >= 15 && hour < 18) greeting = "Selamat Sore";

        const p = db.getProfile(sender);
        const tier = p ? p.tier : db.getTier(1);
        const xpBar = p ? p.xpBar : "░░░░░░░░░░";
        const maxLim = p ? (p.limit >= 99999 ? "♾️" : p.limit) : 25;
        
        const menuText = `${greeting} *${pushname}* 👋\n\n` +
          `┌─── *Player Info* ───\n` +
          `│ *ID:* ${sender.split("@")[0]}\n` +
          `│ *Name:* ${pushname}\n` +
          `│ *Role:* ${p ? p.roleDisplay : "User"}\n` +
          `│\n` +
          `│ ${tier.badge} *Tier ${tier.symbol}* - ${tier.name}\n` +
          `│ *Level:* ${p ? p.level : 1}\n` +
          `│ *XP:* ${p ? p.xp : 0}/${p ? p.xpNeeded : 50}\n` +
          `│ ${xpBar}\n` +
          `│\n` +
          `│ *Money:* $${p ? p.money.toLocaleString() : "0"}\n` +
          `│ *Limit:* ${p ? (p.limit >= 99999 ? "♾️" : p.limit) : 25}/${maxLim}\n` +
          `│ *Total Cmd:* ${p ? p.totalCmd : 0}\n` +
          `└─────────────────\n\n` +
          `_Pilih menu di bawah ini:_`;

        await sock.sendMessage(m.chat, {
          image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
          caption: menuText,
          footer: `© ${setting.name} | ${moment().format("HH:mm:ss")}`,
          interactiveButtons: [
            urlButton("🌐 GitHub", "https://github.com/Shikytemo"),
            singleSelectButton("📂 Pilih Kategori", [
              {
                title: "Menu Utama",
                rows: [
                  { title: "📋 All Commands", description: "Tampilkan semua fitur bot", id: `${prefix}allmenu` },
                  { title: "🏠 Main Menu", description: "Fitur dasar bot", id: `${prefix}listmenu main` },
                  { title: "📁 Download", description: "Video & Media Downloader", id: `${prefix}listmenu download` },
                  { title: "🛠️ Tools", description: "AI, Search & Utilitas", id: `${prefix}listmenu tools` },
                  { title: "🎮 Game & RPG", description: "Sistem Battle, Hunt & Stats", id: `${prefix}listmenu game` },
                  { title: "⚙️ Admin", description: "Pengaturan Bot & Grup", id: `${prefix}listmenu admin` }
                ]
              }
            ])
          ]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "listmenu": case "allmenu":
      {
        const LEGACY_MENU = {
          download: ["tt", "fb", "ig", "tw", "threads", "dy", "pin", "mf", "scdl", "jooxdl", "sfiledl", "capcut", "play", "spdl", "mega", "gdrive", "scribd", "terabox", "dm", "ytsearch"],
          tools: ["krama", "aksara", "sunda", "lirik", "tts", "igs", "ghstalk", "npm", "wiki", "define", "kurs", "cuaca", "google", "anime", "movie", "news", "ai", "editimg", "ghibli", "removebg", "cekresi", "nik", "ssweb", "kbbi", "resep", "transcribe", "deepsearch", "turboseek", "bypass", "unsplash", "pexels", "claude", "gemini", "ppwa", "waifu2x", "enhance", "ocr", "whatmusic", "hd", "vhd", "unblur", "nano"],
          game: ["battle", "hunt", "heal", "shop", "inv", "lb", "daily", "bal", "transfer", "level", "tier"],
          admin: ["kick", "add", "promote", "demote", "tagall", "hidetag", "addpremium", "addmoney", "addlimit", "setlevel"],
          main: ["ping", "say", "cekidch", "idgc", "tourl", "resend", "stats", "cekupdate"]
        };

        if (cmdName === "allmenu") {
          let text = `📋 *ALL COMMANDS*\n\n`;
          for (const cat in LEGACY_MENU) {
            text += `┌─── *${cat.toUpperCase()}* ───\n`;
            for (const cmd of LEGACY_MENU[cat]) {
              text += `│ • ${prefix}${cmd}\n`;
            }
            text += `└─────────────────\n\n`;
          }
          return reply(text.trim());
        }

        const cat = args[0]?.toLowerCase();
        if (!cat) return reply("Pilih kategori!");
        const cmdInLegacy = LEGACY_MENU[cat] || [];
        if (!cmdInLegacy.length) return reply("Kategori tidak ditemukan!");

        const rows = cmdInLegacy.map(cmd => ({
          title: `${prefix}${cmd}`,
          description: `Gunakan perintah ${cmd}`,
          id: `${prefix}${cmd}`
        }));

        await sock.sendMessage(m.chat, {
          text: `📂 *CATEGORY: ${cat.toUpperCase()}*\n\nSilakan pilih perintah di bawah ini:`,
          footer: `© ${setting.name}`,
          interactiveButtons: [
            singleSelectButton("🚀 Pilih Perintah", [
              { title: cat.toUpperCase(), rows }
            ])
          ]
        }, { quoted: m });
      }
      break;

    case "ping": case "test": case "tes":
      {
        const latency = Date.now() - t * 1000;
        const uptime = process.uptime();
        const d = Math.floor(uptime / 86400);
        const h = Math.floor((uptime % 86400) / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);
        const uptimeStr = `${d}d ${h}h ${m}m ${s}s`;
        
        const mem = process.memoryUsage();
        const memMB = (mem.rss / 1024 / 1024).toFixed(1);
        const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
        const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
        
        const stats = db.getStats();
        const nodeVer = process.version;
        const plat = process.platform;
        const arch = process.arch;
        
        // API command count (functions from api/index.js)
        const apiFns = ['artinama','tafsirmimpi','zodiak','nomorhoki','cekpenyakit','cocoknama','rejekiweton','gemini','deepseek','duckai','duckimg','gptoss','metaai','llama','ttdl','igdl','ytdl','fbdl','twdl','spdl','scdl2','pindl','ccdl','tebakgambar','caklontong','family100','tebakbendera','tebakkata','tebaklagu','susunkata','asahotak','cnn','cnbc','antara','kompas','liputan6','tribun','brat','blur','greyscale','invert','duck','brave','ytsearch2','ttsearch2','igsearch','ghsearch','igstalk2','ttstalk','twstalk','ghstalk2','cuaca2','bmkg','jadwaltv','ss','rwaifu','rneko','rmeme','rjoke','rquote'];
        const apiTotal = apiFns.filter(f => typeof scrape[f] === 'function').length;
        
        const txt = `\`\`\`ansi
[1;36m     ╔══════════════════════════════╗
     ║     🚀 SHIKYTEMO BOT       ║
     ╚══════════════════════════════╝[0m

[1;33m  ╭─── Bot Info ─────────────────╮[0m
  │ [1;37mName    [0m │ [1;32m${setting.name}[0m
  │ [1;37mVersion [0m │ [1;32mv3.1.0[0m
  │ [1;37mUptime  [0m │ [1;32m${uptimeStr}[0m
  │ [1;37mPing    [0m │ [1;32m${latency} ms[0m
  [1;33m  ╰──────────────────────────────╯[0m

  [1;34m  ╭─── System ───────────────────╮[0m
  │ [1;37mNode.js [0m │ [1;32m${nodeVer}[0m
  │ [1;37mOS      [0m │ [1;32m${plat} ${arch}[0m
  │ [1;37mRAM     [0m │ [1;32m${memMB} MB[0m
  │ [1;37mHeap    [0m │ [1;32m${heapMB} / ${heapTotal} MB[0m
  [1;34m  ╰──────────────────────────────╯[0m

  [1;35m  ╭─── Database ─────────────────╮[0m
  │ [1;37mUsers   [0m │ [1;32m${stats.total}[0m
  │ [1;37mPremium [0m │ [1;32m${stats.premium}[0m
  │ [1;37mAdmins  [0m │ [1;32m${stats.admins}[0m
  │ [1;37mTop LVL [0m │ [1;32m${stats.topLevel}[0m
  │ [1;37mTotal XP[0m │ [1;32m${stats.totalXp.toLocaleString()}[0m
  │ [1;37mGold    [0m │ [1;32m${stats.totalMoney.toLocaleString()} 💰[0m
  [1;35m  ╰──────────────────────────────╯[0m

  [1;36m  ╭─── API ──────────────────────╮[0m
  │ [1;37mCommands[0m │ [1;32m${apiTotal} ready[0m
  │ [1;37mStatus  [0m │ [1;32m✅ Online[0m
  [1;36m  ╰──────────────────────────────╯[0m

[0;90m© ${setting.name} · github.com/Shikytemo[0m
\`\`\``;
        
        await sock.sendMessage(m.chat, { text: txt }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "s": case "stiker": case "sticker":
      if (!isImage && !isVideo && !isQuotedImage && !isQuotedVideo) 
        return reply("📸 Kirim atau reply foto/video untuk dijadikan stiker!");
      try {
        await m.react("⏳");
        const mediaMsg = isQuotedImage || isQuotedVideo ? { message: m.quoted.message } : { message: m.message };
        const buffer = await downloadMediaMessage(mediaMsg, "buffer", {}, { Pino, reuploadRequest: sock.updateMediaMessage });
        const type = (isVideo || isQuotedVideo) ? "video" : "image";
        const sticker = await createSticker(buffer, type);
        await sock.sendMessage(m.chat, { sticker }, { quoted: m });
        await m.react("✅");
      } catch (err) {
        await m.react("❌");
        reply(`❌ *Gagal membuat stiker!* ${err.message}`);
      }
      break;

    case "set": case "setting":
      {
        if (!isOwner) return reply("👑 *Khusus Owner!*");
        const key = args[0]?.toLowerCase();
        const all = botSettings.getAll();
        if (key === "reset") {
          botSettings.reset();
          return reply("🔄 *Settings di-reset ke default!*");
        }
        if (key) {
          const valid = Object.keys(all);
          if (!valid.includes(key)) return reply(`❌ Key tidak valid!\n\nValid: ${valid.join(", ")}`);
          const newVal = botSettings.toggle(key);
          const labels = { autoread: "Auto Read", autotyping: "Auto Typing", antispam: "Anti Spam", gamemode: "Game Mode", welcome: "Welcome Message", selfmode: "Self Mode", autoupdate: "Auto Update" };
          return reply(`⚙️ *${labels[key] || key}* → ${newVal ? "🟢 ON" : "🔴 OFF"}`);
        }
        const icons = { true: "🟢", false: "🔴" };
        const rows = [
          { title: `${icons[all.autoread]} Auto Read`, description: "Membaca pesan otomatis", id: `${prefix}set autoread` },
          { title: `${icons[all.autotyping]} Auto Typing`, description: "Menampilkan status mengetik", id: `${prefix}set autotyping` },
          { title: `${icons[all.antispam]} Anti Spam`, description: "Mencegah spam command", id: `${prefix}set antispam` },
          { title: `${icons[all.gamemode]} Game Mode`, description: "Battle & hunt features", id: `${prefix}set gamemode` },
          { title: `${icons[all.welcome]} Welcome`, description: "Welcome new members", id: `${prefix}set welcome` },
          { title: `${icons[all.selfmode]} Self Mode`, description: "Hanya owner yang bisa pakai", id: `${prefix}set selfmode` },
          { title: `${icons[all.autoupdate]} Auto Update`, description: "Auto update dari GitHub", id: `${prefix}set autoupdate` },
          { title: "🔄 Reset All", description: "Kembalikan ke default", id: `${prefix}set reset` },
        ];
        await sock.sendMessage(m.chat, {
          text: "⚙️ *BOT SETTINGS*\n\nSilakan pilih opsi di bawah untuk mengubah konfigurasi bot.",
          footer: `© ${setting.name}`,
          interactiveButtons: [
            singleSelectButton("⚙️ Configure", [{ title: "Settings", rows }])
          ]
        }, { quoted: m });
      }
      break;

    case "cekupdate": case "checkupdate":
      {
        if (!isOwner && sender !== ownerNumber) return reply("👑 *Khusus Owner!*");
        await reply("🔍 Cek update dari GitHub...");
        const check = await checkUpdate();
        if (check.error) {
          await reply(`❌ *Gagal cek update*\n\n${check.error}`);
        } else if (!check.hasUpdate) {
          await reply("✅ *Bot sudah versi terbaru!*\n\nTidak ada update yang tersedia.");
        } else {
          const commitList = check.commits.map(c => `  • ${c}`).join("\n");
          const fileList = check.changedFiles.slice(0, 10).join(", ") + (check.changedFiles.length > 10 ? "..." : "");
          await reply(`🔄 *Update tersedia!*\n\n📝 *${check.commits.length} commit baru:*\n${commitList}\n\n📁 *File berubah:* ${fileList}\n\nKetik *.update* untuk mengupdate bot.`);
        }
      }
      break;

    case "update":
      {
        if (!isOwner && sender !== ownerNumber) return reply("👑 *Khusus Owner!*");
        await reply("⏳ Mengupdate bot dari GitHub...");
        const result = await doUpdate();
        await reply(result.message);
      }
      break;
      case "say":
    if (!q) return reply("📝 Masukkan teks!");
    await reply(`💬 ${q}`);
    break;
    case "cekidch": case "idch": case "checkidch":
      {
        const chatId = m.chat.split("@")[0];
        const isChannel = m.chat.endsWith("@newsletter");
        const buttons = isChannel
          ? [urlButton("🔗 Channel", `https://whatsapp.com/channel/${chatId}`)]
          : [urlButton("GitHub", "https://github.com/shikytemo")];
        await sock.sendMessage(m.chat, {
          text: `📢 *ID Chat*\n\n\`\`\`${chatId}\`\`\``,
          footer: `© ${setting.name}`,
          interactiveButtons: buttons
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;
    case "cekidgc": case "idgc": case "checkidgc":
      if (!isGroup) return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      {
        const groupId = m.chat.split("@")[0];
        await sock.sendMessage(m.chat, {
          text: `👥 *ID Group*\n\n\`\`\`${groupId}\`\`\``,
          footer: `© ${setting.name}`,
          interactiveButtons: [urlButton("GitHub", "https://github.com/shikytemo")]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;
    case "tourl":
      if ((isImage || isQuotedImage) || (isVideo || isQuotedVideo) || isQuotedSticker || isQuotedAudio || isQuotedpdf) {
        try {
          await m.react("⏳");
          const dl = await downloadMediaMessage(msg, "buffer", {}, { Pino, reuploadRequest: sock.updateMediaMessage });
          const buffer = Buffer.isBuffer(dl) ? dl : Buffer.from(dl);
          const hex = buffer.slice(0, 8).toString("hex");

          const ext = hex.startsWith("ffd8ff") ? "jpg"
            : hex.startsWith("89504e47") ? "png"
            : hex.startsWith("52494646") && buffer.slice(8, 12).toString("ascii") === "WEBP" ? "webp"
            : hex.startsWith("47494638") ? "gif"
            : hex.includes("66747970") ? "mp4"
            : hex.startsWith("1a45dfa3") ? "webm"
            : hex.startsWith("49443303") || hex.startsWith("fffb") || hex.startsWith("fff3") ? "mp3"
            : hex.startsWith("4f676753") ? "ogg"
            : hex.startsWith("25504446") ? "pdf"
            : "bin";
          const link = await catboxUpload(buffer, `file.${ext}`);
          await reply(`✅ *Upload berhasil!*\n\n${link}`);
          await m.react("✅");
        } catch (err) {
          console.log(err);
          await m.react("❌");
          reply("❌ *Gagal upload ke catbox!*");
        }
      } else {
        reply("📎 Reply/kirim gambar, video, sticker, audio, atau dokumen!");
      }
      break;
        case "resend":
        if ((isImage || isQuotedImage) || (isVideo || isQuotedVideo)) {
          const type = Object.keys(quotedMsg.message || quotedMsg)[0];
            try {
          const buffer = await downloadMediaMessage(msg, "buffer", {}, { Pino, reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(
            m.chat,
            { [type.includes("image") ? "image" : "video"]: buffer, caption: "✅ *Resend Success*" },
            { quoted: m, ephemeralExpiration: m.contextInfo.expiration }
          );
          } catch (err) {
            console.log(err);
            reply("❌ *Ada yang error!*");
          }
        } else {
          reply(`📸 Reply gambar atau video yang ingin diresend`);
        }
        break;
    case "tt": case "tiktok": case "ttdl":
      if (!q) return reply("🔗 Masukkan link TikTok!\n\nContoh: .tt https://vt.tiktok.com/xxx");
      try {
        await m.react("⏳");
        const tt = await tiktokDl(q);

        const cap = `🎵 *TikTok Downloader*\n\n` +
          `📌 *Title:* ${tt.title || '-'}\n` +
          `👤 *Author:* ${tt.author.name} (@${tt.author.username})\n` +
          `▶️ ${tt.stats.play?.toLocaleString()} | ❤️ ${tt.stats.like?.toLocaleString()} | 💬 ${tt.stats.comment?.toLocaleString()} | 🔗 ${tt.stats.share?.toLocaleString()}\n\n` +
          `© ${setting.name}`;

        const ttButtons = [
          urlButton("🔗 Original", q),
          urlButton("GitHub", "https://github.com/shikytemo"),
          singleSelectButton("📥 Download Lainnya", [
            {
              title: "Opsi Download",
              rows: [
                { title: "🎵 Sound Only", description: "Download audio/musik saja", id: `${prefix}ttsound ${q}` },
                { title: "🎬 Video (Watermark)", description: "Download video dengan watermark", id: `${prefix}ttwm ${q}` }
              ]
            }
          ])
        ];

        if (tt.type === "video") {
          await sock.sendMessage(m.chat, {
            video: { url: tt.video.noWm },
            caption: cap,
            footer: `© ${setting.name}`,
            interactiveButtons: ttButtons
          }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        } else {
          // Slide/carousel - kirim semua foto
          for (let i = 0; i < tt.images.length; i++) {
            await sock.sendMessage(m.chat, {
              image: { url: tt.images[i] },
              caption: i === 0 ? cap : "",
              ...(i === 0 ? { footer: `© ${setting.name}`, interactiveButtons: ttButtons } : {})
            }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          }
        }

        // Kirim audio/sound
        if (tt.music.url) {
          await sock.sendMessage(m.chat, {
            audio: { url: tt.music.url },
            mimetype: "audio/mpeg"
          }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        }

        await m.react("✅");
      } catch (err) {
        console.log(err);
        await m.react("❌");
      }
      break;
    case "ttwm":
      if (!q) return reply("🔗 Masukkan link TikTok!");
      try {
        await m.react("⏳");
        const ttw = await tiktokDl(q);
        if (!ttw.video.withWm) {
          await m.react("❌");
          return reply("❌ *Video watermark tidak tersedia!*");
        }
        await sock.sendMessage(m.chat, {
          video: { url: ttw.video.withWm },
          caption: `🎬 *TikTok (Watermark)*\n\n📌 ${ttw.title || '-'}\n👤 ${ttw.author.name}\n\n© ${setting.name}`,
          footer: `© ${setting.name}`,
          interactiveButtons: [
            urlButton("🔗 Original", q),
            urlButton("GitHub", "https://github.com/shikytemo")
          ]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await m.react("✅");
      } catch (err) {
        console.log(err);
        await m.react("❌");
        reply("❌ *Gagal download video TikTok WM!*");
      }
      break;

    case "ttsound": case "ttaudio":
      if (!q) return reply("🔗 Masukkan link TikTok!");
      try {
        await m.react("⏳");
        const tt2 = await tiktokDl(q);
        if (!tt2.music?.url) {
          await m.react("❌");
          return reply("❌ *Audio tidak ditemukan!*");
        }
        await sock.sendMessage(m.chat, {
          audio: { url: tt2.music.url },
          mimetype: "audio/mpeg"
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await m.react("✅");
      } catch (err) {
        console.log(err);
        await m.react("❌");
        reply("❌ *Gagal download audio TikTok!*");
      }
      break;

    case "fb": case "facebook": case "fbdl":
    case "ig": case "instagram": case "igdl":
    case "tw": case "twitter": case "twdl":
      {
        const platformMap = { fb: "Facebook", facebook: "Facebook", fbdl: "Facebook", ig: "Instagram", instagram: "Instagram", igdl: "Instagram", tw: "Twitter", twitter: "Twitter", twdl: "Twitter" };
        const platName = platformMap[cmdName] || "Media";

        if (!q) return reply(`🔗 Masukkan link ${platName}!\n\nContoh: ${command} https://...`);
        try {
          await m.react("⏳");
          const snap = await snapDl(q);

          const desc = snap.description
            ? snap.description.substring(0, 200) + (snap.description.length > 200 ? "..." : "")
            : "-";
          const cap = `📥 *${platName} Downloader*\n\n📌 *Deskripsi:* ${desc}\n📎 *Media:* ${snap.media.length} file\n\n© ${setting.name}`;

          const snapButtons = [
            urlButton("🔗 Original", q),
            urlButton("GitHub", "https://github.com/shikytemo")
          ];

          if (snap.media.length === 0) {
            await m.react("❌");
            return reply("❌ *Media tidak ditemukan!*");
          }

          for (let i = 0; i < snap.media.length; i++) {
            const item = snap.media[i];
            if (item.type === "video") {
              await sock.sendMessage(m.chat, {
                video: { url: item.url },
                caption: i === 0 ? cap : `📹 Video ${i + 1}${item.resolution ? ` (${item.resolution})` : ""}`,
                ...(i === 0 ? { footer: `© ${setting.name}`, interactiveButtons: snapButtons } : {})
              }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
            } else {
              await sock.sendMessage(m.chat, {
                image: { url: item.url },
                caption: i === 0 ? cap : `🖼️ Foto ${i + 1}`,
                ...(i === 0 ? { footer: `© ${setting.name}`, interactiveButtons: snapButtons } : {})
              }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
            }
          }

          await m.react("✅");
        } catch (err) {
          console.log(err);
          await m.react("❌");
          reply(`❌ *Gagal download dari ${platName}!*`);
        }
      }
      break;

    case "threads": case "threaddl":
      if (!q) return reply("🔗 Masukkan link Threads!\n\nContoh: .threads https://www.threads.net/...");
      try {
        await m.react("⏳");
        const result = await threadsDl(q);
        if (!result.success) return reply(`❌ *Gagal!* ${result.error}`);
        if (result.thumbnail) {
          await sock.sendMessage(m.chat, { image: { url: result.thumbnail }, caption: `🧵 *Threads Downloader*\n\n© ${setting.name}` }, { quoted: m });
        } else {
          reply("❌ Media tidak ditemukan!");
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download Threads!*"); }
      break;

    case "douyin": case "dy":
      if (!q) return reply("🔗 Masukkan link Douyin!\n\nContoh: .douyin https://v.douyin.com/...");
      try {
        await m.react("⏳");
        const result = await douyinDl(q);
        if (!result.success) return reply(`❌ *Gagal!* ${result.error}`);
        const media = result.video || result.url || result.media;
        const title = result.title || result.desc || result.description || '';
        if (media) {
          await sock.sendMessage(m.chat, {
            video: { url: media },
            caption: `📥 *Douyin Downloader*\n${title ? `📌 ${title}\n` : ''}\n© ${setting.name}`
          }, { quoted: m });
        } else {
          reply(`📥 *Douyin Downloader*\n\n${title ? `📌 ${title}` : '✅ Download berhasil'}\n\n© ${setting.name}`);
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download Douyin!*"); }
      break;

    case "pin": case "pinterest":
      if (!q) return reply("🔗 Masukkan link Pinterest!\n\nContoh: .pin https://pin.it/...");
      try {
        await m.react("⏳");
        const result = await pinterestDl(q);
        if (!result.success) return reply(`❌ *Gagal!* ${result.error}`);
        if (result.type === "video") {
          await sock.sendMessage(m.chat, { video: { url: result.media }, caption: `📌 *${result.title}*\n👤 ${result.author}\n\n© ${setting.name}` }, { quoted: m });
        } else if (result.media) {
          await sock.sendMessage(m.chat, { image: { url: result.media }, caption: `📌 *${result.title}*\n👤 ${result.author}\n\n© ${setting.name}` }, { quoted: m });
        } else { reply("❌ Media tidak ditemukan!"); }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download Pinterest!*"); }
      break;

    case "krama": case "lugu": case "ngoko":
      {
        if (!q) return reply(`📝 Masukkan teks!\nContoh: .${cmdName} aku sayang kamu`);
        const toMap = { krama: "krama-alus", lugu: "krama-lugu", ngoko: "ngoko" };
        try {
          const result = await Jawa.translate(q, { to: toMap[cmdName] });
          reply(`🔤 *${cmdName.toUpperCase()}*\n\n${result}`);
        } catch (e) { reply(`❌ ${e.message}`); }
      }
      break;

    case "aksara":
      if (!q) return reply("📝 Masukkan teks!\nContoh: .aksara aku cinta kamu");
      try {
        const result = await Jawa.aksara(q);
        reply(`🔤 *AKSARA JAWA*\n\n${result}`);
      } catch (e) { reply(`❌ ${e.message}`); }
      break;

    case "sunda":
      if (!q) return reply("📝 Masukkan teks!\nContoh: .sunda aku sayang kamu");
      try {
        const result = await Jawa.sunda(q);
        reply(`🔤 *SUNDA*\n\n${result}`);
      } catch (e) { reply(`❌ ${e.message}`); }
      break;

    case "mlbb": case "ml":
      if (!q) return reply("👾 Masukkan nama hero!\nContoh: .mlbb Yi Sun-Shin");
      try {
        await m.react("⏳");
        const result = await mlbbHero(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `👾 *MLBB HERO: ${result.hero}*\n\n`;
        for (const [k, v] of Object.entries(result.information)) txt += `• *${k}:* ${v}\n`;
        if (result.skills.passive) txt += `\n🔹 *Passive:* ${result.skills.passive.name}\n${result.skills.passive.description}\n`;
        if (result.skills.skill1) txt += `\n🔹 *Skill 1:* ${result.skills.skill1.name}\n${result.skills.skill1.description}\n`;
        if (result.skills.ultimate) txt += `\n🔹 *Ultimate:* ${result.skills.ultimate.name}\n${result.skills.ultimate.description}\n`;
        await sock.sendMessage(m.chat, { image: { url: result.image || "https://files.catbox.moe/7jmjhh.jpeg" }, caption: txt }, { quoted: m });
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal cari hero!*"); }
      break;

    case "lirik": case "lyrics":
      if (!q) return reply("🎵 Masukkan judul lagu!\nContoh: .lirik night changes");
      try {
        await m.react("⏳");
        const result = await searchLirik(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        const cap = `🎵 *${result.title}*\n\n${result.lyrics || "Lirik tidak ditemukan"}`;
        if (result.thumbnail) {
          await sock.sendMessage(m.chat, { image: { url: result.thumbnail }, caption: cap }, { quoted: m });
        } else { reply(cap); }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal cari lirik!*"); }
      break;

    case "ttsearch": case "tts":
      if (!q) return reply("🔍 Masukkan kata kunci!\nContoh: .ttsearch dance");
      try {
        await m.react("⏳");
        const result = await ttSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🔍 *TikTok Search: ${q}*\n\n`;
        result.videos.slice(0, 5).forEach((v, i) => {
          txt += `*${i + 1}.* ${v.title || "No title"}\n👤 ${v.author?.nickname || "-"} | ▶️ ${v.play_count || 0}\n🔗 https://vt.tiktok.com/${v.video_id || ""}\n\n`;
        });
        reply(txt);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal cari TikTok!*"); }
      break;

    case "npmstalk": case "npm":
      if (!q) return reply("📦 Masukkan nama package!\nContoh: .npm shileys");
      try {
        const result = await npmstalk(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📦 *NPM: ${result.name}*\n\n`;
        txt += `📝 ${result.description}\n`;
        txt += `🔢 Latest: v${result.versionLatest}\n`;
        txt += `📊 Versions: ${result.versionCount}\n`;
        txt += `📅 Created: ${new Date(result.created).toLocaleDateString("id-ID")}\n`;
        txt += `🔗 https://npmjs.com/package/${result.name}`;
        reply(txt);
      } catch (err) { reply("❌ *Gagal stalk NPM!*"); }
      break;

    case "igstalk": case "igs":
      if (!q) return reply("📷 Masukkan username IG!\nContoh: .igstalk cristiano");
      try {
        const result = await igstalk(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📷 *IG Stalk*\n\n`;
        txt += `👤 ${result.fullname} (@${result.username})\n`;
        txt += `📝 ${result.bio}\n`;
        txt += `📌 Posts: ${result.posts} | Followers: ${result.followers} | Following: ${result.following}`;
        if (result.profile) {
          await sock.sendMessage(m.chat, { image: { url: result.profile }, caption: txt }, { quoted: m });
        } else { reply(txt); }
      } catch (err) { reply("❌ *Gagal stalk IG!*"); }
      break;

    case "ghstalk": case "github":
      if (!q) return reply("🐙 Masukkan username GitHub!\nContoh: .github shikytemo");
      try {
        const result = await githubstalk(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🐙 *GitHub: ${result.username}*\n\n`;
        txt += `👤 ${result.nickname || "-"}\n`;
        if (result.bio) txt += `📝 ${result.bio}\n`;
        if (result.company) txt += `🏢 ${result.company}\n`;
        if (result.location) txt += `📍 ${result.location}\n`;
        txt += `📦 Repos: ${result.public_repos} | Followers: ${result.followers} | Following: ${result.following}\n`;
        txt += `🔗 ${result.url}`;
        if (result.profile_pic) {
          await sock.sendMessage(m.chat, { image: { url: result.profile_pic }, caption: txt }, { quoted: m });
        } else { reply(txt); }
      } catch (err) { reply("❌ *Gagal stalk GitHub!*"); }
      break;

    case "mediafire": case "mf":
      if (!q) return reply("🔗 Masukkan link Mediafire!\nContoh: .mediafire https://www.mediafire.com/...");
      try {
        await m.react("⏳");
        const result = await mediafireDl(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        reply(`📁 *Mediafire*\n\n📄 ${result.filename}\n📦 ${result.size}\n🔗 ${result.download}`);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download!*"); }
      break;

    case "scdl": case "soundcloud":
      if (!q) return reply("🔗 Masukkan link SoundCloud!\nContoh: .scdl https://soundcloud.com/...");
      try {
        await m.react("⏳");
        const result = await scdl(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        if (result.thumb) {
          await sock.sendMessage(m.chat, {
            image: { url: result.thumb },
            caption: `🎧 *SoundCloud*\n\n🎵 ${result.title}\n🔗 ${result.download}`
          }, { quoted: m });
        } else {
          reply(`🎧 *SoundCloud*\n\n🎵 ${result.title}\n🔗 ${result.download}`);
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download SoundCloud!*"); }
      break;

    case "joox": case "jooxsearch":
      if (!q) return reply("🎵 Masukkan judul lagu!\nContoh: .joox mantra hujan");
      try {
        const result = await jooxSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🎵 *Joox Search: ${q}*\n\n`;
        result.data.slice(0, 5).forEach((s, i) => {
          txt += `*${i + 1}.* ${s.title}\n👤 ${s.artist} | 💿 ${s.album}\n🔗 ID: ${s.id}\n\n`;
        });
        txt += `_Gunakan .jooxdl <id> untuk download_`;
        reply(txt);
      } catch (err) { reply("❌ *Gagal cari Joox!*"); }
      break;

    case "jooxdl":
      if (!q) return reply("🎵 Masukkan ID lagu Joox!\nContoh: .jooxdl 123456");
      try {
        await m.react("⏳");
        const result = await jooxDl(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        await sock.sendMessage(m.chat, {
          image: { url: result.img }, caption: `🎵 ${result.title}\n👤 ${result.artist}\n💿 ${result.album}`
        }, { quoted: m });
        if (result.mp3) {
          await sock.sendMessage(m.chat, { audio: { url: result.mp3 }, mimetype: "audio/mpeg" }, { quoted: m });
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download Joox!*"); }
      break;

    case "sfile": case "sfilesearch":
      if (!q) return reply("🔍 Masukkan kata kunci!\nContoh: .sfile javascript");
      try {
        const result = await sfileSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📁 *Sfile Search: ${q}*\n\n`;
        result.data.slice(0, 5).forEach((f, i) => {
          txt += `*${i + 1}.* ${f.title}\n📦 ${f.size}\n\n`;
        });
        txt += `_Gunakan .sfiledl <link> untuk download_`;
        reply(txt);
      } catch (err) { reply("❌ *Gagal cari Sfile!*"); }
      break;

    case "sfiledl":
      if (!q) return reply("🔗 Masukkan link Sfile!\nContoh: .sfiledl https://sfile.mobi/...");
      try {
        const result = await sfileDl(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        reply(`📁 *Sfile DL*\n\n📄 ${result.filename}\n📦 ${result.filesize}\n📎 ${result.mimetype}\n🔗 ${result.download}`);
      } catch (err) { reply("❌ *Gagal download Sfile!*"); }
      break;

    case "capcut": case "capcutdl":
      if (!q) return reply("🔗 Masukkan link CapCut!\nContoh: .capcut https://www.capcut.com/...");
      try {
        await m.react("⏳");
        const result = await capcutDl(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        reply(`🎬 *CapCut*\n\n📌 ${result.title}\n📝 ${result.desc}\n🔗 ${result.video}`);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download CapCut!*"); }
      break;

    case "mp3": case "searchmp3":
      if (!q) return reply("🎵 Masukkan judul lagu!\nContoh: .mp3 mantra hujan");
      try {
        const result = await searchMp3(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🎵 *MP3 Search: ${q}*\n\n`;
        result.data.slice(0, 5).forEach((m, i) => {
          txt += `*${i + 1}.* ${m.title}\n🔗 ${m.url}\n\n`;
        });
        reply(txt);
      } catch (err) { reply("❌ *Gagal cari MP3!*"); }
      break;

    case "apk": case "appsearch":
      if (!q) return reply("📱 Masukkan nama aplikasi!\nContoh: .apk minecraft");
      try {
        const result = await appSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📱 *App Search: ${q}*\n\n`;
        result.data.slice(0, 5).forEach((a, i) => {
          txt += `*${i + 1}.* ${a.title}\n📝 ${a.menu}\n🔗 ${a.link}\n\n`;
        });
        reply(txt);
      } catch (err) { reply("❌ *Gagal cari aplikasi!*"); }
      break;

    case "stikersearch": case "ss":
      if (!q) return reply("🔍 Masukkan kata kunci!\nContoh: .ss anime");
      try {
        const result = await stickerSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🎨 *Sticker: ${result.title}*\n👤 ${result.author}\n\n`;
        result.stickers.slice(0, 5).forEach(s => {
          txt += `🖼️ ${s}\n`;
        });
        reply(txt);
      } catch (err) { reply("❌ *Gagal cari stiker!*"); }
      break;

    case "ttrandom": case "ttr":
      if (!q) return reply("🔍 Masukkan kata kunci!\nContoh: .ttr dance");
      try {
        await m.react("⏳");
        const result = await ttRandom(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        await sock.sendMessage(m.chat, {
          video: { url: result.no_watermark },
          caption: `🎲 *Random TikTok*\n\n📌 ${result.title}`
        }, { quoted: m });
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal random TikTok!*"); }
      break;

    case "surah":
      if (!q) return reply("📖 Masukkan nomor surah!\nContoh: .surah 1");
      try {
        const result = await surah(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📖 *Surah ${q}*\n\n`;
        result.data.forEach((a) => { txt += `${a.arab}\n${a.latin}\n_${a.indo}_\n\n`; });
        reply(txt);
      } catch (err) { reply("❌ *Gagal mengambil surah!*"); }
      break;

    case "ssstik":
      if (!q) return reply("🔗 Masukkan link TikTok!\nContoh: .ssstik https://vt.tiktok.com/...");
      try {
        await m.react("⏳");
        const result = await ssstik(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        if (result.type === "image" && result.images) {
          for (const img of result.images) {
            await sock.sendMessage(m.chat, { image: { url: img } }, { quoted: m });
          }
        } else if (result.video) {
          await sock.sendMessage(m.chat, { video: { url: result.video.no_watermark || result.video.hd }, caption: `🎵 ${result.author || ""}` }, { quoted: m });
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download!*"); }
      break;

    case "dailymotion": case "dm":
      if (!q) return reply("🔗 Masukkan link DailyMotion!\nContoh: .dm https://dailymotion.com/...");
      try {
        await m.react("⏳");
        const result = await dailyMotion(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        if (result.medias?.[0]?.url) {
          await sock.sendMessage(m.chat, { video: { url: result.medias[0].url }, caption: result.title || "" }, { quoted: m });
        } else { reply("❌ *Media tidak ditemukan!*"); }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download!*"); }
      break;

    case "applemusic": case "am":
      if (!q) return reply("🎵 Masukkan judul lagu!\nContoh: .am jadian yuk");
      try {
        const result = await searchAppleMusic(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🍎 *Apple Music: ${q}*\n\n`;
        result.data.slice(0, 5).forEach((s, i) => {
          txt += `*${i + 1}.* ${s.title}\n🔗 ${s.url}\n\n`;
        });
        reply(txt);
      } catch (err) { reply("❌ *Gagal cari!*"); }
      break;

    case "snapinsta": case "igdl2":
      if (!q) return reply("🔗 Masukkan link Instagram!\nContoh: .snapinsta https://instagram.com/...");
      try {
        await m.react("⏳");
        const result = await snapinsta(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        for (const dl of result.downloads) {
          await sock.sendMessage(m.chat, { video: { url: dl } }, { quoted: m });
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download!*"); }
      break;

    case "fbdl2":
      if (!q) return reply("🔗 Masukkan link Facebook!\nContoh: .fbdl2 https://fb.com/...");
      try {
        await m.react("⏳");
        const result = await fbdl2(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        if (result.download) {
          await sock.sendMessage(m.chat, { video: { url: result.download }, caption: "📘 Facebook DL" }, { quoted: m });
        } else { reply("❌ Video tidak ditemukan!"); }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal download!*"); }
      break;

    case "ocr":
      {
        if (!isImage && !isQuotedImage) return reply("📸 Kirim atau reply gambar untuk OCR!");
        try {
          await m.react("⏳");
          const qimg = m.quoted || m;
          const buffer = await qimg.download();
          const result = await ocrBuffer(buffer);
          if (!result.success) return reply(`❌ ${result.error}`);
          reply(`📝 *OCR Result*\n\n${result.text}`);
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply("❌ *Gagal OCR!*"); }
      }
      break;

    case "whatmusic":
      {
        if (!isQuotedAudio && !isQuotedAudioVn) return reply("🎵 Reply audio/voice note untuk cari judul lagu!");
        try {
          await m.react("⏳");
          const qa = m.quoted || m;
          const buffer = await qa.download();
          const result = await whatMusic(buffer);
          if (!result.success) return reply(`❌ ${result.error}`);
          reply(`🎵 *${result.title}*\n👤 ${result.artists}`);
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply("❌ *Gagal identifikasi!*"); }
      }
      break;

    case "remini": case "hd2": case "upscale": case "hd":
      {
        if (!isImage && !isQuotedImage) return reply("📸 Kirim atau reply gambar untuk enhance!");
        try {
          await m.react("⏳");
          const qimg = m.quoted || m;
          const buffer = await qimg.download();
          const upResult = await upscaleImage(buffer);
          if (!upResult.success) return reply("❌ *Gagal enhance! Semua provider gagal.*");
          await sock.sendMessage(m.chat, { image: upResult.buffer, caption: "✨ *Enhanced*" }, { quoted: m });
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal enhance!* ${err.message}`); }
      }
      break;

    case "videohd": case "vhd": case "videoupscale":
      {
        if (!isVideo && !isQuotedVideo) return reply("🎬 Kirim atau reply video untuk enhance!");
        try {
          await m.react("⏳");
          const qvid = m.quoted || m;
          const buffer = await qvid.download();
          const result = await upscaleVideo(buffer);
          if (!result.success) return reply("❌ *Gagal enhance video! Semua provider gagal.*");
          await sock.sendMessage(m.chat, { video: result.buffer, caption: "🎬 *Video Enhanced*" }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply("❌ *Gagal enhance video!*"); }
      }
      break;

    case "unblur": case "videoenhance": case "venhance":
      {
        if (!isVideo && !isQuotedVideo) return reply("🎬 Kirim atau reply video untuk AI enhance!");
        const res2k = q?.toLowerCase() === "4k" ? "4k" : "2k";
        try {
          await m.react("⏳");
          await reply(`⏳ AI video enhance (${res2k})... bisa 1-2 menit`);
          const qvid = m.quoted || m;
          const buffer = await qvid.download();
          const result = await unblurVideo(buffer, { resolution: res2k });
          if (!result.success) return reply(`❌ *Gagal enhance!* ${result.error}`);
          await sock.sendMessage(m.chat, { video: { url: result.url }, caption: `🎬 *Video Enhanced (${res2k.toUpperCase()})*` }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal enhance!* ${err.message}`); }
      }
      break;

    case "nano": case "imgai": case "aigenerate":
      if (!q) return reply("🎨 Masukkan prompt!\nContoh: .nano cat in space");
      try {
        await m.react("⏳");
        const result = await nanoBanana(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        await sock.sendMessage(m.chat, { image: result.buffer, caption: `🎨 *${q}*` }, { quoted: m });
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal generate gambar!*"); }
      break;

    // ═══════════════════════════════════════════
    //  NEW SCRAPERS — Wiki, Define, Kurs, Cuaca, Search, Anime, Movie, News
    // ═══════════════════════════════════════════
    case "wiki": case "wikipedia":
      if (!q) return reply("📖 Masukkan kata kunci!\nContoh: .wiki indonesia");
      try {
        await m.react("⏳");
        const result = await wiki(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📖 *${result.title}*\n\n${result.content}\n\n🔗 ${result.url}`;
        if (result.image) {
          await sock.sendMessage(m.chat, { image: { url: result.image }, caption: txt }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        } else {
          await reply(txt);
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal ambil info Wikipedia!*"); }
      break;

    case "define": case "dict": case "kamus":
      if (!q) return reply("📚 Masukkan kata!\nContoh: .define hello");
      try {
        await m.react("⏳");
        const result = await define(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📚 *${result.word.toUpperCase()}*`;
        if (result.pronunciation) txt += ` [${result.pronunciation}]`;
        if (result.partOfSpeech) txt += `\n🏷️ *Part of Speech:* ${result.partOfSpeech}`;
        txt += "\n\n📋 *Definitions:*";
        result.definitions.forEach((d, i) => { txt += `\n${i + 1}. ${d}`; });
        if (result.synonyms) txt += `\n\n🔁 *Synonyms:* ${result.synonyms.join(", ")}`;
        await reply(txt);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal cari definisi!*"); }
      break;

    case "kurs": case "currency": case "uang":
      {
        const from = args[0]?.toUpperCase() || "USD";
        const to = args[1]?.toUpperCase() || "IDR";
        const amount = args[2] ? parseFloat(args[2]) : null;
        try {
          await m.react("⏳");
          let result;
          if (amount && !isNaN(amount)) {
            result = await currencyConvert(amount, from, to);
          } else {
            result = await kurs(from, to);
          }
          if (!result.success) return reply(`❌ ${result.error}`);
          await reply(`💱 *Kurs Mata Uang*\n\n${result.text}\n📅 ${result.updated}`);
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply("❌ *Gagal ambil kurs!*"); }
      }
      break;

    case "cuaca": case "weather":
      if (!q) return reply("🌤️ Masukkan nama kota!\nContoh: .cuaca Jakarta");
      try {
        await m.react("⏳");
        const result = await cuaca(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🌤️ *Cuaca: ${result.location}*\n\n🌡️ *Suhu:* ${result.temperature}\n☁️ *Kondisi:* ${result.condition}`;
        if (result.humidity) txt += `\n💧 *Kelembaban:* ${result.humidity}`;
        if (result.wind) txt += `\n💨 *Angin:* ${result.wind}`;
        if (result.feelsLike) txt += `\n🤒 *Terasa seperti:* ${result.feelsLike}`;
        if (result.forecast) {
          txt += "\n\n📅 *Prakiraan:*";
          result.forecast.forEach(f => { txt += `\n• ${f.day}: ↑${f.hi}° ↓${f.lo}°`; });
        }
        await reply(txt);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal ambil info cuaca!*"); }
      break;

    case "google": case "search": case "g":
      if (!q) return reply("🔍 Masukkan kata kunci!\nContoh: .google cara masak nasi");
      try {
        await m.react("⏳");
        const result = await googleSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🔍 *Hasil Pencarian: ${q}*\n\n`;
        result.results.forEach((r, i) => {
          txt += `${i + 1}. *${r.title}*\n`;
          if (r.snippet) txt += `   ${r.snippet}\n`;
          if (r.link) txt += `   🔗 ${r.link}\n`;
          txt += "\n";
        });
        await reply(txt.trim());
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal cari!*"); }
      break;

    case "anime": case "animeinfo":
      if (!q) return reply("🎌 Masukkan nama anime!\nContoh: .anime one piece");
      try {
        await m.react("⏳");
        const result = await animeInfo(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🎌 *${result.title}*`;
        if (result.score) txt += `\n⭐ *Score:* ${result.score}/10`;
        const d = result.details;
        if (d.episodes) txt += `\n📺 *Episodes:* ${d.episodes}`;
        if (d.status) txt += `\n📊 *Status:* ${d.status}`;
        if (d.aired) txt += `\n📅 *Aired:* ${d.aired}`;
        if (d.genres) txt += `\n🎭 *Genre:* ${d.genres}`;
        if (d.duration) txt += `\n⏱️ *Duration:* ${d.duration}`;
        if (d.rating) txt += `\n🔞 *Rating:* ${d.rating}`;
        if (result.synopsis) txt += `\n\n📝 ${result.synopsis}`;
        txt += `\n\n🔗 ${result.url}`;
        if (result.image) {
          await sock.sendMessage(m.chat, { image: { url: result.image }, caption: txt }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        } else {
          await reply(txt);
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal cari info anime!*"); }
      break;

    case "movie": case "film": case "imdb":
      if (!q) return reply("🎬 Masukkan judul film!\nContoh: .movie interstellar");
      try {
        await m.react("⏳");
        const result = await movieInfo(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🎬 *${result.title}*`;
        if (result.year) txt += ` (${result.year})`;
        if (result.rating) txt += `\n⭐ *Rating:* ${result.rating}/10`;
        if (result.genre) txt += `\n🎭 *Genre:* ${result.genre}`;
        if (result.duration) txt += `\n⏱️ *Duration:* ${result.duration}`;
        if (result.director) txt += `\n🎬 *Director:* ${result.director}`;
        if (result.plot) txt += `\n\n📝 ${result.plot}`;
        txt += `\n\n🔗 ${result.url}`;
        if (result.image) {
          await sock.sendMessage(m.chat, { image: { url: result.image }, caption: txt }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        } else {
          await reply(txt);
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply("❌ *Gagal cari info film!*"); }
      break;

    case "berita": case "news":
      {
        const kat = args[0] || "terpopuler";
        try {
          await m.react("⏳");
          const result = await berita(kat);
          if (!result.success) return reply(`❌ ${result.error}`);
          let txt = `📰 *Berita ${result.kategori}*\n\n`;
          result.articles.forEach((a, i) => {
            txt += `${i + 1}. *${a.title}*\n`;
            if (a.time) txt += `   🕐 ${a.time}\n`;
            txt += `   🔗 ${a.link}\n\n`;
          });
          await reply(txt.trim());
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply("❌ *Gagal ambil berita!*"); }
      }
      break;

    // ═══════════════════════════════════════════
    //  NEKOLABS — AI, Tools, Downloader
    // ═══════════════════════════════════════════
    case "ai": case "chat": case "ask":
      if (!q) return reply("🤖 Masukkan pertanyaan!\nContoh: .ai apa itu javascript");
      try {
        await m.react("⏳");
        const result = await dolphinAI(q);
        await reply(`🤖 *AI*\n\n${result}`);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "editimg": case "editimage":
      {
        const qimg = m.quoted || m;
        const mime = (qimg.msg || qimg).mimetype || "";
        if (!mime.startsWith("image/")) return reply("🖼️ Reply/send gambar dengan caption .editimg <prompt>");
        if (!q) return reply("✏️ Masukkan prompt edit!\nContoh: .editimg ubah latar belakang jadi pantai");
        try {
          await m.react("⏳");
          await reply("⏳ Editing gambar... (bisa 30-60 detik)");
          const buffer = await qimg.download();
          const result = await editImg(q, buffer);
          if (result && result[0]) {
            await sock.sendMessage(m.chat, { image: { url: result[0] }, caption: `✏️ *Edit:* ${q}` }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          } else {
            await reply("❌ Tidak ada hasil");
          }
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal edit gambar!* ${err.message}`); }
      }
      break;

    case "ghibli":
      {
        const qimg = m.quoted || m;
        const mime = (qimg.msg || qimg).mimetype || "";
        if (!mime.startsWith("image/")) return reply("🖼️ Reply/send gambar dengan caption .ghibli");
        try {
          await m.react("⏳");
          await reply("⏳ Converting ke Ghibli style... (bisa 30-60 detik)");
          const buffer = await qimg.download();
          const imageUrl = await ghibliAI(buffer, q || undefined);
          if (imageUrl) {
            await sock.sendMessage(m.chat, { image: { url: imageUrl }, caption: "🎌 *Ghibli Style*" }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          } else {
            await reply("❌ Tidak ada hasil");
          }
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal convert Ghibli!* ${err.message}`); }
      }
      break;

    case "removebg": case "rmbg":
      {
        const qimg = m.quoted || m;
        const mime = (qimg.msg || qimg).mimetype || "";
        if (!mime.startsWith("image/")) return reply("🖼️ Reply/send gambar dengan caption .removebg");
        try {
          await m.react("⏳");
          const buffer = await qimg.download();
          const result = await removeBg(buffer);
          if (result) {
            await sock.sendMessage(m.chat, { image: result, caption: "✂️ *Background Removed*" }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          }
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal remove bg!* ${err.message}`); }
      }
      break;

    case "tts": case "texttospeech":
      {
        const voice = args[0]?.charAt(0).toUpperCase() + args[0]?.slice(1).toLowerCase();
        const text = args.slice(1).join(" ") || q;
        const validVoices = ["Dylan", "Sunny", "Jada", "Cherry", "Ethan", "Serena", "Chelsie"];
        const useVoice = validVoices.includes(voice) ? voice : "Dylan";
        const useText = validVoices.includes(voice) ? text : q;
        if (!useText) return reply("🔊 Masukkan teks!\nContoh: .tts Halo apa kabar\nVoice: .tts Sunny Halo apa kabar");
        try {
          await m.react("⏳");
          const audioUrl = await qwenTTS(useText, useVoice);
          if (audioUrl) {
            await sock.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: "audio/mpeg", ptt: true }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          }
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal TTS!* ${err.message}`); }
      }
      break;

    case "cekresi": case "resi":
      {
        const noResi = args[0];
        const ekspedisi = args[1];
        if (!noResi || !ekspedisi) return reply("📦 Masukkan nomor resi & ekspedisi!\nContoh: .cekresi SPXID054330680586 shopee-express\n\nEkspedisi: jne, jnt, sicepat, shopee-express, tiki, pos-indonesia, anteraja, dll");
        try {
          await m.react("⏳");
          const result = await cekResi(noResi, ekspedisi);
          if (!result.success) return reply(`❌ ${result.message}`);
          let txt = `📦 *Cek Resi*\n\n🔢 *Resi:* ${result.resi}\n🚚 *Ekspedisi:* ${result.ekspedisi}`;
          if (result.status) txt += `\n📊 *Status:* ${result.status}`;
          if (result.tanggalKirim) txt += `\n📅 *Tgl Kirim:* ${result.tanggalKirim}`;
          if (result.history.length) {
            txt += "\n\n📋 *History:*";
            result.history.forEach((h) => { txt += `\n• ${h.tanggal}: ${h.keterangan}`; });
          }
          await reply(txt);
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal cek resi!* ${err.message}`); }
      }
      break;

    case "nik": case "ceknik":
      {
        const nikNum = args[0]?.replace(/[^0-9]/g, "");
        if (!nikNum || nikNum.length !== 16) return reply("🪪 Masukkan NIK 16 digit!\nContoh: .nik 3201234567890001");
        try {
          await m.react("⏳");
          const result = await nikParse(nikNum);
          if (!result.success) return reply(`❌ ${result.error}`);
          let txt = `🪪 *NIK Parser*\n\n🔢 *NIK:* ${result.nik}\n👤 *Kelamin:* ${result.kelamin}\n📅 *Lahir:* ${result.lahir_lengkap}\n📍 *Provinsi:* ${result.provinsi.nama}\n🏙️ *${result.kotakab.jenis}:* ${result.kotakab.nama}\n🏘️ *Kecamatan:* ${result.kecamatan.nama}`;
          txt += `\n\n🌙 *Pasaran:* ${result.pasaran}\n⭐ *Zodiak:* ${result.zodiak}\n🎂 *Usia:* ${result.usia} (${result.kategori_usia})`;
          await reply(txt);
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal parse NIK!* ${err.message}`); }
      }
      break;

    case "terabox": case "tera":
      if (!q) return reply("📁 Masukkan link Terabox!\nContoh: .terabox https://www.terabox.com/wap/share/filelist?surl=...");
      try {
        await m.react("⏳");
        const result = await teraboxDL(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        // Result structure varies — show what we got
        if (result.list) {
          let txt = "📁 *Terabox Files*\n\n";
          result.list.forEach((f, i) => {
            txt += `${i + 1}. *${f.name || f.title}*\n   📦 ${f.size || "?"}\n`;
            if (f.downloadLink) txt += `   🔗 ${f.downloadLink}\n`;
            txt += "\n";
          });
          await reply(txt.trim());
        } else if (result.downloadLink || result.dlink) {
          await reply(`📁 *Terabox*\n\n🔗 Download: ${result.downloadLink || result.dlink}`);
        } else {
          await reply("📁 *Terabox*\n\n❌ *Tidak dapat mengekstrak link download.*");
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal download Terabox!* ${err.message}`); }
      break;

    case "ssweb": case "screenshot":
      if (!q) return reply("📸 Masukkan URL!\nContoh: .ssweb https://google.com");
      try {
        await m.react("⏳");
        const imageUrl = await ssweb(q);
        if (imageUrl) {
          await sock.sendMessage(m.chat, { image: { url: imageUrl }, caption: `📸 *Screenshot*\n🔗 ${q}` }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal screenshot!* ${err.message}`); }
      break;

    case "kbbi":
      if (!q) return reply("📖 Masukkan kata!\nContoh: .kbbi indonesia");
      try {
        await m.react("⏳");
        const result = await kbbiSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `📖 *KBBI: ${result.kata}*\n\n`;
        result.entri.forEach((e, i) => {
          txt += `*${e.kata}*\n`;
          e.makna.forEach((m) => { txt += `  ${m.kelas_kata}: ${m.deskripsi}\n`; });
          if (e.kata_tidak_baku) txt += `  ❌ Tidak baku: ${e.kata_tidak_baku}\n`;
          txt += "\n";
        });
        await reply(txt.trim());
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal cari KBBI!* ${err.message}`); }
      break;

    case "resep": case "cookpad":
      if (!q) return reply("🍳 Masukkan kata kunci!\nContoh: .resep ayam kecap");
      try {
        await m.react("⏳");
        const result = await cookpadSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🍳 *Resep: ${q}*\n\n`;
        result.recipes.forEach((r, i) => {
          txt += `${i + 1}. *${r.title}*\n`;
          if (r.author) txt += `   👤 ${r.author}\n`;
          if (r.prepTime) txt += `   ⏱️ ${r.prepTime}`;
          if (r.servings) txt += ` | 🍽️ ${r.servings}`;
          if (r.prepTime || r.servings) txt += "\n";
          if (r.ingredients?.length) txt += `   🥘 ${r.ingredients.slice(0, 4).join(", ")}...\n`;
          txt += `   🔗 ${r.url}\n\n`;
        });
        await reply(txt.trim());
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal cari resep!* ${err.message}`); }
      break;

    case "transcribe": case "totext":
      {
        const qa = m.quoted || m;
        const mime = (qa.msg || qa).mimetype || "";
        if (!mime.startsWith("audio/") && !mime.startsWith("video/"))
          return reply("🎤 Reply audio/video dengan caption .transcribe");
        try {
          await m.react("⏳");
          const buffer = await qa.download();
          const result = await transcribe(buffer);
          if (!result.success) return reply(`❌ ${result.error}`);
          await reply(`🎤 *Transcription*\n\n${result.text}`);
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal transcribe!* ${err.message}`); }
      }
      break;

    case "deepsearch": case "ds": case "perplexed":
      if (!q) return reply("🔬 Masukkan pertanyaan!\nContoh: .deepsearch apa itu blockchain");
      try {
        await m.react("⏳");
        const result = await perplexed(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🔬 *Deep Search*\n\n${result.answer}`;
        if (result.sources?.length) {
          txt += "\n\n📚 *Sumber:*";
          result.sources.forEach((s, i) => { txt += `\n${i + 1}. ${s.title || s.url || s}\n   🔗 ${s.url || s}`; });
        }
        await reply(txt);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal deep search!* ${err.message}`); }
      break;

    case "turboseek": case "tseek":
      if (!q) return reply("⚡ Masukkan pertanyaan!\nContoh: .turboseek cara kerja AI");
      try {
        await m.react("⏳");
        const result = await turboseek(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `⚡ *Turboseek*\n\n${result.answer}`;
        if (result.sources?.length) {
          txt += "\n\n📚 *Sumber:*";
          result.sources.forEach((s, i) => { txt += `\n${i + 1}. 🔗 ${s}`; });
        }
        await reply(txt);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal turboseek!* ${err.message}`); }
      break;

    case "bypass": case "bypasslink":
      if (!q) return reply("🔗 Masukkan link shortener!\nContoh: .bypass https://linkvertise.com/...");
      try {
        await m.react("⏳");
        const result = await bypassCity(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        const bypassUrl = result.result?.destination || result.result?.url || result.result?.result || result.result;
        const urlStr = typeof bypassUrl === 'string' ? bypassUrl : (bypassUrl?.url || bypassUrl?.destination || '');
        if (urlStr) {
          await reply(`🔗 *Bypass Result*\n\n✅ ${urlStr}`);
        } else {
          await reply("🔗 *Bypass Result*\n\n❌ *Gagal mendapatkan link tujuan.*");
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal bypass!* ${err.message}`); }
      break;

    case "lirik2": case "lrclib":
      if (!q) return reply("🎵 Masukkan judul lagu!\nContoh: .lirik2 night changes");
      try {
        await m.react("⏳");
        const result = await lyricsSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        let txt = `🎵 *${result.title}*\n👤 *${result.artist}*\n${result.album ? `💿 ${result.album}\n` : ""}${result.duration ? `⏱️ ${result.duration}\n` : ""}${result.instrumental ? "🎹 *Instrumental*\n" : ""}`;
        if (result.lyrics) txt += `\n${result.lyrics}`;
        await reply(txt);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "unsplash": case "image":
      if (!q) return reply("🖼️ Masukkan kata kunci!\nContoh: .unsplash sunset");
      try {
        await m.react("⏳");
        const result = await unsplashSearch(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        const first = result.results[0];
        await sock.sendMessage(m.chat, {
          image: { url: first.image },
          caption: `🖼️ *Unsplash: ${q}*\n👤 ${first.author} | ❤️ ${first.likes}\n🔗 ${first.url}`,
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "pexels": case "stockimg":
      if (!q) return reply("🖼️ Masukkan kata kunci!\nContoh: .pexels mountain\nTipe: .pexels mountain videos");
      try {
        const type = args[1] === "videos" ? "videos" : "photos";
        await m.react("⏳");
        const result = await pexelsSearch(q, type);
        if (!result.success) return reply(`❌ ${result.error}`);
        const first = result.results[0];
        if (type === "photos") {
          await sock.sendMessage(m.chat, { image: { url: first.image?.src?.large || first.download }, caption: `🖼️ *Pexels: ${q}*\n👤 ${first.author}\n🔗 ${first.url}` }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        } else {
          await reply(`🎬 *Pexels Video: ${q}*\n👤 ${first.author}\n🎥 ${first.video}\n🔗 ${first.url}`);
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "claude": case "claudeai":
      if (!q) return reply("🤖 Masukkan pertanyaan!\nContoh: .claude jelaskan teori relativitas");
      try {
        await m.react("⏳");
        const result = await claude3(q);
        await reply(`🤖 *Claude 3*\n\n${result}`);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "gemini": case "googleai":
      if (!q) return reply("🤖 Masukkan pertanyaan!\nContoh: .gemini apa itu AI");
      try {
        await m.react("⏳");
        const result = await geminiAI({ message: q });
        if (!result.success) return reply(`❌ ${result.error}`);
        await reply(`🤖 *Gemini AI*\n\n${result.text}`);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "mega": case "megadl":
      if (!q) return reply("📁 Masukkan link MEGA!\nContoh: .mega https://mega.nz/file/...");
      try {
        await m.react("⏳");
        const result = await megaDL(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        await reply(`📁 *MEGA*\n\n📄 *${result.fileName}*\n📦 ${result.fileSize}\n🔗 ${result.downloadUrl}`);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "gdrive": case "drivedl":
      if (!q) return reply("📁 Masukkan link Google Drive!\nContoh: .gdrive https://drive.google.com/file/d/...");
      try {
        await m.react("⏳");
        const result = await gdriveDL(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        if (result.type === "folder") {
          let txt = `📁 *GDrive Folder: ${result.name}*\n\n`;
          result.files.forEach((f, i) => { txt += `${i + 1}. *${f.name}* (${f.size})\n   🔗 ${f.download}\n\n`; });
          await reply(txt.trim());
        } else {
          await reply(`📁 *GDrive*\n\n📄 *${result.name}*\n📦 ${result.size}\n🔗 ${result.download}`);
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "scribd": case "scribddl":
      if (!q) return reply("📄 Masukkan link Scribd!\nContoh: .scribd https://scribd.com/document/...");
      try {
        await m.react("⏳");
        const result = await scribdDL(q);
        if (!result.success) return reply(`❌ ${result.error}`);
        const dlUrl = result.result?.download_url || result.result?.url || result.result?.link || result.result;
        const urlStr = typeof dlUrl === 'string' ? dlUrl : (dlUrl?.url || dlUrl?.download || '');
        if (urlStr) {
          await reply(`📄 *Scribd*\n\n🔗 Download: ${urlStr}`);
        } else {
          await reply("📄 *Scribd*\n\n❌ *Gagal mendapatkan link download.*");
        }
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "animequote": case "aq":
      try {
        await m.react("⏳");
        const result = await animeQuote();
        if (!result.success) return reply(`❌ ${result.error}`);
        await reply(`💬 *Anime Quote*\n\n_"${result.quote}"_\n\n— *${result.character}* (${result.anime})`);
        await m.react("✅");
      } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      break;

    case "ppwa": case "getpp":
      {
        const num = args[0]?.replace(/[^0-9]/g, "");
        if (!num) return reply("📷 Masukkan nomor!\nContoh: .ppwa 6281234567890");
        try {
          await m.react("⏳");
          const result = await getppWA(num);
          if (!result.success) return reply(`❌ ${result.error}`);
          if (result.result?.url) {
            await sock.sendMessage(m.chat, { image: { url: result.result.url }, caption: `📷 *PP WA: ${num}*` }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          } else {
            await reply("📷 *PP WA*\n\n❌ *Foto profil tidak ditemukan.*");
          }
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal!* ${err.message}`); }
      }
      break;

    case "waifu2x": case "w2x":
      {
        const qimg = m.quoted || m;
        const mime = (qimg.msg || qimg).mimetype || "";
        if (!mime.startsWith("image/")) return reply("🖼️ Reply/send gambar dengan caption .waifu2x");
        try {
          await m.react("⏳");
          const buffer = await qimg.download();
          const result = await waifu2x(buffer);
          if (result) {
            await sock.sendMessage(m.chat, { image: result, caption: "✨ *Waifu2x Upscaled*" }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          }
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal waifu2x!* ${err.message}`); }
      }
      break;

    case "enhance": case "photoenhance":
      {
        const qimg = m.quoted || m;
        const mime = (qimg.msg || qimg).mimetype || "";
        if (!mime.startsWith("image/")) return reply("🖼️ Reply/send gambar dengan caption .enhance");
        try {
          await m.react("⏳");
          await reply("⏳ Enhancing foto... (bisa 30-60 detik)");
          const buffer = await qimg.download();
          const imageUrl = await photoEnhancer(buffer);
          if (imageUrl) {
            await sock.sendMessage(m.chat, { image: { url: imageUrl }, caption: "✨ *Photo Enhanced*" }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
          }
          await m.react("✅");
        } catch (err) { await m.react("❌"); reply(`❌ *Gagal enhance!* ${err.message}`); }
      }
      break;
    case "yts": case "ytsearch":
      {
        if (!q) return reply(`🎵 *Masukkan judul lagu!*\n\nContoh: ${command} night changes`);
        await m.react("🔍");
        const results = await search(q, "track", 5);
        const txt = formatSearch(results, q);
        await reply(txt);
        await m.react("✅");
      }
      break;

    case "play":
      {
        if (!q) return reply(`🎵 *Masukkan judul lagu!*\n\nContoh: ${command} night changes`);
        await m.react("⏳");
        const song = await playSong(q);
        if (song.error) {
          await m.react("❌");
          return reply(`❌ *Gagal!*\n${song.error}`);
        }
        const caption = `🎵 *${song.title}*\n\n` +
          `👤 *Artist:* ${song.artist}\n` +
          `💿 *Album:* ${song.album}\n` +
          `⏱ *Duration:* ${song.duration}\n` +
          `👁 *Views:* ${Number(song.views).toLocaleString()}\n\n` +
          `© ${setting.name}`;
        await sock.sendMessage(m.chat, {
          image: { url: song.cover },
          caption,
          footer: `© ${setting.name}`,
          interactiveButtons: [
            urlButton("🎬 YT Music", song.videoUrl),
            urlButton("GitHub", "https://github.com/shikytemo"),
          ]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await sock.sendMessage(m.chat, {
          audio: { url: song.audioUrl },
          mimetype: "audio/mpeg",
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await m.react("✅");
      }
      break;

    case "spdl": case "spotifydl":
      {
        if (!q) return reply(`🔗 *Masukkan link Spotify!*\n\nContoh: ${command} https://open.spotify.com/track/xxx`);
        if (!q.includes("spotify.com")) return reply("❌ *Link tidak valid!* Harus link Spotify.");
        await m.react("⏳");
        const dl = await download(q);
        if (dl.error) {
          await m.react("❌");
          return reply(`❌ *Gagal download!*\n${dl.error}`);
        }
        await sock.sendMessage(m.chat, {
          image: { url: dl.cover },
          caption: `🎵 *${dl.title}*\n👤 ${dl.artist}\n💿 ${dl.album}\n\n© ${setting.name}`,
          footer: `© ${setting.name}`,
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await sock.sendMessage(m.chat, {
          audio: { url: dl.url },
          mimetype: "audio/mpeg",
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await m.react("✅");
      }
      break;

    // ═══════════════════════════════════════════
    //  DATABASE & RPG COMMANDS
    // ═══════════════════════════════════════════
    case "profile": case "me": case "stats":
      {
        const targetJid = m.mentionedJid?.[0] || sender;
        if (!db.isRegistered(targetJid)) return reply("❌ *User belum terdaftar!*");
        const card = db.formatProfile(targetJid);
        await reply(card);
      }
      break;

    case "level": case "lv":
      {
        const u = db.getUser(sender);
        const tier = db.getTier(u.level);
        const xpNeeded = db.xpToNextLevel(u.level);
        const tp = db.getTierProgress(u.level);
        await reply(
          `${tier.badge} *${pushname}*\n\n` +
          `🏅 *Tier:* ${tier.name} (${tier.symbol})\n` +
          `📊 *Level:* ${u.level}\n` +
          `✨ *XP:* ${u.xp}/${xpNeeded}\n` +
          `📈 *Tier Progress:* ${tp.percent}%`
        );
      }
      break;

    case "daily":
      {
        const result = db.claimDaily(sender);
        if (!result) return reply("❌ *Error!*");
        if (!result.claimed) {
          const rem = result.remaining;
          const h = Math.floor(rem / 3600000);
          const m2 = Math.floor((rem % 3600000) / 60000);
          return reply(`⏳ *Daily sudah diklaim!*\n\nKlaim lagi dalam *${h}j ${m2}m*`);
        }
        let txt = `🎁 *DAILY REWARD*\n\n` +
          `💰 +$${result.money.toLocaleString()}\n` +
          `✨ +${result.xp} XP`;
        if (result.leveledUp) {
          txt += `\n\n🎉 *LEVEL UP!* -> Level ${result.newLevel}!`;
        }
        await reply(txt);
      }
      break;

    case "leaderboard": case "lb": case "top":
      {
        const type = args[0] === "money" || args[0] === "uang" ? "money" : "level";
        const lb = db.formatLeaderboard(type, 10);
        await reply(lb);
      }
      break;

    case "transfer": case "tf": case "pay":
      {
        const target = m.mentionedJid?.[0];
        const amount = parseInt(args[1] || args[0]);
        if (!target) return reply(`👤 Tag user tujuan!\n\nContoh: ${command} @user 1000`);
        if (!amount || amount <= 0) return reply("❌ *Jumlah tidak valid!*");
        if (target === sender) return reply("❌ *Tidak bisa transfer ke diri sendiri!*");
        if (!db.isRegistered(target)) return reply("❌ *User tujuan belum terdaftar!*");
        const result = db.transferMoney(sender, target, amount);
        if (!result.success) return reply(`❌ *Gagal:* ${result.reason}`);
        await sock.sendMessage(m.chat, {
          text: `✅ *Transfer Berhasil!*\n\n💰 $${amount.toLocaleString()} -> @${target.split("@")[0]}`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "limit":
      {
        const u = db.getUser(sender);
        const maxLim = isOwner ? "♾️" : isBotAdmin ? 999 : isPremium ? 100 : 25;
        await reply(`📊 *Limit Kamu*\n\n⚡ Sisa: *${u.limit >= 99999 ? "♾️" : u.limit}*/${maxLim}`);
      }
      break;

    case "money": case "balance": case "bal":
      {
        const u = db.getUser(sender);
        await reply(`💰 *Balance*\n\n💵 Uang kamu: *$${u.money.toLocaleString()}*`);
      }
      break;

    // ═══════════════════════════════════════════
    //  ADMIN COMMANDS
    // ═══════════════════════════════════════════
    case "addpremium":
      {
        if (!isBotAdmin && !isOwner) return reply("🔒 *Khusus Admin/Owner!*");
        const target = m.mentionedJid?.[0];
        const days = parseInt(args[1]) || 30;
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user 30`);
        if (!db.isRegistered(target)) db.register(target, target.split("@")[0]);
        const ok = db.setPremium(target, days);
        if (!ok) return reply("❌ *Gagal!* User mungkin sudah admin/owner.");
        await sock.sendMessage(m.chat, {
          text: `⭐ *Premium Activated!*\n\n@${target.split("@")[0]} -> Premium ${days} hari`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "delpremium": case "removepremium":
      {
        if (!isBotAdmin && !isOwner) return reply("🔒 *Khusus Admin/Owner!*");
        const target = m.mentionedJid?.[0];
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user`);
        const ok = db.removePremium(target);
        if (!ok) return reply("❌ *Gagal hapus premium!*");
        await sock.sendMessage(m.chat, {
          text: `❌ Premium @${target.split("@")[0]} dicabut.`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "addadmin":
      {
        if (!isOwner) return reply("👑 *Khusus Owner!*");
        const target = m.mentionedJid?.[0];
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user`);
        if (!db.isRegistered(target)) db.register(target, target.split("@")[0]);
        const ok = db.setAdmin(target);
        if (!ok) return reply("❌ *Gagal set admin!*");
        await sock.sendMessage(m.chat, {
          text: `🔧 *Admin Added!*\n\n@${target.split("@")[0]} sekarang Admin.`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "deladmin": case "removeadmin":
      {
        if (!isOwner) return reply("👑 *Khusus Owner!*");
        const target = m.mentionedJid?.[0];
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user`);
        const ok = db.removeAdmin(target);
        if (!ok) return reply("❌ *Gagal hapus admin!* (mungkin owner)");
        await sock.sendMessage(m.chat, {
          text: `❌ Admin @${target.split("@")[0]} dicabut.`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "addmoney": case "addbal":
      {
        if (!isBotAdmin && !isOwner) return reply("🔒 *Khusus Admin/Owner!*");
        const target = m.mentionedJid?.[0];
        const amount = parseInt(args[1] || args[0]);
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user 10000`);
        if (!amount || amount <= 0) return reply("❌ *Jumlah tidak valid!*");
        db.addMoney(target, amount);
        await sock.sendMessage(m.chat, {
          text: `💰 +$${amount.toLocaleString()} untuk @${target.split("@")[0]}`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "addlimit":
      {
        if (!isBotAdmin && !isOwner) return reply("🔒 *Khusus Admin/Owner!*");
        const target = m.mentionedJid?.[0];
        const amount = parseInt(args[1] || args[0]);
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user 50`);
        if (!amount || amount <= 0) return reply("❌ *Jumlah tidak valid!*");
        db.addLimit(target, amount);
        await sock.sendMessage(m.chat, {
          text: `📊 +${amount} limit untuk @${target.split("@")[0]}`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "addxp":
      {
        if (!isBotAdmin && !isOwner) return reply("🔒 *Khusus Admin/Owner!*");
        const target = m.mentionedJid?.[0];
        const amount = parseInt(args[1] || args[0]);
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user 500`);
        if (!amount || amount <= 0) return reply("❌ *Jumlah tidak valid!*");
        const res = db.addXp(target, amount);
        let txt = `✨ +${amount} XP untuk @${target.split("@")[0]}`;
        if (res?.leveledUp) txt += `\n🎉 Level Up -> Lv.${res.newLevel}!`;
        await sock.sendMessage(m.chat, {
          text: txt,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "setlevel":
      {
        if (!isOwner) return reply("👑 *Khusus Owner!*");
        const target = m.mentionedJid?.[0];
        const lvl = parseInt(args[1] || args[0]);
        if (!target) return reply(`👤 Tag user!\n\nContoh: ${command} @user 50`);
        if (!lvl || lvl < 1) return reply("❌ *Level harus minimal 1!*");
        const u = db.getUser(target);
        if (!u) return reply("❌ *User tidak ditemukan!*");
        u.level = lvl;
        u.xp = 0;
        db.save();
        const tier = db.getTier(lvl);
        await sock.sendMessage(m.chat, {
          text: `⚡ @${target.split("@")[0]} -> Level ${lvl}\n🏅 Tier: ${tier.badge} ${tier.name}`,
          mentions: [target]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    // ═══════════════════════════════════════════
    //  INFO COMMANDS
    // ═══════════════════════════════════════════
    case "tier": case "tierlist":
      {
        let txt = `╔═══════════════════════╗\n║   🏅 *TIER LIST* 🏅\n╠═══════════════════════╣\n`;
        const currentTier = db.getTier(db.getUser(sender)?.level || 1);
        for (const t of TIERS) {
          const sym = t.symbol;
          const isCurrent = currentTier.name === t.name ? " ◄ YOU" : "";
          txt += `║ ${t.badge} *Tier ${sym}*${isCurrent}\n║ ${t.name}\n║ Level ${t.minLevel} - ${t.maxLevel}\n║ ─────────────────\n`;
        }
        txt += `╚═══════════════════════╝`;
        await reply(txt);
      }
      break;

    case "listpremium":
      {
        if (!isBotAdmin && !isOwner) return reply("🔒 *Khusus Admin/Owner!*");
        const users = db.getAllUsers().filter(u => u.premium || u.role === "premium");
        if (users.length === 0) return reply("📭 Tidak ada user premium.");
        let txt = `⭐ *LIST PREMIUM*\n\n`;
        users.forEach((u, i) => {
          const exp = u.premiumExpiry > Date.now() ? new Date(u.premiumExpiry).toLocaleDateString("id-ID") : "Expired";
          txt += `${i + 1}. ${u.name} (@${u.jid.split("@")[0]})\n   📅 Expired: ${exp}\n`;
        });
        await reply(txt);
      }
      break;

    case "listadmin":
      {
        if (!isBotAdmin && !isOwner) return reply("🔒 *Khusus Admin/Owner!*");
        const users = db.getAllUsers().filter(u => u.role === "admin" || u.role === "owner");
        if (users.length === 0) return reply("📭 Tidak ada admin.");
        let txt = `🔧 *LIST ADMIN & OWNER*\n\n`;
        users.forEach((u, i) => {
          txt += `${i + 1}. ${u.name} - ${db.roleDisplay(u.role)}\n`;
        });
        await reply(txt);
      }
      break;

    // ═══════════════════════════════════════════
    //  GAME COMMANDS - Battle, Hunt, Shop, Inventory
    // ═══════════════════════════════════════════
    case "battle": case "fight": case "duel":
      {
        const result = game.startBattle(sender);
        if (result.error) return reply(result.error);
        if (result.view) await sendBattleUI(sock, m, result.text, prefix);
      }
      break;

    case "attack": case "atk":
      {
        const result = game.battleAction(sender, "attack");
        if (result.error) return reply(result.error);
        if (result.end) { game.afterBattle(sender); return reply(result.msg); }
        if (result.view) await sendBattleUI(sock, m, result.text, prefix);
      }
      break;

    case "skill":
      {
        const result = game.battleAction(sender, "skill");
        if (result.error) return reply(result.error);
        if (result.end) { game.afterBattle(sender); return reply(result.msg); }
        if (result.view) await sendBattleUI(sock, m, result.text, prefix);
      }
      break;

    case "defend": case "def":
      {
        const result = game.battleAction(sender, "defend");
        if (result.error) return reply(result.error);
        if (result.end) { game.afterBattle(sender); return reply(result.msg); }
        if (result.view) await sendBattleUI(sock, m, result.text, prefix);
      }
      break;

    case "flee": case "kabur": case "run":
      {
        const result = game.fleeBattle(sender);
        if (result.error) return reply(result.error);
        game.afterBattle(sender);
        reply(result.msg);
      }
      break;

    case "hunt": case "berburu":
      {
        const result = game.hunt(sender);
        if (result.error) return reply(result.error);
        reply(result.msg);
      }
      break;

    case "heal":
      {
        const result = game.heal(sender);
        if (result.error) return reply(result.error);
        reply(result.msg);
      }
      break;

    case "shop": case "toko":
      {
        const shop = game.shopView();
        await reply(shop);
      }
      break;

    case "buy": case "beli":
      {
        const itemId = args[0];
        const qty = parseInt(args[1]) || 1;
        if (!itemId) return reply(`🛒 Masukkan ID item!\n\nContoh: ${command} potion 3\n\nLihat daftar: .shop`);
        const result = game.buyItem(sender, itemId, qty);
        if (result.error) return reply(result.error);
        reply(result.msg);
      }
      break;

    case "inventory": case "inv": case "tas":
      {
        const inv = game.inventoryView(sender);
        await reply(inv);
      }
      break;

    case "use": case "pakai":
      {
        const itemId = args[0];
        if (!itemId) return reply(`📦 Masukkan ID item!\n\nContoh: ${command} potion\n\nCek inventory: .inv`);
        const result = game.useItem(sender, itemId);
        if (result.error) return reply(result.error);
        reply(result.msg);
      }
      break;

    // ═══════════════════════════════════════════
    //  BOT SETTINGS - Owner Only
    // ═══════════════════════════════════════════
    case "setting": case "settings":
      {
        if (!isOwner && sender !== ownerNumber) return reply("👑 *Khusus Owner!*");
        const key = args[0]?.toLowerCase();
        if (key === "reset") {
          botSettings.reset();
          return reply("🔄 *Settings di-reset ke default!*");
        }
        const all = botSettings.all();
        const labels = {
          autoread:   "Auto Read",
          autotyping: "Auto Typing",
          antispam:   "Anti Spam",
          gamemode:   "Game Mode",
          welcome:    "Welcome Message",
          selfmode:   "Self Mode",
        };
        const icons = { true: "🟢 ON", false: "🔴 OFF" };
        let txt = `╔═══════════════════════╗\n║  ⚙️ *BOT SETTINGS*\n╠═══════════════════════╣\n`;
        for (const [k, v] of Object.entries(all)) {
          txt += `║ ${icons[v]} *${labels[k] || k}*\n`;
        }
        txt += `╠═══════════════════════╣\n║ 👑 Owner Only\n║ Ketik .set <key> toggle\n║ .set reset → reset all\n╚═══════════════════════╝`;
        await sock.sendMessage(m.chat, {
          image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
          caption: txt,
          footer: `© ${setting.name}`,
          interactiveButtons: [
            singleSelectButton("⚙️ Toggle Setting", [
              {
                title: "Pilih Setting",
                rows: [
                  { title: "🔄 Auto Read", description: `${icons[all.autoread]}`, id: `${prefix}set autoread` },
                  { title: "💬 Auto Typing", description: `${icons[all.autotyping]}`, id: `${prefix}set autotyping` },
                  { title: "🚫 Anti Spam", description: `${icons[all.antispam]}`, id: `${prefix}set antispam` },
                  { title: "🎮 Game Mode", description: `${icons[all.gamemode]}`, id: `${prefix}set gamemode` },
                  { title: "👋 Welcome", description: `${icons[all.welcome]}`, id: `${prefix}set welcome` },
                  { title: "🔒 Self Mode", description: `${icons[all.selfmode]}`, id: `${prefix}set selfmode` },
                  { title: "🔄 Auto Update", description: `${icons[all.autoupdate]}`, id: `${prefix}set autoupdate` },
                ]
              }
            ])
          ]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    // ─── Group Tools ───
    case "kick": case "tendang":
      if (!isGroup) return reply("❌ Khusus di grup!");
      if (!isOwner && !isBotGroupAdmins) return reply("❌ Bot bukan admin!");
      {
        const target = m.quoted ? m.quoted.sender : args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null;
        if (!target) return reply("👤 Reply pesan atau masukkan nomor target!");
        try {
          await sock.groupParticipantsUpdate(m.chat, [target], "remove");
          reply("✅ *Berhasil dikick!*");
        } catch { reply("❌ *Gagal kick!* Pastikan bot admin & target valid."); }
      }
      break;

    case "add": case "tambah":
      if (!isGroup) return reply("❌ Khusus di grup!");
      if (!isOwner && !isBotGroupAdmins) return reply("❌ Bot bukan admin!");
      {
        const rawNum = args[0]?.replace(/[^0-9]/g, "");
        if (!rawNum) return reply("👤 Masukkan nomor target!\nContoh: .add 628xxx");
        const target = rawNum + "@s.whatsapp.net";
        try {
          await sock.groupParticipantsUpdate(m.chat, [target], "add");
          reply("✅ *Berhasil ditambahkan!*");
        } catch { reply("❌ *Gagal menambahkan!* Pastikan nomor valid."); }
      }
      break;

    case "promote": case "jadimin":
      if (!isGroup) return reply("❌ Khusus di grup!");
      if (!isOwner && !isBotGroupAdmins) return reply("❌ Bot bukan admin!");
      {
        const target = m.quoted ? m.quoted.sender : args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null;
        if (!target) return reply("👤 Reply pesan atau masukkan nomor target!");
        try {
          await sock.groupParticipantsUpdate(m.chat, [target], "promote");
          reply("✅ *Berhasil jadi admin!*");
        } catch { reply("❌ *Gagal promote!*"); }
      }
      break;

    case "demote": case "jadiin":
      if (!isGroup) return reply("❌ Khusus di grup!");
      if (!isOwner && !isBotGroupAdmins) return reply("❌ Bot bukan admin!");
      {
        const target = m.quoted ? m.quoted.sender : args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null;
        if (!target) return reply("👤 Reply pesan atau masukkan nomor target!");
        try {
          await sock.groupParticipantsUpdate(m.chat, [target], "demote");
          reply("✅ *Berhasil jadi member!*");
        } catch { reply("❌ *Gagal demote!*"); }
      }
      break;

    case "tagall": case "everyone":
      if (!isGroup) return reply("❌ Khusus di grup!");
      if (!isOwner && !isBotGroupAdmins) return reply("❌ Bot bukan admin!");
      {
        const meta = await getCachedMeta(sock, m.chat);
        const members = meta.participants.map(p => p.id);
        const txt = q ? `📢 *PENGUMUMAN*\n\n${q}\n\n` : "📢 *TAG ALL*\n\n";
        await sock.sendMessage(m.chat, {
          text: txt + members.map(jid => `@${jid.split("@")[0]}`).join(" "),
          mentions: members
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "hidetag":
      if (!isGroup) return reply("❌ Khusus di grup!");
      if (!isOwner && !isBotGroupAdmins) return reply("❌ Bot bukan admin!");
      {
        if (!q) return reply("📝 Masukkan teks untuk hidetag!");
        const meta = await getCachedMeta(sock, m.chat);
        const members = meta.participants.map(p => p.id);
        await sock.sendMessage(m.chat, {
          text: q,
          mentions: members
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    default:
      validCmd = false;
      // ─── API Commands ───
      const apiCmds = {
        artinama: ['artinama', '🔮', true],
        tafsirmimpi: ['tafsirmimpi', '🔮', true],
        zodiak: ['zodiak', '🔮', true],
        nomorhoki: ['nomorhoki', '🔮', true],
        cekpenyakit: ['cekpenyakit', '🔮', true],
        cocoknama: ['cocoknama', '🔮', true],
        rejekiweton: ['rejekiweton', '🔮', true],
        gemini: ['gemini', '🤖', true],
        deepseek: ['deepseek', '🤖', true],
        duckai: ['duckai', '🤖', true],
        duckimg: ['duckimg', '🤖', true],
        gptoss: ['gptoss', '🤖', true],
        metaai: ['metaai', '🤖', true],
        llama: ['llama', '🤖', true],
        ttdl: ['ttdl', '⬇️', true],
        igdl: ['igdl', '⬇️', true],
        ytdl: ['ytdl', '⬇️', true],
        fbdl: ['fbdl', '⬇️', true],
        twdl: ['twdl', '⬇️', true],
        spdl: ['spdl', '⬇️', true],
        scdl2: ['scdl2', '⬇️', true],
        pindl: ['pindl', '⬇️', true],
        ccdl: ['ccdl', '⬇️', true],
        tebakgambar: ['tebakgambar', '🎮'],
        caklontong: ['caklontong', '🎮'],
        family100: ['family100', '🎮'],
        tebakbendera: ['tebakbendera', '🎮'],
        tebakkata: ['tebakkata', '🎮'],
        tebaklagu: ['tebaklagu', '🎮'],
        susunkata: ['susunkata', '🎮'],
        asahotak: ['asahotak', '🎮'],
        cnn: ['cnn', '📰'],
        cnbc: ['cnbc', '📰'],
        antara: ['antara', '📰'],
        kompas: ['kompas', '📰'],
        liputan6: ['liputan6', '📰'],
        tribun: ['tribun', '📰'],
        brat: ['brat', '🎨', true],
        blur: ['blur', '🎨', true],
        greyscale: ['greyscale', '🎨', true],
        invert: ['invert', '🎨', true],
        duck: ['duck', '🔍', true],
        brave: ['brave', '🔍', true],
        ytsearch2: ['ytsearch2', '🔍', true],
        ttsearch2: ['ttsearch2', '🔍', true],
        igsearch: ['igsearch', '🔍', true],
        ghsearch: ['ghsearch', '🔍', true],
        igstalk2: ['igstalk2', '👀', true],
        ttstalk: ['ttstalk', '👀', true],
        twstalk: ['twstalk', '👀', true],
        ghstalk2: ['ghstalk2', '👀', true],
        cuaca2: ['cuaca2', 'ℹ️', true],
        bmkg: ['bmkg', 'ℹ️'],
        jadwaltv: ['jadwaltv', 'ℹ️'],
        ss: ['ss', '🛠️', true],
        rwaifu: ['rwaifu', '🎲'],
        rneko: ['rneko', '🎲'],
        rmeme: ['rmeme', '🎲'],
        rjoke: ['rjoke', '🎲'],
        rquote: ['rquote', '🎲'],
      }
      const api = apiCmds[cmdName]
      if (api) {
        validCmd = true
        const [fn, emoji, needsInput] = api
        if (needsInput && !q) return reply(`${emoji} Masukkan input!\nContoh: .${cmdName} value`)
        try {
          await m.react('⏳')
          const result = needsInput ? await scrape[fn](q) : await scrape[fn]()
          if (result.type === 'image') {
            await sock.sendMessage(m.chat, {
              image: { url: result.url },
              caption: result.caption || `${emoji} ${cmdName}`
            }, { quoted: m })
            if (result.answer) {
              await sock.sendMessage(m.chat, {
                text: `🔑 *Jawaban:* ||${result.answer}||`
              }, { quoted: m })
            }
          } else if (result.type === 'audio') {
            await sock.sendMessage(m.chat, {
              audio: { url: result.url },
              mimetype: 'audio/mpeg',
              ptt: false
            }, { quoted: m })
            if (result.caption) await reply(result.caption)
            if (result.answer) {
              await sock.sendMessage(m.chat, {
                text: `🔑 *Jawaban:* ||${result.answer}||`
              }, { quoted: m })
            }
          } else {
            let txt = result.text || kv(result.data) || ''
            if (!txt) return reply('❌ *Response tidak valid dari API*')
            await reply(txt.slice(0, 4000))
            if (result.answer) {
              await sock.sendMessage(m.chat, {
                text: `🔑 *Jawaban:* ||${result.answer}||`
              }, { quoted: m })
            }
          }
          await m.react('✅')
        } catch (e) {
          await m.react('❌')
          reply(`❌ Gagal: ${e.message}`)
        }
      }
      if (isCmd) log.unregistered(pushname);
      break; 
  }

  // ─── Add XP after successful command ───
  if (validCmd) {
    const xpResult = db.addRandomXp(sender);
    if (xpResult?.leveledUp) {
      const tier = xpResult.tier;
      await sock.sendMessage(m.chat, {
        text: `🎉 *LEVEL UP!*\n\n${tier.badge} *${pushname}* naik ke *Level ${xpResult.newLevel}*!\nTier: *${tier.name}* (${tier.symbol})\n\nSelamat! Terus bermain! 🚀`
      }, { ephemeralExpiration: m.contextInfo?.expiration });
    }
  }
  } catch (err) {
    log.error(err.message || err);
  }
};

export { msgHandler };
export default {
  msgHandler,
};
