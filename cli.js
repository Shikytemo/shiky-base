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

// ─── Icons ───
const ic = {
  arrow:   chalk.cyan("›"),
  right:   chalk.cyan("▸"),
  down:    chalk.cyan("▾"),
  dot:     chalk.gray("·"),
  check:   chalk.green("✓"),
  cross:   chalk.red("✗"),
  warn:    chalk.yellow("!"),
  info:    chalk.cyan("i"),
  online:  chalk.green("●"),
  offline: chalk.red("●"),
  wait:    chalk.yellow("●"),
  star:    chalk.magenta("★"),
  play:    chalk.green("▶"),
  stop:    chalk.red("■"),
  reload:  chalk.yellow("↻"),
  pair:    chalk.magenta("⟡"),
  log:     chalk.blue("▪"),
  gear:    chalk.cyan("⚙"),
  trash:   chalk.gray("♻"),
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

// ─── Clean Log ───
function clog(icon, time, msg) {
  console.log(`  ${icon} ${time ? ts() + " " : ""}${msg}`);
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

  // mem bar
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

  // bot spinner
  const botSpin = { timer: null, idx: 0 };
  botSpin.timer = setInterval(() => {
    const entry = bots.get(name);
    if (entry?.status === "connecting") {
      process.stdout.write(`\r  ${chalk.cyan(spinFrames[botSpin.idx])} ${chalk.gray(`${name} connecting...`)}`);
      botSpin.idx = (botSpin.idx + 1) % spinFrames.length;
    }
  }, 80);

  proc.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line) {
      logStream.write(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] ${line}\n`);
      // only show important lines, skip noisy connecting logs
      if (!line.includes("Connecting") && !line.includes("Cache cleared")) {
        process.stdout.write(`\r  ${ic.log} ${chalk.gray(`[${name}]`)} ${line}\n`);
        promptAgain();
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
    process.stdout.write(`\r  ${ic.cross} ${ts()} ${chalk.red(`${name} stopped`)} ${chalk.gray(`(code: ${code})`)}\n`);
    promptAgain();
  });

  proc.on("message", (msg) => {
    if (msg.type === "connected") {
      if (botSpin.timer) clearInterval(botSpin.timer);
      const entry = bots.get(name);
      if (entry) entry.status = "connected";
      process.stdout.write(`\r  ${ic.check} ${ts()} ${chalk.green(`${name} connected`)} ${ic.link} ${chalk.white(msg.number)}\n`);
      promptAgain();
    } else if (msg.type === "pairing") {
      if (botSpin.timer) clearInterval(botSpin.timer);
      process.stdout.write(`\r  ${ic.pair} ${chalk.magenta(`${name} pairing`)} ${ic.arrow} ${chalk.white.bold(msg.code)}\n`);
      promptAgain();
    } else if (msg.type === "disconnected") {
      if (botSpin.timer) clearInterval(botSpin.timer);
      const entry = bots.get(name);
      if (entry) entry.status = "disconnected";
      process.stdout.write(`\r  ${ic.warn} ${ts()} ${chalk.yellow(`${name} disconnected`)} ${chalk.gray(`(${msg.reason})`)}\n`);
      // restart spinner if reconnecting
      botSpin.timer = setInterval(() => {
        const e = bots.get(name);
        if (e?.status === "disconnected") {
          e.status = "connecting";
          process.stdout.write(`\r  ${chalk.cyan(spinFrames[botSpin.idx])} ${chalk.gray(`${name} reconnecting...`)}`);
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

// ─── CLI Interface ───
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "",
});

function showHelp() {
  console.log();
  console.log(`  ${chalk.cyan.bold("Commands")}`);
  console.log(divider());
  console.log(`  ${ic.right} ${chalk.green("add")}            ${chalk.gray("Tambah bot baru")}`);
  console.log(`  ${ic.right} ${chalk.green("start")} ${chalk.white("<name>")}  ${chalk.gray("Start bot")}`);
  console.log(`  ${ic.right} ${chalk.green("stop")} ${chalk.white("<name>")}   ${chalk.gray("Shutdown bot")}`);
  console.log(`  ${ic.right} ${chalk.green("restart")} ${chalk.white("<name>")} ${chalk.gray("Restart bot")}`);
  console.log(`  ${ic.right} ${chalk.green("startall")}       ${chalk.gray("Start semua bot")}`);
  console.log(`  ${ic.right} ${chalk.green("stopall")}        ${chalk.gray("Stop semua bot")}`);
  console.log(`  ${ic.right} ${chalk.green("list")}           ${chalk.gray("Daftar bot")}`);
  console.log(`  ${ic.right} ${chalk.green("logs")} ${chalk.white("<name>")}   ${chalk.gray("Lihat log bot")}`);
  console.log(`  ${ic.right} ${chalk.green("setup")}          ${chalk.gray("Setup owner & bot")}`);
  console.log(`  ${ic.right} ${chalk.green("remove")} ${chalk.white("<name>")} ${chalk.gray("Hapus bot config")}`);
  console.log(`  ${ic.right} ${chalk.green("info")}           ${chalk.gray("Server info")}`);
  console.log(`  ${ic.right} ${chalk.green("clear")}          ${chalk.gray("Clear screen")}`);
  console.log(`  ${ic.right} ${chalk.green("exit")}           ${chalk.gray("Keluar")}`);
  console.log();
}

function showBotList() {
  const botsList = loadBotsConfig();
  if (botsList.length === 0) {
    clog(ic.warn, false, `Belum ada bot. Ketik ${chalk.cyan("add")}`);
    return;
  }
  console.log();
  console.log(`  ${chalk.cyan.bold("Bots")}`);
  console.log(`  ${chalk.gray("─".repeat(38))}`);
  for (const b of botsList) {
    const running = bots.get(b.name);
    let statusBadge;
    if (running?.status === "connected") statusBadge = ic.online + " " + chalk.green("on ");
    else if (running?.status === "connecting") statusBadge = ic.wait + " " + chalk.yellow("...");
    else statusBadge = ic.offline + " " + chalk.red("off");
    const uptime = running?.startedAt && running?.status === "connected"
      ? chalk.gray(` ${Math.floor((Date.now() - running.startedAt) / 60000)}m`)
      : "";
    console.log(`  ${statusBadge} ${chalk.white.bold(b.name)} ${chalk.gray(b.phoneNumber)}${uptime}`);
  }
  console.log();
}

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(`  ${ic.arrow} ${question} `, (answer) => resolve(answer.trim()));
  });
}

async function addBot() {
  console.log();
  console.log(`  ${ic.gear} ${chalk.cyan.bold("Tambah Bot Baru")}`);
  console.log(`  ${chalk.gray("─".repeat(30))}`);
  const name = await askQuestion("Nama bot:");
  if (!name) { clog(ic.cross, false, chalk.red("Nama kosong")); return; }
  const phoneNumber = await askQuestion("Nomor HP (628xxx):");
  if (!phoneNumber) { clog(ic.cross, false, chalk.red("Nomor kosong")); return; }
  const pairingCode = await askQuestion("Pairing code (kosong=random):");

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
  const autoStart = await askQuestion("Start sekarang? (y/n):");
  if (autoStart.toLowerCase() === "y") startBot(botConfig);
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
  const newName = await askQuestion("Nama bot baru (enter=skip):");
  const newOwner = await askQuestion("Owner number (enter=skip):");

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

function showLogs(name) {
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

function promptAgain() {
  process.stdout.write(`\r  ${chalk.cyan("shiky")} ${ic.arrow} `);
}

// ─── Startup Animation ───
async function startupAnim() {
  clear();
  spinStart("Loading...");
  await new Promise(r => setTimeout(r, 800));
  spinStop(chalk.green("Ready"), ic.check);
  console.log();
}

// ─── Main ───
async function main() {
  await startupAnim();
  showServerInfo();
  ensureDir(SESSIONS_DIR);
  migrateOldSession();
  showHelp();

  promptAgain();

  rl.on("line", async (input) => {
    const [cmd, ...args] = input.trim().split(/\s+/);
    const arg = args.join(" ");

    switch (cmd?.toLowerCase()) {
      case "add":
        await addBot();
        break;

      case "start": {
        if (!arg) { clog(ic.warn, false, `Usage: ${chalk.green("start")} ${chalk.white("<name>")}`); break; }
        const botsList = loadBotsConfig();
        const bot = botsList.find(b => b.name === arg);
        if (!bot) { clog(ic.cross, false, `Bot ${chalk.cyan(arg)} tidak ada`); break; }
        startBot(bot);
        break;
      }

      case "stop": case "shutdown":
        if (!arg) { clog(ic.warn, false, `Usage: ${chalk.green("stop")} ${chalk.white("<name>")}`); break; }
        stopBot(arg);
        break;

      case "restart":
        if (!arg) { clog(ic.warn, false, `Usage: ${chalk.green("restart")} ${chalk.white("<name>")}`); break; }
        restartBot(arg);
        break;

      case "startall": {
        const all = loadBotsConfig();
        if (all.length === 0) { clog(ic.warn, false, "Tidak ada bot"); break; }
        for (const b of all) startBot(b);
        break;
      }

      case "stopall":
        for (const [n] of bots) stopBot(n);
        break;

      case "list": case "ls":
        showBotList();
        break;

      case "logs": case "log":
        if (!arg) { clog(ic.warn, false, `Usage: ${chalk.green("logs")} ${chalk.white("<name>")}`); break; }
        showLogs(arg);
        break;

      case "setup":
        await setupOwner();
        break;

      case "remove": case "rm": case "delete": {
        if (!arg) { clog(ic.warn, false, `Usage: ${chalk.green("remove")} ${chalk.white("<name>")}`); break; }
        stopBot(arg);
        bots.delete(arg);
        let bl = loadBotsConfig();
        bl = bl.filter(b => b.name !== arg);
        saveBotsConfig(bl);
        clog(ic.check, false, `${chalk.cyan(arg)} dihapus ${chalk.gray("(session tetap aman)")}`);
        break;
      }

      case "info":
        showServerInfo();
        break;

      case "clear": case "cls":
        clear();
        showServerInfo();
        break;

      case "help": case "h": case "?":
        showHelp();
        break;

      case "exit": case "quit": case "q": {
        spinStart("Shutting down...");
        for (const [n] of bots) stopBot(n);
        await new Promise(r => setTimeout(r, 1000));
        spinStop(chalk.gray("Goodbye"), ic.check);
        process.exit(0);
        return;
      }

      default:
        if (cmd) clog(ic.warn, false, `${chalk.yellow(cmd)} ${ic.arrow} ketik ${chalk.cyan("help")}`);
    }
    promptAgain();
  });

  rl.on("close", () => {
    for (const [n] of bots) stopBot(n);
    process.exit(0);
  });
}

main();
