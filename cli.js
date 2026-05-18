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
const bots = new Map(); // name -> { proc, config, status, startedAt }

// ─── Helpers ───
const ts = () => chalk.gray(moment().format("HH:mm:ss"));
const divider = () => chalk.gray("─".repeat(50));
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

// ─── Server Info (neofetch style) ───
function showServerInfo() {
  const upSec = os.uptime();
  const h = Math.floor(upSec / 3600);
  const m = Math.floor((upSec % 3600) / 60);
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(1);
  const cpuCount = os.cpus().length || 1;
  const cpuModel = os.cpus()[0]?.model || os.arch();
  const nodeVer = process.version;
  const platform = `${os.type()} ${os.release().split("-")[0]} ${os.arch()}`;
  const botsList = loadBotsConfig();
  const sessionCount = fs.existsSync(SESSIONS_DIR) ? fs.readdirSync(SESSIONS_DIR).filter(f => fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()).length : 0;

  const logo = [
    chalk.cyan("    ███████╗██╗  ██╗██╗██╗  ██╗██╗   ██╗"),
    chalk.cyan("    ██╔════╝██║  ██║██║██║ ██╔╝╚██╗ ██╔╝"),
    chalk.cyan("    ███████╗███████║██║█████╔╝  ╚████╔╝ "),
    chalk.cyan("    ╚════██║██╔══██║██║██╔═██╗   ╚██╔╝  "),
    chalk.cyan("    ███████║██║  ██║██║██║  ██╗   ██║   "),
    chalk.cyan("    ╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝   ╚═╝   "),
  ];

  const info = [
    `${chalk.cyan("OS")}          ${chalk.white(platform)}`,
    `${chalk.cyan("Uptime")}      ${chalk.white(`${h}h ${m}m`)}`,
    `${chalk.cyan("CPU")}         ${chalk.white(`${cpuModel} (${cpuCount} cores)`)}`,
    `${chalk.cyan("Memory")}      ${chalk.white(`${usedMem} / ${totalMem} GB`)}`,
    `${chalk.cyan("Node")}        ${chalk.white(nodeVer)}`,
    `${chalk.cyan("Bots")}        ${chalk.white(`${botsList.length} configured, ${sessionCount} sessions`)}`,
    `${chalk.cyan("Time")}        ${chalk.white(moment().format("DD MMM YYYY HH:mm:ss"))}`,
  ];

  console.log();
  for (let i = 0; i < Math.max(logo.length, info.length); i++) {
    const left = logo[i] || " ".repeat(42);
    const right = info[i] || "";
    console.log(`${left}  ${right}`);
  }
  console.log();
  console.log(divider());
}

// ─── Bot Process Manager ───
function startBot(botConfig) {
  const { name, phoneNumber, pairingCode, sessionDir } = botConfig;
  if (bots.has(name) && bots.get(name).proc) {
    console.log(`  ${chalk.yellow("⚠")} ${ts()} Bot ${chalk.cyan(name)} sudah berjalan`);
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

  proc.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line) {
      logStream.write(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] ${line}\n`);
      console.log(`  ${chalk.gray(`[${name}]`)} ${line}`);
      promptAgain();
    }
  });

  proc.stderr.on("data", (data) => {
    const line = data.toString().trim();
    if (line && !line.includes("SessionEntry") && !line.includes("Closing session") && !line.includes("preKeyId")) {
      logStream.write(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] ERR: ${line}\n`);
    }
  });

  proc.on("exit", (code) => {
    logStream.end();
    const entry = bots.get(name);
    if (entry) entry.status = "stopped";
    console.log(`\n  ${chalk.red("◆")} ${ts()} Bot ${chalk.cyan(name)} stopped (code: ${code})`);
    promptAgain();
  });

  proc.on("message", (msg) => {
    if (msg.type === "connected") {
      const entry = bots.get(name);
      if (entry) entry.status = "connected";
      console.log(`\n  ${chalk.green("◆")} ${ts()} Bot ${chalk.cyan(name)} connected as ${chalk.white(msg.number)}`);
      promptAgain();
    } else if (msg.type === "pairing") {
      console.log(`\n  ${chalk.magenta("⟡")} Bot ${chalk.cyan(name)} pairing code: ${chalk.white.bold(msg.code)}`);
      promptAgain();
    } else if (msg.type === "disconnected") {
      const entry = bots.get(name);
      if (entry) entry.status = "disconnected";
    }
  });

  bots.set(name, { proc, config: botConfig, status: "connecting", startedAt: Date.now() });
  console.log(`  ${chalk.green("▸")} ${ts()} Starting bot ${chalk.cyan(name)} (${chalk.gray(phoneNumber)})`);
}

function stopBot(name) {
  const entry = bots.get(name);
  if (!entry || !entry.proc) {
    console.log(`  ${chalk.yellow("⚠")} Bot ${chalk.cyan(name)} tidak ditemukan atau sudah mati`);
    return;
  }
  entry.proc.kill("SIGTERM");
  entry.status = "stopped";
  entry.proc = null;
  console.log(`  ${chalk.red("■")} ${ts()} Bot ${chalk.cyan(name)} di-shutdown`);
}

function restartBot(name) {
  const entry = bots.get(name);
  if (!entry) {
    console.log(`  ${chalk.yellow("⚠")} Bot ${chalk.cyan(name)} tidak ditemukan`);
    return;
  }
  console.log(`  ${chalk.yellow("↻")} ${ts()} Restarting bot ${chalk.cyan(name)}...`);
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
  console.log(chalk.cyan.bold("  Commands:"));
  console.log(`  ${chalk.green("add")}              Tambah bot baru`);
  console.log(`  ${chalk.green("start")} ${chalk.gray("<name>")}      Start bot`);
  console.log(`  ${chalk.green("stop")} ${chalk.gray("<name>")}       Shutdown bot`);
  console.log(`  ${chalk.green("restart")} ${chalk.gray("<name>")}    Restart bot`);
  console.log(`  ${chalk.green("startall")}         Start semua bot`);
  console.log(`  ${chalk.green("stopall")}          Stop semua bot`);
  console.log(`  ${chalk.green("list")}             Lihat semua bot`);
  console.log(`  ${chalk.green("logs")} ${chalk.gray("<name>")}       Lihat log bot`);
  console.log(`  ${chalk.green("setup")}            Setup nama owner & bot`);
  console.log(`  ${chalk.green("remove")} ${chalk.gray("<name>")}     Hapus bot (session tetap aman)`);
  console.log(`  ${chalk.green("info")}             Server info`);
  console.log(`  ${chalk.green("clear")}            Clear screen`);
  console.log(`  ${chalk.green("exit")}             Keluar`);
  console.log();
}

function showBotList() {
  const botsList = loadBotsConfig();
  if (botsList.length === 0) {
    console.log(`  ${chalk.yellow("⚠")} Belum ada bot. Ketik ${chalk.cyan("add")} untuk tambah.`);
    return;
  }
  console.log();
  console.log(chalk.cyan.bold("  Daftar Bot:"));
  console.log(`  ${chalk.gray("─".repeat(46))}`);
  for (const b of botsList) {
    const running = bots.get(b.name);
    let statusIcon;
    if (running?.status === "connected") statusIcon = chalk.green("● online");
    else if (running?.status === "connecting") statusIcon = chalk.yellow("● connecting");
    else statusIcon = chalk.red("● offline");
    const uptime = running?.startedAt ? chalk.gray(`(${Math.floor((Date.now() - running.startedAt) / 60000)}m)`) : "";
    console.log(`  ${statusIcon}  ${chalk.white.bold(b.name)} ${chalk.gray(b.phoneNumber)} ${uptime}`);
  }
  console.log();
}

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(`  ${chalk.cyan("?")} ${question} `, (answer) => resolve(answer.trim()));
  });
}

async function addBot() {
  console.log();
  console.log(chalk.cyan.bold("  ─── Tambah Bot Baru ───"));
  const name = await askQuestion("Nama bot:");
  if (!name) return console.log(chalk.red("  Nama tidak boleh kosong"));
  const phoneNumber = await askQuestion("Nomor HP (628xxx):");
  if (!phoneNumber) return console.log(chalk.red("  Nomor tidak boleh kosong"));
  const pairingCode = await askQuestion("Pairing code (kosong = random):");

  const botsList = loadBotsConfig();
  if (botsList.find(b => b.name === name)) {
    console.log(`  ${chalk.red("✗")} Bot ${chalk.cyan(name)} sudah ada`);
    return;
  }

  const sessionDir = path.join(SESSIONS_DIR, name);
  const botConfig = { name, phoneNumber, pairingCode: pairingCode || "", sessionDir };
  botsList.push(botConfig);
  saveBotsConfig(botsList);
  ensureDir(sessionDir);

  console.log(`  ${chalk.green("✓")} Bot ${chalk.cyan(name)} ditambahkan`);
  const autoStart = await askQuestion("Start sekarang? (y/n):");
  if (autoStart.toLowerCase() === "y") startBot(botConfig);
}

async function setupOwner() {
  console.log();
  console.log(chalk.cyan.bold("  ─── Setup Bot ───"));

  let setting;
  try {
    const mod = await import("./setting.js");
    setting = mod.default;
  } catch {
    setting = { name: "SHIKYTEMO", owner: "" };
  }

  console.log(`  Current: name=${chalk.cyan(setting.name)} owner=${chalk.cyan(setting.owner)}`);
  const newName = await askQuestion(`Nama bot baru (enter = skip):`);
  const newOwner = await askQuestion(`Owner number (enter = skip):`);

  if (newName || newOwner) {
    const sName = newName || setting.name;
    const sOwner = newOwner || setting.owner;
    const content = `const setting = {\n    name: "${sName}",\n    owner: "${sOwner}",\n    admins: [],  // tambah nomor admin: ["628xxxx", "628xxxx"]\n};\n\nexport default setting;\n`;
    fs.writeFileSync(path.join(ROOT, "setting.js"), content);
    console.log(`  ${chalk.green("✓")} Setting diupdate: name=${chalk.cyan(sName)} owner=${chalk.cyan(sOwner)}`);
  } else {
    console.log(`  ${chalk.gray("Tidak ada perubahan")}`);
  }
}

function showLogs(name) {
  const logFile = path.join(ROOT, "logs", `${name}.log`);
  if (!fs.existsSync(logFile)) {
    console.log(`  ${chalk.yellow("⚠")} Log untuk ${chalk.cyan(name)} tidak ditemukan`);
    return;
  }
  const lines = fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean);
  const last30 = lines.slice(-30);
  console.log();
  console.log(chalk.cyan.bold(`  ─── Log: ${name} (last 30 lines) ───`));
  for (const l of last30) {
    console.log(`  ${chalk.gray(l)}`);
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
  if (existing) return; // sudah ada

  // baca config lama
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

  // copy session files
  const files = fs.readdirSync(oldSession);
  for (const f of files) {
    const src = path.join(oldSession, f);
    const dst = path.join(sessionDir, f);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dst);
    }
  }

  const botConfig = { name, phoneNumber: phone, pairingCode: pairing, sessionDir };
  botsList.push(botConfig);
  saveBotsConfig(botsList);
  console.log(`  ${chalk.green("✓")} Session lama dimigrasikan sebagai bot ${chalk.cyan("main")} (${chalk.gray(phone)})`);
}

function promptAgain() {
  rl.prompt();
}

// ─── Main ───
async function main() {
  clear();
  showServerInfo();
  ensureDir(SESSIONS_DIR);
  migrateOldSession();
  showHelp();

  const prompt = () => {
    process.stdout.write(`  ${chalk.cyan("shiky")} ${chalk.gray("›")} `);
  };

  prompt();

  rl.on("line", async (input) => {
    const [cmd, ...args] = input.trim().split(/\s+/);
    const arg = args.join(" ");

    switch (cmd?.toLowerCase()) {
      case "add":
        await addBot();
        break;

      case "start": {
        if (!arg) { console.log(`  ${chalk.yellow("⚠")} Usage: start <name>`); break; }
        const botsList = loadBotsConfig();
        const bot = botsList.find(b => b.name === arg);
        if (!bot) { console.log(`  ${chalk.red("✗")} Bot ${chalk.cyan(arg)} tidak ditemukan`); break; }
        startBot(bot);
        break;
      }

      case "stop": case "shutdown":
        if (!arg) { console.log(`  ${chalk.yellow("⚠")} Usage: stop <name>`); break; }
        stopBot(arg);
        break;

      case "restart":
        if (!arg) { console.log(`  ${chalk.yellow("⚠")} Usage: restart <name>`); break; }
        restartBot(arg);
        break;

      case "startall": {
        const all = loadBotsConfig();
        if (all.length === 0) { console.log(`  ${chalk.yellow("⚠")} Tidak ada bot`); break; }
        for (const b of all) startBot(b);
        break;
      }

      case "stopall":
        for (const [name] of bots) stopBot(name);
        break;

      case "list": case "ls":
        showBotList();
        break;

      case "logs": case "log":
        if (!arg) { console.log(`  ${chalk.yellow("⚠")} Usage: logs <name>`); break; }
        showLogs(arg);
        break;

      case "setup":
        await setupOwner();
        break;

      case "remove": case "rm": case "delete": {
        if (!arg) { console.log(`  ${chalk.yellow("⚠")} Usage: remove <name>`); break; }
        stopBot(arg);
        bots.delete(arg);
        let bl = loadBotsConfig();
        bl = bl.filter(b => b.name !== arg);
        saveBotsConfig(bl);
        console.log(`  ${chalk.green("✓")} Bot ${chalk.cyan(arg)} dihapus (session folder tetap aman di sessions/${arg})`);
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

      case "exit": case "quit": case "q":
        console.log(`\n  ${chalk.gray("Shutting down all bots...")}`);
        for (const [name] of bots) stopBot(name);
        setTimeout(() => process.exit(0), 1000);
        return;

      default:
        if (cmd) console.log(`  ${chalk.yellow("⚠")} Unknown command: ${cmd}. Ketik ${chalk.cyan("help")} untuk bantuan.`);
    }
    prompt();
  });

  rl.on("close", () => {
    for (const [name] of bots) stopBot(name);
    process.exit(0);
  });
}

main();
