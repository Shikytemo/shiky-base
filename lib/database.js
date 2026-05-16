import fs from "fs";
import path from "path";

const DB_DIR = "./database";
const DB_FILE = path.join(DB_DIR, "users.json");

// ═══════════════════════════════════════════════════
//  TIER SYSTEM - Level Tiers
// ═══════════════════════════════════════════════════
const TIERS = [
  { minLevel: 1,   maxLevel: 10,  name: "Novice Wanderer",      symbol: "I",    badge: "🌑" },
  { minLevel: 11,  maxLevel: 25,  name: "Shadow Apprentice",    symbol: "II",   badge: "🌘" },
  { minLevel: 26,  maxLevel: 50,  name: "Iron Warrior",         symbol: "III",  badge: "⚔️" },
  { minLevel: 51,  maxLevel: 75,  name: "Arcane Knight",        symbol: "IV",   badge: "🛡️" },
  { minLevel: 76,  maxLevel: 100, name: "Phantom Guardian",     symbol: "V",    badge: "👻" },
  { minLevel: 101, maxLevel: 150, name: "Mythic Overlord",      symbol: "VI",   badge: "🔱" },
  { minLevel: 151, maxLevel: 200, name: "Legendary Sovereign",  symbol: "VII",  badge: "👑" },
  { minLevel: 201, maxLevel: 999, name: "Celestial Emperor",    symbol: "VIII", badge: "🌟" },
];

// XP required to reach next level: base * level^1.5
const XP_BASE = 50;
const XP_PER_CMD = { min: 5, max: 15 };

// Limit defaults
const LIMIT_DEFAULT = 25;
const LIMIT_PREMIUM = 100;
const LIMIT_ADMIN = 999;
const LIMIT_OWNER = 99999;

// Daily reward
const DAILY_MONEY = { min: 500, max: 2000 };
const DAILY_XP = { min: 20, max: 50 };

// ═══════════════════════════════════════════════════
//  DATABASE CLASS
// ═══════════════════════════════════════════════════
class Database {
  constructor() {
    this._data = {};
    this._load();
  }

  // --- File I/O ---
  _load() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      try {
        this._data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      } catch {
        this._data = {};
      }
    }
  }

  _save() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(this._data, null, 2));
  }

  // ─── Auto Register ───
  register(jid, pushname = "User") {
    if (this._data[jid]) return this._data[jid];
    this._data[jid] = {
      jid,
      name: pushname,
      level: 1,
      xp: 0,
      money: 0,
      limit: LIMIT_DEFAULT,
      role: "user",        // user | premium | admin | owner
      premium: false,
      premiumExpiry: 0,
      totalCmd: 0,
      registered: Date.now(),
      lastDaily: 0,
      lastReset: this._today(),
    };
    this._save();
    return this._data[jid];
  }

  // ─── Get / Check ───
  getUser(jid) {
    return this._data[jid] || null;
  }

  isRegistered(jid) {
    return !!this._data[jid];
  }

  getAllUsers() {
    return Object.values(this._data);
  }

  // ─── Role Checks ───
  isOwner(jid) {
    const u = this._data[jid];
    return u?.role === "owner";
  }

  isAdmin(jid) {
    const u = this._data[jid];
    return u?.role === "admin" || u?.role === "owner";
  }

  isPremium(jid) {
    const u = this._data[jid];
    if (!u) return false;
    if (u.role === "owner" || u.role === "admin") return true;
    if (u.premium && u.premiumExpiry > Date.now()) return true;
    // expired premium
    if (u.premium && u.premiumExpiry <= Date.now()) {
      u.premium = false;
      u.premiumExpiry = 0;
      u.role = "user";
      u.limit = LIMIT_DEFAULT;
      this._save();
    }
    return false;
  }

  // ─── Set Roles ───
  setOwner(jid) {
    if (!this._data[jid]) return false;
    this._data[jid].role = "owner";
    this._data[jid].limit = LIMIT_OWNER;
    this._save();
    return true;
  }

  setAdmin(jid) {
    if (!this._data[jid]) return false;
    this._data[jid].role = "admin";
    this._data[jid].limit = LIMIT_ADMIN;
    this._save();
    return true;
  }

  removeAdmin(jid) {
    if (!this._data[jid]) return false;
    if (this._data[jid].role === "owner") return false;
    this._data[jid].role = this._data[jid].premium ? "premium" : "user";
    this._data[jid].limit = this._data[jid].premium ? LIMIT_PREMIUM : LIMIT_DEFAULT;
    this._save();
    return true;
  }

  setPremium(jid, days = 30) {
    if (!this._data[jid]) return false;
    const u = this._data[jid];
    if (u.role === "owner" || u.role === "admin") return false;
    u.premium = true;
    u.premiumExpiry = Date.now() + days * 24 * 60 * 60 * 1000;
    u.role = "premium";
    u.limit = LIMIT_PREMIUM;
    this._save();
    return true;
  }

  removePremium(jid) {
    if (!this._data[jid]) return false;
    const u = this._data[jid];
    if (u.role === "owner" || u.role === "admin") return false;
    u.premium = false;
    u.premiumExpiry = 0;
    u.role = "user";
    u.limit = LIMIT_DEFAULT;
    this._save();
    return true;
  }

  // ─── Limit System ───
  useLimit(jid, amount = 1) {
    const u = this._data[jid];
    if (!u) return false;
    this._checkDailyReset(jid);
    if (u.limit >= 99999) return true; // unlimited owner
    if (u.limit < amount) return false;
    u.limit -= amount;
    this._save();
    return true;
  }

  getLimit(jid) {
    const u = this._data[jid];
    if (!u) return 0;
    this._checkDailyReset(jid);
    return u.limit;
  }

  addLimit(jid, amount) {
    if (!this._data[jid]) return false;
    this._data[jid].limit += amount;
    this._save();
    return true;
  }

  // ─── XP & Leveling ───
  addXp(jid, amount) {
    const u = this._data[jid];
    if (!u) return null;
    u.xp += amount;
    u.totalCmd++;
    let leveledUp = false;
    let newLevel = u.level;
    while (u.xp >= this.xpToNextLevel(u.level)) {
      u.xp -= this.xpToNextLevel(u.level);
      u.level++;
      leveledUp = true;
      newLevel = u.level;
    }
    this._save();
    return { leveledUp, newLevel, xp: u.xp, tier: this.getTier(newLevel) };
  }

  addRandomXp(jid) {
    const amount = this._rand(XP_PER_CMD.min, XP_PER_CMD.max);
    return this.addXp(jid, amount);
  }

  xpToNextLevel(level) {
    return Math.floor(XP_BASE * Math.pow(level, 1.5));
  }

  // ─── Tier System ───
  getTier(level) {
    return TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) || TIERS[TIERS.length - 1];
  }

  getTierProgress(level) {
    const tier = this.getTier(level);
    const range = tier.maxLevel - tier.minLevel + 1;
    const progress = level - tier.minLevel;
    const percent = Math.floor((progress / range) * 100);
    return { tier, progress, range, percent };
  }

  // ─── Money System ───
  addMoney(jid, amount) {
    if (!this._data[jid]) return false;
    this._data[jid].money += amount;
    this._save();
    return true;
  }

  reduceMoney(jid, amount) {
    const u = this._data[jid];
    if (!u) return false;
    if (u.money < amount) return false;
    u.money -= amount;
    this._save();
    return true;
  }

  getMoney(jid) {
    return this._data[jid]?.money || 0;
  }

  transferMoney(fromJid, toJid, amount) {
    const from = this._data[fromJid];
    const to = this._data[toJid];
    if (!from || !to) return { success: false, reason: "User tidak ditemukan" };
    if (from.money < amount) return { success: false, reason: "Uang tidak cukup" };
    if (amount <= 0) return { success: false, reason: "Jumlah harus lebih dari 0" };
    from.money -= amount;
    to.money += amount;
    this._save();
    return { success: true };
  }

  // ─── Daily Reward ───
  claimDaily(jid) {
    const u = this._data[jid];
    if (!u) return null;
    const now = Date.now();
    const last = u.lastDaily;
    const oneDay = 24 * 60 * 60 * 1000;
    if (now - last < oneDay) {
      const remaining = oneDay - (now - last);
      return { claimed: false, remaining };
    }
    const money = this._rand(DAILY_MONEY.min, DAILY_MONEY.max);
    const xp = this._rand(DAILY_XP.min, DAILY_XP.max);
    u.money += money;
    u.lastDaily = now;
    const levelResult = this.addXp(jid, xp);
    return { claimed: true, money, xp, ...levelResult };
  }

  // ─── Profile Card ───
  getProfile(jid) {
    const u = this._data[jid];
    if (!u) return null;
    this._checkDailyReset(jid);
    const tier = this.getTier(u.level);
    const tierProgress = this.getTierProgress(u.level);
    const xpNeeded = this.xpToNextLevel(u.level);
    const xpBar = this._progressBar(u.xp, xpNeeded, 10);
    const tierBar = this._progressBar(tierProgress.percent, 100, 10);
    const maxLimit = u.role === "owner" ? "♾️" : u.role === "admin" ? LIMIT_ADMIN : u.premium ? LIMIT_PREMIUM : LIMIT_DEFAULT;

    return {
      ...u,
      tier,
      tierProgress,
      xpNeeded,
      xpBar,
      tierBar,
      maxLimit,
      roleDisplay: this._roleDisplay(u.role),
    };
  }

  formatProfile(jid) {
    const p = this.getProfile(jid);
    if (!p) return "User tidak ditemukan.";
    const premiumStatus = p.premium
      ? `Aktif (${this._msToTime(p.premiumExpiry - Date.now())})`
      : "Tidak Aktif";

    return `╔═══════════════════════╗
║     ${p.tier.badge} *PLAYER CARD* ${p.tier.badge}
╠═══════════════════════╣
║ *Name:* ${p.name}
║ *Role:* ${p.roleDisplay}
║ *Premium:* ${premiumStatus}
╠═══════════════════════╣
║ *TIER ${p.tier.symbol}* - ${p.tier.name}
║ ${p.tierBar} ${p.tierProgress.percent}%
╠═══════════════════════╣
║ *Level:* ${p.level}
║ *XP:* ${p.xp}/${p.xpNeeded}
║ ${p.xpBar}
╠═══════════════════════╣
║ *Money:* $${p.money.toLocaleString()}
║ *Limit:* ${p.limit >= 99999 ? "♾️" : p.limit}/${p.maxLimit}
║ *Total Cmd:* ${p.totalCmd}
╠═══════════════════════╣
║ *Registered:* ${new Date(p.registered).toLocaleDateString("id-ID")}
╚═══════════════════════╝`;
  }

  // ─── Leaderboard ───
  leaderboard(type = "level", top = 10) {
    const users = this.getAllUsers();
    let sorted;
    switch (type) {
      case "money":
        sorted = users.sort((a, b) => b.money - a.money);
        break;
      case "xp":
        sorted = users.sort((a, b) => (b.level * 10000 + b.xp) - (a.level * 10000 + a.xp));
        break;
      default:
        sorted = users.sort((a, b) => b.level - a.level || b.xp - a.xp);
    }
    return sorted.slice(0, top);
  }

  formatLeaderboard(type = "level", top = 10) {
    const lb = this.leaderboard(type, top);
    const medals = ["🥇", "🥈", "🥉"];
    const title = type === "money" ? "RICHEST PLAYERS" : type === "xp" ? "TOP XP" : "TOP LEVELS";
    let text = `╔═══════════════════════╗\n║  🏆 *${title}* 🏆\n╠═══════════════════════╣\n`;
    lb.forEach((u, i) => {
      const rank = medals[i] || `#${i + 1}`;
      const tier = this.getTier(u.level);
      if (type === "money") {
        text += `║ ${rank} *${u.name}*\n║    ${tier.badge} Lv.${u.level} | $${u.money.toLocaleString()}\n`;
      } else {
        text += `║ ${rank} *${u.name}*\n║    ${tier.badge} ${tier.name} | Lv.${u.level}\n`;
      }
      if (i < lb.length - 1) text += `║ ─────────────────\n`;
    });
    text += `╚═══════════════════════╝`;
    return text;
  }

  // ─── Helpers ───
  _today() {
    return new Date().toISOString().slice(0, 10);
  }

  _checkDailyReset(jid) {
    const u = this._data[jid];
    if (!u) return;
    const today = this._today();
    if (u.lastReset !== today) {
      u.lastReset = today;
      if (u.role === "owner") u.limit = LIMIT_OWNER;
      else if (u.role === "admin") u.limit = LIMIT_ADMIN;
      else if (u.premium) u.limit = LIMIT_PREMIUM;
      else u.limit = LIMIT_DEFAULT;
      this._save();
    }
  }

  _rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _progressBar(current, max, length = 10) {
    const percent = Math.min(current / max, 1);
    const filled = Math.round(percent * length);
    const empty = length - filled;
    return "█".repeat(filled) + "░".repeat(empty);
  }

  _msToTime(ms) {
    if (ms <= 0) return "Expired";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  _roleDisplay(role) {
    const roles = {
      user: "User",
      premium: "Premium ⭐",
      admin: "Admin 🔧",
      owner: "Owner 👑",
    };
    return roles[role] || "User";
  }
}

// Singleton instance
const db = new Database();

export { db, TIERS, LIMIT_DEFAULT, LIMIT_PREMIUM, LIMIT_ADMIN };
export default db;
