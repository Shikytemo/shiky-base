#!/usr/bin/env node
// ─── SHIKYTEMO Bot Manager CLI ───
import fs from "fs";
import path from "path";
import os from "os";
import { fork } from "child_process";
import readline from "readline";
import chalk from "chalk";
import moment from "moment-timezone";

moment.tz.setDefault("Asia/Jakarta").locale("id");

// ─── Paths ───
const ROOT = process.cwd();
const SESSIONS_DIR = path.join(ROOT, "sessions");
const BOTS_CONFIG = path.join(ROOT, "bots.json");

// ─── State ───
const bots = new Map();
let menuActive = false; // prevent bot output during menu

// ─── Icons ───
const ic = {
  arrow:   chalk.cyan("›"),
  right:   chalk.cyan("▸"),
  sel:     chalk.cyan("❯"),
  dot:     chalk.gray("·"),
  check:   chalk.green("✓"),
  cross:   chalk.red("✗"),
  warn:    chalk.yellow("!"),
  info:    chalk.cyan("i"),
  online:  chalk.green("●"),
  offline: chalk.red("●"),
  wait:    chalk.yellow("●"),
  play:    chalk.green("▶"),
  stop:    chalk.red("■"),
  reload:  chalk.yellow("↻"),
  pair:    chalk.magenta("⟡"),
  log:     chalk.blue("▪"),
  gear:    chalk.cyan("⚙"),
  link:    chalk.cyan("⇢"),
};

// ─── Spinner ───
const spinFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinTimer = null;
let spinIdx = 0;

function spinStart(msg) {
  spinIdx = 0;
  spinTimer = setInterval(() => {
    process.stdout.write(`\r  ${chalk.cyan(spinFrames[spinIdx])} ${chalk.gray(msg)}`);
    spinIdx = (spinIdx + 1) % spinFrames.length;
  }, 80);
}

function spinStop(msg, icon = ic.check) {
  if (spinTimer) {
    clearInterval(spinTimer);
    spinTimer = null;
    process.stdout.write(`\r  ${icon} ${msg}\n`);
  }
}

// ─── Helpers ───
const ts = () => chalk.gray(moment().format("HH:mm:ss"));
const divider = () => chalk.gray("─".repeat(42));
const clear = () => process.stdout.write("\x1Bc");

function loadBotsConfig() {
  if (!fs.existsSync(BOTS_CONFIG)) return [];
  try { return JSON.parse(fs.readFileSync(BOTS_CONFIG, "utf-8")); } catch { return []; }
}

function saveBotsConfig(list) {
  fs.writeFileSync(BOTS_CONFIG, JSON.stringify(list, null, 2));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function clog(icon, time, msg) {
  console.log(`  ${icon} ${time ? ts() + " " : ""}${msg}`);
}

// ─── Arrow Key Select Menu ───
function arrowSelect(title, items) {
  // fallback ke angka kalau bukan TTY
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    return new Promise((resolve) => {
      console.log();
      console.log(`  ${chalk.cyan.bold(title)}`);
      for (let i = 0; i < items.length; i++) {
        console.log(`  ${chalk.cyan(i + 1)}. ${chalk.white(items[i].label)} ${chalk.gray(items[i].desc || "")}`);
      }
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`  ${ic.arrow} Pilih (1-${items.length}): `, (ans) => {
        rl.close();
        const idx = parseInt(ans) - 1;
        resolve(items[idx] || null);
      });
    });
  }

  return new Promise((resolve) => {
    menuActive = true;
    let selected = 0;
    const total = items.length;

    function render() {
      process.stdout.write(`\x1B[${total + 2}A`);
      console.log();
      console.log(`  ${chalk.cyan.bold(title)} ${chalk.gray("↑↓ pilih  enter konfirmasi")}`);
      for (let i = 0; i < total; i++) {
        const prefix = i === selected ? ic.sel : " ";
        const label = i === selected
          ? chalk.cyan.bold(items[i].label)
          : chalk.white(items[i].label);
        const desc = items[i].desc ? chalk.gray(` ${items[i].desc}`) : "";
        console.log(`  ${prefix} ${label}${desc}`);
      }
    }

    // initial render
    console.log();
    console.log(`  ${chalk.cyan.bold(title)} ${chalk.gray("↑↓ pilih  enter konfirmasi")}`);
    for (let i = 0; i < total; i++) {
      const prefix = i === selected ? ic.sel : " ";
      const label = i === selected
        ? chalk.cyan.bold(items[i].label)
        : chalk.white(items[i].label);
      const desc = items[i].desc ? chalk.gray(` ${items[i].desc}`) : "";
      console.log(`  ${prefix} ${label}${desc}`);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKey = (key) => {
      const s = key.toString();
      if (s === "\x1B[A" || s === "k") { // up
        selected = (selected - 1 + total) % total;
        render();
      } else if (s === "\x1B[B" || s === "j") { // down
        selected = (selected + 1) % total;
        render();
      } else if (s === "\r" || s === "\n") { // enter
        process.stdin.removeListener("data", onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        menuActive = false;
        console.log();
        resolve(items[selected]);
      } else if (s === "\x03") { // ctrl-c
        process.stdin.removeListener("data", onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        menuActive = false;
        console.log();
        for (const [n] of bots) stopBot(n);
        process.exit(0);
      } else if (s === "\x1B" || s === "q") { // esc/q = back
        process.stdin.removeListener("data", onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        menuActive = false;
        console.log();
        resolve(null);
      }
    };

    process.stdin.on("data", onKey);
  });
}

// ─── Arrow Key Input (for text questions) ───
function askInput(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${ic.arrow} ${question} `, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// ─── Server Info ───
function showServerInfo() {
  const upSec = os.uptime();
  const h = Math.floor(upSec / 3600);
  const m = Math.floor((upSec % 3600) / 60);
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(1);
  const memPct = Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100);
  const cpuCount = os.cpus().length || 1;
  const cpuModel = os.cpus()[0]?.model || os.arch();
  const nodeVer = process.version;
  const plat = `${os.arch()} ${os.type()}`;
  const botsList = loadBotsConfig();
  const sessionCount = fs.existsSync(SESSIONS_DIR) ? fs.readdirSync(SESSIONS_DIR).filter(f => fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()).length : 0;

  let settingName = "SHIKYTEMO";
  try {
    const s = fs.readFileSync(path.join(ROOT, "setting.js"), "utf-8");
    const nm = s.match(/name:\s*"([^"]+)"/);
    if (nm) settingName = nm[1];
  } catch {}

  const barLen = 15;
  const filled = Math.round(barLen * memPct / 100);
  const memBar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(barLen - filled));

  console.log();
  console.log(`  ${chalk.cyan.bold(settingName)} ${chalk.gray("Bot Manager")}`);
  console.log(divider());
  console.log(`  ${ic.right} ${chalk.cyan("os")}   ${chalk.white(plat)}`);
  console.log(`  ${ic.right} ${chalk.cyan("cpu")}  ${chalk.white(cpuModel)} ${chalk.gray(`(${cpuCount})`)}`);
  console.log(`  ${ic.right} ${chalk.cyan("mem")}  ${memBar} ${chalk.white(`${usedMem}/${totalMem}G`)}`);
  console.log(`  ${ic.right} ${chalk.cyan("node")} ${chalk.white(nodeVer)}`);
  console.log(`  ${ic.right} ${chalk.cyan("up")}   ${chalk.white(`${h}h ${m}m`)}`);
  console.log(`  ${ic.right} ${chalk.cyan("bots")} ${chalk.white(botsList.length)} ${chalk.gray(`(${sessionCount} sessions)`)}`);
  console.log(`  ${ic.right} ${chalk.cyan("time")} ${chalk.white(moment().format("DD/MM/YY HH:mm:ss"))}`);
  console.log(divider());
}

// ─── Bot Process Manager ───
function startBot(botConfig) {
  const { name, phoneNumber, pairingCode, sessionDir } = botConfig;
  if (bots.has(name) && bots.get(name).proc) {
    clog(ic.warn, true, `Bot ${chalk.cyan(name)} sudah berjalan`);
    return;
  }

  ensureDir(sessionDir);

  const proc = fork(path.join(ROOT, "bot-worker.js"), [], {
    env: {
      ...process.env,
      BOT_NAME: name,
      BOT_PHONE: phoneNumber,
      BOT_PAIRING: pairingCode || "",
      BOT_SESSION_DIR: sessionDir,
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    },
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    silent: true,
  });

  const logDir = path.join(ROOT, "logs");
  ensureDir(logDir);
  const logFile = path.join(logDir, `${name}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  const botSpin = { timer: null, idx: 0 };
  botSpin.timer = setInterval(() => {
    const entry = bots.get(name);
    if (entry?.status === "connecting" && !menuActive) {
      process.stdout.write(`\r  ${chalk.cyan(spinFrames[botSpin.idx])} ${chalk.gray(`${name} connecting...`)}`);
      botSpin.idx = (botSpin.idx + 1) % spinFrames.length;
    }
  }, 80);

  proc.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line) {
      logStream.write(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] ${line}\n`);
      if (!line.includes("Connecting") && !line.includes("Cache cleared") && !menuActive) {
        process.stdout.write(`\r  ${ic.log} ${chalk.gray(`[${name}]`)} ${line}\n`);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const line = data.toString().trim();
    if (line && !line.includes("SessionEntry") && !line.includes("Closing session") && !line.includes("preKeyId") && !line.includes("libsignal")) {
      logStream.write(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] ERR: ${line}\n`);
    }
  });

  proc.on("exit", (code) => {
    if (botSpin.timer) clearInterval(botSpin.timer);
    logStream.end();
    const entry = bots.get(name);
    if (entry) entry.status = "stopped";
    if (!menuActive) process.stdout.write(`\r  ${ic.cross} ${ts()} ${chalk.red(`${name} stopped`)} ${chalk.gray(`(code: ${code})`)}\n`);
  });

  proc.on("message", (msg) => {
    if (msg.type === "connected") {
      if (botSpin.timer) clearInterval(botSpin.timer);
      const entry = bots.get(name);
      if (entry) entry.status = "connected";
      if (!menuActive) process.stdout.write(`\r  ${ic.check} ${ts()} ${chalk.green(`${name} connected`)} ${ic.link} ${chalk.white(msg.number)}\n`);
    } else if (msg.type === "pairing") {
      if (botSpin.timer) clearInterval(botSpin.timer);
      if (!menuActive) process.stdout.write(`\r  ${ic.pair} ${chalk.magenta(`${name} pairing`)} ${ic.arrow} ${chalk.white.bold(msg.code)}\n`);
    } else if (msg.type === "disconnected") {
      if (botSpin.timer) clearInterval(botSpin.timer);
      const entry = bots.get(name);
      if (entry) entry.status = "disconnected";
      if (!menuActive) process.stdout.write(`\r  ${ic.warn} ${ts()} ${chalk.yellow(`${name} disconnected`)} ${chalk.gray(`(${msg.reason})`)}\n`);
      botSpin.timer = setInterval(() => {
        const e = bots.get(name);
        if (e?.status === "disconnected") {
          e.status = "connecting";
          if (!menuActive) process.stdout.write(`\r  ${chalk.cyan(spinFrames[botSpin.idx])} ${chalk.gray(`${name} reconnecting...`)}`);
          botSpin.idx = (botSpin.idx + 1) % spinFrames.length;
        }
      }, 80);
    }
  });

  bots.set(name, { proc, config: botConfig, status: "connecting", startedAt: Date.now() });
  clog(ic.play, true, `${chalk.green("Starting")} ${chalk.cyan(name)} ${ic.arrow} ${chalk.gray(phoneNumber)}`);
}

function stopBot(name) {
  const entry = bots.get(name);
  if (!entry || !entry.proc) {
    clog(ic.warn, false, `Bot ${chalk.cyan(name)} tidak aktif`);
    return;
  }
  entry.proc.kill("SIGTERM");
  entry.status = "stopped";
  entry.proc = null;
  clog(ic.stop, true, `${chalk.red("Stopped")} ${chalk.cyan(name)}`);
}

function restartBot(name) {
  const entry = bots.get(name);
  if (!entry) {
    clog(ic.warn, false, `Bot ${chalk.cyan(name)} tidak ditemukan`);
    return;
  }
  clog(ic.reload, true, `${chalk.yellow("Restarting")} ${chalk.cyan(name)}...`);
  if (entry.proc) {
    entry.proc.kill("SIGTERM");
    entry.proc = null;
  }
  setTimeout(() => startBot(entry.config), 1500);
}

// ─── Bot Picker (arrow select from bot list) ───
async function pickBot(action) {
  const botsList = loadBotsConfig();
  if (botsList.length === 0) {
    clog(ic.warn, false, "Tidak ada bot");
    return null;
  }
  if (botsList.length === 1) return botsList[0];

  const items = botsList.map(b => {
    const running = bots.get(b.name);
    const status = running?.status === "connected" ? chalk.green("on") : running?.status === "connecting" ? chalk.yellow("...") : chalk.red("off");
    return { label: b.name, desc: `${b.phoneNumber} [${status}]`, value: b };
  });

  const picked = await arrowSelect(`Pilih bot untuk ${action}:`, items);
  return picked?.value || null;
}

// ─── Actions ───
async function addBot() {
  console.log();
  console.log(`  ${ic.gear} ${chalk.cyan.bold("Tambah Bot Baru")}`);
  console.log(`  ${chalk.gray("─".repeat(30))}`);
  const name = await askInput("Nama bot:");
  if (!name) { clog(ic.cross, false, chalk.red("Nama kosong")); return; }
  const phoneNumber = await askInput("Nomor HP (628xxx):");
  if (!phoneNumber) { clog(ic.cross, false, chalk.red("Nomor kosong")); return; }
  const pairingCode = await askInput("Pairing code (kosong=random):");

  const botsList = loadBotsConfig();
  if (botsList.find(b => b.name === name)) {
    clog(ic.cross, false, `Bot ${chalk.cyan(name)} sudah ada`);
    return;
  }

  const sessionDir = path.join(SESSIONS_DIR, name);
  const botConfig = { name, phoneNumber, pairingCode: pairingCode || "", sessionDir };
  botsList.push(botConfig);
  saveBotsConfig(botsList);
  ensureDir(sessionDir);

  clog(ic.check, false, `Bot ${chalk.cyan(name)} ditambahkan`);

  const yn = await arrowSelect("Start sekarang?", [
    { label: "Ya", desc: "start bot" },
    { label: "Nanti", desc: "kembali ke menu" },
  ]);
  if (yn?.label === "Ya") startBot(botConfig);
}

async function setupOwner() {
  console.log();
  console.log(`  ${ic.gear} ${chalk.cyan.bold("Setup")}`);
  console.log(`  ${chalk.gray("─".repeat(30))}`);

  let setting;
  try {
    const mod = await import("./setting.js");
    setting = mod.default;
  } catch {
    setting = { name: "SHIKYTEMO", owner: "" };
  }

  console.log(`  ${ic.info} nama  : ${chalk.cyan(setting.name)}`);
  console.log(`  ${ic.info} owner : ${chalk.cyan(setting.owner)}`);
  console.log();
  const newName = await askInput("Nama bot baru (enter=skip):");
  const newOwner = await askInput("Owner number (enter=skip):");

  if (newName || newOwner) {
    const sName = newName || setting.name;
    const sOwner = newOwner || setting.owner;
    const content = `const setting = {\n    name: "${sName}",\n    owner: "${sOwner}",\n    admins: [],  // tambah nomor admin: ["628xxxx", "628xxxx"]\n};\n\nexport default setting;\n`;
    fs.writeFileSync(path.join(ROOT, "setting.js"), content);
    clog(ic.check, false, `Updated ${ic.arrow} name=${chalk.cyan(sName)} owner=${chalk.cyan(sOwner)}`);
  } else {
    clog(ic.dot, false, chalk.gray("Tidak ada perubahan"));
  }
}

function showBotList() {
  const botsList = loadBotsConfig();
  if (botsList.length === 0) {
    clog(ic.warn, false, `Belum ada bot`);
    return;
  }
  console.log();
  console.log(`  ${chalk.cyan.bold("Bots")}`);
  console.log(`  ${chalk.gray("─".repeat(38))}`);
  for (const b of botsList) {
    const running = bots.get(b.name);
    let badge;
    if (running?.status === "connected") badge = ic.online + " " + chalk.green("on ");
    else if (running?.status === "connecting") badge = ic.wait + " " + chalk.yellow("...");
    else badge = ic.offline + " " + chalk.red("off");
    const uptime = running?.startedAt && running?.status === "connected"
      ? chalk.gray(` ${Math.floor((Date.now() - running.startedAt) / 60000)}m`)
      : "";
    console.log(`  ${badge} ${chalk.white.bold(b.name)} ${chalk.gray(b.phoneNumber)}${uptime}`);
  }
  console.log();
}

async function showLogs() {
  const botsList = loadBotsConfig();
  if (botsList.length === 0) { clog(ic.warn, false, "Tidak ada bot"); return; }

  let name;
  if (botsList.length === 1) {
    name = botsList[0].name;
  } else {
    const items = botsList.map(b => ({ label: b.name, desc: b.phoneNumber }));
    const picked = await arrowSelect("Lihat log bot:", items);
    if (!picked) return;
    name = picked.label;
  }

  const logFile = path.join(ROOT, "logs", `${name}.log`);
  if (!fs.existsSync(logFile)) {
    clog(ic.warn, false, `Log ${chalk.cyan(name)} tidak ada`);
    return;
  }
  const lines = fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean);
  const last = lines.slice(-25);
  console.log();
  console.log(`  ${ic.log} ${chalk.cyan.bold(`Log: ${name}`)} ${chalk.gray(`(${last.length} lines)`)}`);
  console.log(`  ${chalk.gray("─".repeat(38))}`);
  for (const l of last) {
    console.log(`  ${ic.dot} ${chalk.gray(l)}`);
  }
  console.log();
}

function migrateOldSession() {
  const oldSession = path.join(ROOT, "session");
  if (!fs.existsSync(oldSession)) return;
  const creds = path.join(oldSession, "creds.json");
  if (!fs.existsSync(creds)) return;

  const botsList = loadBotsConfig();
  const existing = botsList.find(b => b.phoneNumber === "628385863327");
  if (existing) return;

  let phone = "628385863327";
  let pairing = "SHIKYBOT";
  try {
    const cfg = fs.readFileSync(path.join(ROOT, "config.js"), "utf-8");
    const pm = cfg.match(/phoneNumber:\s*"([^"]+)"/);
    const pc = cfg.match(/pairingCode:\s*"([^"]+)"/);
    if (pm) phone = pm[1];
    if (pc) pairing = pc[1];
  } catch {}

  const name = "main";
  const sessionDir = path.join(SESSIONS_DIR, name);
  ensureDir(sessionDir);

  const files = fs.readdirSync(oldSession);
  for (const f of files) {
    const src = path.join(oldSession, f);
    const dst = path.join(sessionDir, f);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, dst);
  }

  const botConfig = { name, phoneNumber: phone, pairingCode: pairing, sessionDir };
  botsList.push(botConfig);
  saveBotsConfig(botsList);
  clog(ic.check, false, `Migrasi session ${ic.arrow} bot ${chalk.cyan("main")} (${chalk.gray(phone)})`);
}

// ─── Main Menu Items ───
const MENU_ITEMS = [
  { label: "Start Bot",     desc: "jalankan bot",       action: "start" },
  { label: "Stop Bot",      desc: "matikan bot",        action: "stop" },
  { label: "Restart Bot",   desc: "restart bot",        action: "restart" },
  { label: "Start All",     desc: "jalankan semua",     action: "startall" },
  { label: "Stop All",      desc: "matikan semua",      action: "stopall" },
  { label: "Add Bot",       desc: "tambah bot baru",    action: "add" },
  { label: "Bot List",      desc: "daftar & status",    action: "list" },
  { label: "Logs",          desc: "lihat log bot",      action: "logs" },
  { label: "Setup",         desc: "owner & nama bot",   action: "setup" },
  { label: "Remove Bot",    desc: "hapus bot config",   action: "remove" },
  { label: "Server Info",   desc: "info server",        action: "info" },
  { label: "Clear",         desc: "bersihkan layar",    action: "clear" },
  { label: "Exit",          desc: "keluar",             action: "exit" },
];

async function handleAction(action) {
  switch (action) {
    case "start": {
      const bot = await pickBot("start");
      if (bot) startBot(bot);
      break;
    }
    case "stop": {
      const bot = await pickBot("stop");
      if (bot) stopBot(bot.name);
      break;
    }
    case "restart": {
      const bot = await pickBot("restart");
      if (bot) restartBot(bot.name);
      break;
    }
    case "startall": {
      const all = loadBotsConfig();
      if (all.length === 0) { clog(ic.warn, false, "Tidak ada bot"); break; }
      for (const b of all) startBot(b);
      break;
    }
    case "stopall":
      for (const [n] of bots) stopBot(n);
      break;
    case "add":
      await addBot();
      break;
    case "list":
      showBotList();
      break;
    case "logs":
      await showLogs();
      break;
    case "setup":
      await setupOwner();
      break;
    case "remove": {
      const bot = await pickBot("remove");
      if (bot) {
        stopBot(bot.name);
        bots.delete(bot.name);
        let bl = loadBotsConfig();
        bl = bl.filter(b => b.name !== bot.name);
        saveBotsConfig(bl);
        clog(ic.check, false, `${chalk.cyan(bot.name)} dihapus ${chalk.gray("(session aman)")}`);
      }
      break;
    }
    case "info":
      showServerInfo();
      break;
    case "clear":
      clear();
      showServerInfo();
      break;
    case "exit": {
      spinStart("Shutting down...");
      for (const [n] of bots) stopBot(n);
      await new Promise(r => setTimeout(r, 1000));
      spinStop(chalk.gray("Goodbye"), ic.check);
      process.exit(0);
      return false;
    }
  }
  return true;
}

// ─── Fun Facts / Tips ───
const FACTS = [
  "Script ini punya 7,900+ baris kode, ditulis dari HP. Gila.",
  "Ada 250 command unik di handler.js. Lebih banyak dari kebanyakan bot premium.",
  "52 file scraper di lib/scrape/tools/ — koleksi API gratis terlengkap.",
  "handler.js sendiri 2,271 baris. Satu file menguasai segalanya.",
  "18 dependencies, tapi hasilnya 250+ fitur. Efisiensi level dewa.",
  "430 await calls di handler.js. Async game-nya kuat banget.",
  "82 try-catch block — error handling rapi, bukan asal jalan.",
  "10 video upscaler provider dalam satu file. Kalau satu gagal, ada 9 lagi.",
  "Bot ini support AI: Claude, Gemini, Dolphin, Perplexed, TurboSeek.",
  "Ada cek resi, KBBI, resep masak, kurs mata uang — ini bot atau superapp?",
  "Dari commit pertama sampai sekarang cuma 2 hari. Speed coding gila.",
  "14 commits, 78 file JS, 705KB pure code. Ringan tapi powerful.",
  "Support Ghibli AI, photo enhance, waifu2x, background remover. Lengkap.",
  "Auto-update dari GitHub, hot-reload handler tanpa restart. Pro setup.",
  "Multi-session support — satu CLI bisa manage banyak bot sekaligus.",
  "NIK parser, ML hero info, anime quote — fitur random tapi berguna.",
  "Sticker maker tanpa native deps, pakai WASM. Smart solution.",
  "Ada TTS (text to speech) pakai Qwen. Bot lu bisa ngomong.",
  "nanobanana punya 13 fungsi generate gambar AI. Gokil.",
  "Welcome system + group tools (kick/add/promote/demote/tagall/hidetag).",
  "Script ini jalan di Termux Android. Server? Ga butuh.",
  "Session auto-clear tiap 30 menit biar ga bloat. Detail matters.",
  "Video enhance AI sampai 4K via unblurimage.ai. Gratis pula.",
  "Developer bot ini coding dari HP doang. Respect.",
  "Bot ini punya lebih banyak fitur dari bot yang dijual 500rb.",
  "Scraper Pinterest, TikTok, IG, FB, Twitter, Threads — semua ada.",
  "SoundCloud, Joox, Spotify, YouTube search — music downloader lengkap.",
  "Mega, GDrive, Mediafire, Sfile, Terabox — download dari mana aja.",
  "Google search, Wikipedia, kamus, cuaca, berita — mini browser di WA.",
  "Logger-nya custom dengan spinner animasi, bukan console.log biasa.",
];

function showRandomFact() {
  const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
  console.log();
  console.log(`  ${chalk.yellow("*")} ${chalk.white.italic(fact)}`);
}

// ─── Startup Animation ───
async function startupAnim() {
  clear();
  spinStart("Loading...");
  await new Promise(r => setTimeout(r, 800));
  spinStop(chalk.green("Ready"), ic.check);
}

// ─── Main Loop ───
async function main() {
  await startupAnim();
  showServerInfo();
  showRandomFact();
  ensureDir(SESSIONS_DIR);
  migrateOldSession();

  // main loop - show menu repeatedly
  while (true) {
    const choice = await arrowSelect("Menu", MENU_ITEMS);
    if (!choice) continue;
    const cont = await handleAction(choice.action);
    if (cont === false) break;
    // show random fact before next menu
    showRandomFact();
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─── Graceful exit ───
process.on("SIGINT", () => {
  for (const [n] of bots) stopBot(n);
  process.exit(0);
});

main();
