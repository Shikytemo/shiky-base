import chalk from "chalk";
import moment from "moment-timezone";
import setting from "../setting.js";

moment.tz.setDefault("Asia/Jakarta").locale("id");

// ─── Icons ───
const icon = {
  success:  chalk.green("✓"),
  error:    chalk.red("✗"),
  warn:     chalk.yellow("⚠"),
  info:     chalk.cyan("●"),
  exec:     chalk.blue("▸"),
  spam:     chalk.red("⊘"),
  trash:    chalk.gray("♻"),
  connect:  chalk.green("◆"),
  close:    chalk.red("◆"),
  pair:     chalk.magenta("⟡"),
  arrow:    chalk.white("›"),
  dot:      chalk.gray("·"),
};

// ─── Timestamp ───
const ts = () => chalk.gray(moment().format("HH:mm:ss"));

// ─── Divider ───
const divider = () => chalk.gray("─".repeat(45));

// ─── Banner ───
function banner() {
  console.clear();
  console.log();
  console.log(chalk.cyan.bold(`   ${setting.name}`));
  console.log(chalk.gray(`   WhatsApp Bot Engine`));
  console.log(divider());
}

// ─── Log Functions ───
function info(msg) {
  console.log(`  ${icon.info} ${ts()} ${chalk.white(msg)}`);
}

function success(msg) {
  console.log(`  ${icon.success} ${ts()} ${chalk.green(msg)}`);
}

function error(msg) {
  console.log(`  ${icon.error} ${ts()} ${chalk.red(msg)}`);
}

function warn(msg) {
  console.log(`  ${icon.warn} ${ts()} ${chalk.yellow(msg)}`);
}

function exec(command, args, pushname, groupName) {
  const cmd = chalk.cyan.bold(command);
  const user = chalk.white(pushname);
  const argsCount = chalk.gray(`[${args}]`);
  const group = groupName ? chalk.gray(` in `) + chalk.yellow(groupName) : "";
  console.log(`  ${icon.exec} ${ts()} ${cmd} ${argsCount} ${icon.arrow} ${user}${group}`);
}

function spam(command, args, pushname, groupName) {
  const cmd = chalk.red(command);
  const user = chalk.gray(pushname);
  const argsCount = chalk.gray(`[${args}]`);
  const group = groupName ? chalk.gray(` in `) + chalk.gray(groupName) : "";
  console.log(`  ${icon.spam} ${ts()} ${cmd} ${argsCount} ${icon.arrow} ${user}${group}`);
}

function unregistered(pushname) {
  console.log(`  ${icon.warn} ${ts()} ${chalk.gray("unknown cmd")} ${icon.arrow} ${chalk.gray(pushname)}`);
}

function connected(number) {
  console.log(`  ${icon.connect} ${ts()} ${chalk.green("Connected")} ${chalk.white(number)}`);
}

function disconnected(reason, code) {
  console.log(`  ${icon.close} ${ts()} ${chalk.red("Disconnected")} ${chalk.gray(`${reason} (${code})`)}`);
}

function pairingCode(code) {
  console.log();
  console.log(`  ${icon.pair} ${chalk.magenta.bold("Pairing Code")} ${icon.arrow} ${chalk.white.bold(code)}`);
  console.log();
}

function cacheClear(count) {
  console.log(`  ${icon.trash} ${ts()} ${chalk.gray(`Cache cleared ${chalk.white(count)} files`)}`);
}

// ─── Spinner / Loading ───
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerInterval = null;
let spinnerFrame = 0;

function startSpinner(msg) {
  spinnerFrame = 0;
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r  ${chalk.cyan(frames[spinnerFrame])} ${chalk.gray(msg)}`);
    spinnerFrame = (spinnerFrame + 1) % frames.length;
  }, 80);
}

function stopSpinner(msg) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write(`\r  ${icon.success} ${ts()} ${chalk.green(msg)}\n`);
  }
}

export const log = {
  banner,
  info,
  success,
  error,
  warn,
  exec,
  spam,
  unregistered,
  connected,
  disconnected,
  pairingCode,
  cacheClear,
  startSpinner,
  stopSpinner,
  divider: () => console.log(divider()),
};

export default log;
