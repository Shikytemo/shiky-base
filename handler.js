import {
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  getContentType,
  Browsers,
  urlButton,
  singleSelectButton
} from "shileys";
import moment from "moment-timezone";
import anyAscii from "any-ascii";
import Pino from "pino";
import axios from "axios";

import { msgFilter } from "./lib/utils.js";
import { catboxUpload, tiktokDl, snapDl } from "./lib/scrape/index.js";
import log from "./lib/logger.js";
import db from "./lib/database.js";
import game from "./lib/game.js";
import botSettings from "./lib/botSettings.js";
import { search, download, playSong, formatSearch } from "./lib/spotify.js";

import setting from "./setting.js";
moment.tz.setDefault("Asia/Jakarta").locale("id");

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
    ? await sock.groupMetadata(m.chat)
    : {};
    const isGroup = m.isGroup;
    let sender = m.key.addressingMode === "pn" ? m.sender : m.key.remoteJidAlt;

    // LID / PN sender detection
    if (isGroup) {
      if (m.key.addressingMode === "pn") {
        sender = m.sender;
      } else {
        sender = m.key.participantAlt;
      }
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
          const listBlocked = await sock.fetchBlocklist()
        const isBlocked = listBlocked.includes(sender)
        if (isBlocked) return; 
    }

    if (isCmd && msgFilter.isFiltered(m.chat) && botSettings.get("antispam")) {
      return log.spam(command, args.length, pushname, isGroup ? groupName : "");
    }
     
    if (!isCmd) return;
    log.exec(command, args.length, pushname, isGroup ? groupName : "");
    
    if (botSettings.get("autoread")) await sock.readMessages([m.key]); // Auto read

    const reply = (text) => sock.sendMessage(m.chat, {
      text,
      footer: `© ${setting.name}`,
      interactiveButtons: [urlButton("GitHub", "https://github.com/shikytemo")]
    }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });

    // fitur
  let validCmd = true;
  switch (cmdName) {
    case "menu":
      {
      const p = db.getProfile(sender);
      const tier = p ? p.tier : db.getTier(1);
      const xpBar = p ? p.xpBar : "░░░░░░░░░░";
      const maxLim = p ? p.maxLimit : 25;
      const menuText = `Halo *${pushname}* 👋\n\n` +
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
        `│ *Limit:* ${p ? (p.limit >= 99999 || p.limit == null ? "♾️" : p.limit) : 25}/${maxLim}\n` +
        `│ *Total Cmd:* ${p ? p.totalCmd : 0}\n` +
        `└─────────────────\n\n` +
        `_Pilih menu di bawah ini:_`;
      await sock.sendMessage(m.chat, {
        image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
        title: setting.name,
        text: menuText,
        footer: `© ${setting.name} | ${moment().format("DD/MM/YYYY HH:mm:ss")}`,
        interactiveButtons: [
          urlButton("GitHub", "https://github.com"),
          singleSelectButton("📋 All Commands", [
            {
              title: "All Commands",
              rows: [
                { title: "🏓 Ping", description: "Cek kecepatan respon bot", id: `${prefix}ping` },
                { title: "💬 Say", description: "Bot mengirim ulang teks kamu", id: `${prefix}say` },
                { title: "🎨 Sticker", description: "Bikin stiker dari foto/video", id: `${prefix}s` },
                { title: "📸 Resend", description: "Kirim ulang gambar/video", id: `${prefix}resend` },
                { title: "📎 ToURL", description: "Upload media ke catbox.moe", id: `${prefix}tourl` },
                { title: "🎵 TikTok", description: "Download video/foto/sound TikTok", id: `${prefix}tt` },
                { title: "🎶 TT Sound", description: "Download audio TikTok saja", id: `${prefix}ttsound` },
                { title: "📘 Facebook", description: "Download video/foto Facebook", id: `${prefix}fb` },
                { title: "📷 Instagram", description: "Download video/foto Instagram", id: `${prefix}ig` },
                { title: "🐦 Twitter/X", description: "Download video/foto Twitter", id: `${prefix}tw` },
                { title: "🎵 YT Search", description: "Cari lagu di YouTube Music", id: `${prefix}yts` },
                { title: "💚 Spotify DL", description: "Download lagu Spotify", id: `${prefix}spdl` },
                { title: "🪪 Profile", description: "Lihat kartu profil & tier kamu", id: `${prefix}profile` },
                { title: "📊 Level", description: "Cek level & XP kamu", id: `${prefix}level` },
                { title: "🎁 Daily", description: "Klaim hadiah harian", id: `${prefix}daily` },
                { title: "🏆 Leaderboard", description: "Top 10 pemain", id: `${prefix}lb` },
                { title: "🏅 Tier List", description: "Lihat semua tier", id: `${prefix}tier` },
                { title: "💰 Balance", description: "Cek uang kamu", id: `${prefix}bal` },
                { title: "💸 Transfer", description: "Kirim uang ke pemain lain", id: `${prefix}transfer` },
                { title: "📶 Limit", description: "Cek sisa limit harian", id: `${prefix}limit` },
                { title: "⚔️ Battle", description: "Lawan monster! (interaktif)", id: `${prefix}battle` },
                { title: "🏹 Hunt", description: "Berburu item & gold", id: `${prefix}hunt` },
                { title: "💚 Heal", description: "Pulihkan HP dengan potion", id: `${prefix}heal` },
                { title: "📦 Inventory", description: "Lihat item kamu", id: `${prefix}inv` },
                { title: "🏪 Shop", description: "Beli potion & equipment", id: `${prefix}shop` },
                { title: "📢 Tag All", description: "Tag semua member grup", id: `${prefix}tagall` },
                { title: "👤 Kick", description: "Kick member dari grup", id: `${prefix}kick` },
                { title: "⚙️ Settings", description: "Owner only", id: `${prefix}setting` },
              ]
            }
          ])
        ]
      }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;
    case "ping": case "test": case "tes":
      await reply(`🏓 *Pong!*\n\n⚡ Speed: ${Date.now() - t * 1000} ms`);
      break;
      case "say":
    if (!q) return reply("📝 Masukkan teks!");
    await reply(`💬 ${q}`);
    break;
    case "s": case "stiker": case "sticker":
      if (!isImage && !isVideo && !isQuotedImage && !isQuotedVideo) return reply("📸 Kirim atau reply foto/video untuk dijadikan stiker!");
      try {
        await m.react("⏳");
        const mediaMsg = isQuotedImage || isQuotedVideo ? { message: quotedMsg.message } : { message: m.message };
        const buffer = await downloadMediaMessage(mediaMsg, "buffer", {}, { Pino, reuploadRequest: sock.updateMediaMessage });
        await sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        await m.react("✅");
      } catch (err) {
        console.log(err);
        await m.react("❌");
        reply("❌ *Gagal membuat stiker!*");
      }
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
        reply("❌ *Gagal download TikTok!* Pastikan link valid.");
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
        reply("❌ *Gagal download video TikTok!*");
      }
      break;
    case "ttsound": case "ttaudio": case "ttmusic":
      if (!q) return reply("🔗 Masukkan link TikTok!\n\nContoh: .ttsound https://vt.tiktok.com/xxx");
      try {
        await m.react("⏳");
        const tt2 = await tiktokDl(q);
        if (!tt2.music.url) {
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
    case "fb": case "facebook":
    case "ig": case "instagram":
    case "tw": case "twitter":
      {
        const platformMap = {
          fb: "Facebook", facebook: "Facebook",
          ig: "Instagram", instagram: "Instagram",
          tw: "Twitter/X", twitter: "Twitter/X"
        };
        const cmdName = command.replace(/^[.#!/]/, "");
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
          reply(`❌ *Gagal download ${platName}!* Pastikan link valid.`);
        }
      }
      break;

    // ═══════════════════════════════════════════
    //  SPOTIFY - Search & Download
    // ═══════════════════════════════════════════
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
        db._save();
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
        const tiers = [
          { min: 1, max: 10, name: "Novice Wanderer", sym: "I", badge: "🌑" },
          { min: 11, max: 25, name: "Shadow Apprentice", sym: "II", badge: "🌘" },
          { min: 26, max: 50, name: "Iron Warrior", sym: "III", badge: "⚔️" },
          { min: 51, max: 75, name: "Arcane Knight", sym: "IV", badge: "🛡️" },
          { min: 76, max: 100, name: "Phantom Guardian", sym: "V", badge: "👻" },
          { min: 101, max: 150, name: "Mythic Overlord", sym: "VI", badge: "🔱" },
          { min: 151, max: 200, name: "Legendary Sovereign", sym: "VII", badge: "👑" },
          { min: 201, max: 999, name: "Celestial Emperor", sym: "VIII", badge: "🌟" },
        ];
        for (const t of tiers) {
          const current = db.getTier(db.getUser(sender)?.level || 1);
          const isCurrent = current.name === t.name ? " ◄ YOU" : "";
          txt += `║ ${t.badge} *Tier ${t.sym}*${isCurrent}\n║ ${t.name}\n║ Level ${t.min} - ${t.max}\n║ ─────────────────\n`;
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
          txt += `${i + 1}. ${u.name} - ${db._roleDisplay(u.role)}\n`;
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
        if (result.view) {
          await sock.sendMessage(m.chat, {
            image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
            caption: result.text,
            footer: `⚔️ Turn ${result.monster ? 1 : "?"} | ${setting.name}`,
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
      }
      break;

    case "attack": case "atk":
      {
        const result = game.battleAction(sender, "attack");
        if (result.error) return reply(result.error);
        if (result.end) { game.afterBattle(sender); return reply(result.msg); }
        if (result.view) {
          await sock.sendMessage(m.chat, {
            image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
            caption: result.text,
            footer: `⚔️ Battle | ${setting.name}`,
            interactiveButtons: [
              singleSelectButton("⚔️ Pilih Aksi", [
                {
                  title: "Battle Actions",
                  rows: [
                    { title: "⚔️ Attack", description: "Serangan normal", id: `${prefix}attack` },
                    { title: "💥 Skill", description: "Critical hit!", id: `${prefix}skill` },
                    { title: "🛡️ Defend", description: "Bertahan", id: `${prefix}defend` },
                    { title: "🏃 Flee", description: "Kabur (50%)", id: `${prefix}flee` },
                  ]
                }
              ])
            ]
          }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        }
      }
      break;

    case "skill":
      {
        const result = game.battleAction(sender, "skill");
        if (result.error) return reply(result.error);
        if (result.end) { game.afterBattle(sender); return reply(result.msg); }
        if (result.view) {
          await sock.sendMessage(m.chat, {
            image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
            caption: result.text,
            footer: `⚔️ Battle | ${setting.name}`,
            interactiveButtons: [
              singleSelectButton("⚔️ Pilih Aksi", [
                {
                  title: "Battle Actions",
                  rows: [
                    { title: "⚔️ Attack", description: "Serangan normal", id: `${prefix}attack` },
                    { title: "💥 Skill", description: "Critical hit!", id: `${prefix}skill` },
                    { title: "🛡️ Defend", description: "Bertahan", id: `${prefix}defend` },
                    { title: "🏃 Flee", description: "Kabur (50%)", id: `${prefix}flee` },
                  ]
                }
              ])
            ]
          }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        }
      }
      break;

    case "defend": case "def":
      {
        const result = game.battleAction(sender, "defend");
        if (result.error) return reply(result.error);
        if (result.end) { game.afterBattle(sender); return reply(result.msg); }
        if (result.view) {
          await sock.sendMessage(m.chat, {
            image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
            caption: result.text,
            footer: `⚔️ Battle | ${setting.name}`,
            interactiveButtons: [
              singleSelectButton("⚔️ Pilih Aksi", [
                {
                  title: "Battle Actions",
                  rows: [
                    { title: "⚔️ Attack", description: "Serangan normal", id: `${prefix}attack` },
                    { title: "💥 Skill", description: "Critical hit!", id: `${prefix}skill` },
                    { title: "🛡️ Defend", description: "Bertahan", id: `${prefix}defend` },
                    { title: "🏃 Flee", description: "Kabur (50%)", id: `${prefix}flee` },
                  ]
                }
              ])
            ]
          }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
        }
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
                ]
              }
            ])
          ]
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    case "set":
      {
        if (!isOwner && sender !== ownerNumber) return reply("👑 *Khusus Owner!*");
        const key = args[0]?.toLowerCase();
        if (key === "reset") {
          botSettings.reset();
          return reply("🔄 *Settings di-reset ke default!*");
        }
        if (key) {
          const valid = ["autoread", "autotyping", "antispam", "gamemode", "welcome", "selfmode"];
          if (!valid.includes(key)) return reply(`❌ Key tidak valid!\n\nValid: ${valid.join(", ")}`);
          const newVal = botSettings.toggle(key);
          const labels = { autoread: "Auto Read", autotyping: "Auto Typing", antispam: "Anti Spam", gamemode: "Game Mode", welcome: "Welcome Message", selfmode: "Self Mode" };
          return reply(`⚙️ *${labels[key]}* → ${newVal ? "🟢 ON" : "🔴 OFF"}`);
        }
        // No key → show select button
        const all = botSettings.all();
        const labels = {
          autoread: "Auto Read", autotyping: "Auto Typing", antispam: "Anti Spam",
          gamemode: "Game Mode", welcome: "Welcome Message", selfmode: "Self Mode",
        };
        const icons = { true: "🟢", false: "🔴" };
        await sock.sendMessage(m.chat, {
          image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
          caption: `⚙️ *BOT SETTINGS*\n\nPilih setting untuk toggle ON/OFF:`,
          footer: `© ${setting.name}`,
          interactiveButtons: [
            singleSelectButton("⚙️ Toggle Setting", [
              {
                title: "Settings",
                rows: [
                  { title: `${icons[all.autoread]} Auto Read`, description: "Auto read messages", id: `${prefix}set autoread` },
                  { title: `${icons[all.autotyping]} Auto Typing`, description: "Auto typing indicator", id: `${prefix}set autotyping` },
                  { title: `${icons[all.antispam]} Anti Spam`, description: "Cooldown spam filter", id: `${prefix}set antispam` },
                  { title: `${icons[all.gamemode]} Game Mode`, description: "Battle & hunt features", id: `${prefix}set gamemode` },
                  { title: `${icons[all.welcome]} Welcome`, description: "Welcome new members", id: `${prefix}set welcome` },
                  { title: `${icons[all.selfmode]} Self Mode`, description: "Only owner can use", id: `${prefix}set selfmode` },
                  { title: "🔄 Reset All", description: "Kembalikan ke default", id: `${prefix}set reset` },
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
        const target = m.quoted ? m.quoted.sender : args[0] ? args[0] + "@s.whatsapp.net" : null;
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
        const target = args[0] ? args[0] + "@s.whatsapp.net" : null;
        if (!target) return reply("👤 Masukkan nomor target!\nContoh: .add 628xxx");
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
        const target = m.quoted ? m.quoted.sender : args[0] ? args[0] + "@s.whatsapp.net" : null;
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
        const target = m.quoted ? m.quoted.sender : args[0] ? args[0] + "@s.whatsapp.net" : null;
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
        const meta = await sock.groupMetadata(m.chat);
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
        const meta = await sock.groupMetadata(m.chat);
        const members = meta.participants.map(p => p.id);
        await sock.sendMessage(m.chat, {
          text: q,
          mentions: members
        }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
      }
      break;

    default:
      validCmd = false;
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
