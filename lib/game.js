import db from "./database.js";

// ═══════════════════════════════════════════════════
//  MONSTER DATABASE
// ═══════════════════════════════════════════════════
const MONSTERS = [
  { name: "Slime Hijau",        emoji: "🟢", hp: 40,   atk: 8,   def: 2,  exp: 30,  gold: 50,  tier: 1 },
  { name: "Goblin Pencuri",     emoji: "👺", hp: 55,   atk: 12,  def: 4,  exp: 50,  gold: 80,  tier: 1 },
  { name: "Serigala Es",        emoji: "🐺", hp: 70,   atk: 15,  def: 6,  exp: 80,  gold: 120, tier: 2 },
  { name: "Skeleton Warrior",   emoji: "💀", hp: 90,   atk: 18,  def: 10, exp: 110, gold: 170, tier: 2 },
  { name: "Dark Mage",          emoji: "🧙", hp: 110,  atk: 22,  def: 8,  exp: 150, gold: 230, tier: 3 },
  { name: "Fire Golem",         emoji: "🔥", hp: 150,  atk: 25,  def: 15, exp: 200, gold: 300, tier: 3 },
  { name: "Shadow Assassin",    emoji: "🗡️", hp: 130,  atk: 30,  def: 12, exp: 250, gold: 380, tier: 4 },
  { name: "Thunder Drake",      emoji: "🐉", hp: 200,  atk: 28,  def: 18, exp: 320, gold: 480, tier: 4 },
  { name: "Ancient Lich",       emoji: "☠️", hp: 260,  atk: 35,  def: 20, exp: 400, gold: 600, tier: 5 },
  { name: "Demon Lord",         emoji: "👿", hp: 350,  atk: 40,  def: 25, exp: 550, gold: 800, tier: 5 },
  { name: "Celestial Dragon",   emoji: "🐲", hp: 500,  atk: 50,  def: 30, exp: 800, gold: 1200, tier: 6 },
  { name: "Void Emperor",       emoji: "🕳️", hp: 700,  atk: 65,  def: 35, exp: 1200, gold: 1800, tier: 6 },
];

// ═══════════════════════════════════════════════════
//  SHOP ITEMS
// ═══════════════════════════════════════════════════
const SHOP = [
  { id: "potion",    name: "Health Potion",   emoji: "🧪", price: 200,  desc: "Pulihkan 50 HP",             type: "heal" },
  { id: "superpot",  name: "Super Potion",    emoji: "🧴", price: 500,  desc: "Pulihkan 150 HP",            type: "heal" },
  { id: "elixir",    name: "Elixir Max",      emoji: "🍾", price: 1500, desc: "Pulihkan HP penuh",          type: "heal" },
  { id: "sword",     name: "Iron Sword",      emoji: "⚔️", price: 800,  desc: "+15 ATK (3 battle)",         type: "weapon" },
  { id: "shield",    name: "Steel Shield",    emoji: "🛡️", price: 800,  desc: "+15 DEF (3 battle)",         type: "armor" },
  { id: "amulet",    name: "Lucky Amulet",    emoji: "📿", price: 1000, desc: "+30% EXP (3 battle)",        type: "boost" },
  { id: "ring",      name: "Gold Ring",       emoji: "💍", price: 1000, desc: "+30% Gold (3 battle)",       type: "boost" },
  { id: "scroll",    name: "XP Scroll",       emoji: "📜", price: 600,  desc: "+100 XP instant",            type: "instant" },
];

// ═══════════════════════════════════════════════════
//  HUNT REWARDS
// ═══════════════════════════════════════════════════
const HUNT_REWARDS = [
  { name: "Gold Coin",    emoji: "🪙", type: "gold",   min: 50,  max: 300, chance: 35 },
  { name: "Silver Ore",   emoji: "🪨", type: "gold",   min: 100, max: 500, chance: 20 },
  { name: "Health Herb",  emoji: "🌿", type: "item",   id: "potion",     chance: 15 },
  { name: "Mana Crystal", emoji: "💎", type: "gold",   min: 300, max: 800, chance: 8  },
  { name: "Ancient Relic",emoji: "🏺", type: "gold",   min: 500, max: 1500,chance: 3  },
  { name: "Monster Fang", emoji: "🦷", type: "exp",    min: 20,  max: 60,  chance: 12 },
  { name: "Nothing...",   emoji: "💨", type: "none",                          chance: 7  },
];

// ═══════════════════════════════════════════════════
//  BATTLE STATE (in-memory)
// ═══════════════════════════════════════════════════
const battles = {};
const battleCooldown = new Set();

// ═══════════════════════════════════════════════════
//  GAME ENGINE
// ═══════════════════════════════════════════════════

class Game {
  // ─── Helper ───
  _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  _chance(pct) { return Math.random() * 100 < pct; }
  _isOnCooldown(jid) { return battleCooldown.has(jid); }
  _setCooldown(jid) {
    battleCooldown.add(jid);
    setTimeout(() => battleCooldown.delete(jid), 2000);
  }
  _progressBar(val, max, len = 10) {
    const p = Math.min(val / max, 1);
    const f = Math.round(p * len);
    return "█".repeat(f) + "░".repeat(len - f);
  }

  // ─── Inventory ───
  getInventory(jid) {
    const u = db.getUser(jid);
    if (!u) return {};
    if (!u.inventory) { u.inventory = {}; db._save(); }
    return u.inventory;
  }

  hasItem(jid, itemId) {
    const inv = this.getInventory(jid);
    return (inv[itemId] || 0) > 0;
  }

  addItem(jid, itemId, qty = 1) {
    const u = db.getUser(jid);
    if (!u) return;
    if (!u.inventory) u.inventory = {};
    u.inventory[itemId] = (u.inventory[itemId] || 0) + qty;
    db._save();
  }

  removeItem(jid, itemId, qty = 1) {
    const u = db.getUser(jid);
    if (!u) return false;
    if (!u.inventory || (u.inventory[itemId] || 0) < qty) return false;
    u.inventory[itemId] -= qty;
    if (u.inventory[itemId] <= 0) delete u.inventory[itemId];
    db._save();
    return true;
  }

  // ─── Player Stats ───
  getPlayer(jid) {
    const u = db.getUser(jid);
    if (!u) return null;
    if (!u.game) u.game = { hp: 100, maxHp: 100, atk: 10, def: 5, weapon: 0, armor: 0, boost: 0 };
    // Level scaling + equipment bonus
    const baseAtk = 10 + Math.floor(u.level * 1.5);
    const baseDef = 5 + Math.floor(u.level * 0.8);
    u.game.atk = baseAtk + (u.game.weapon > 0 ? 15 : 0);
    u.game.def = baseDef + (u.game.armor > 0 ? 15 : 0);
    u.game.maxHp = 100 + (u.level - 1) * 20;
    if (u.game.hp > u.game.maxHp) u.game.hp = u.game.maxHp;
    db._save();
    return u.game;
  }

  // ─── Get Random Monster ───
  getMonster(playerLevel) {
    const tier = playerLevel <= 10 ? 1 : playerLevel <= 25 ? 2 : playerLevel <= 50 ? 3 : playerLevel <= 75 ? 4 : playerLevel <= 100 ? 5 : 6;
    const pool = MONSTERS.filter(m => m.tier <= tier);
    return { ...pool[this._rand(0, pool.length - 1)] };
  }

  // ─── START BATTLE ───
  startBattle(jid) {
    if (battles[jid]) return { error: "⚔️ Kamu sedang dalam pertempuran! Selesaikan dulu." };
    const player = this.getPlayer(jid);
    if (!player) return { error: "❌ Player tidak ditemukan." };
    if (player.hp <= 0) return { error: "💀 HP kamu habis! Gunakan `.heal` untuk pulih." };

    const u = db.getUser(jid);
    const monster = this.getMonster(u.level);
    // Scale monster slightly
    monster.hp += Math.floor(u.level * 2);
    monster.atk += Math.floor(u.level * 0.5);

    battles[jid] = {
      monster,
      turns: 0,
      playerHp: player.hp,
      monsterHp: monster.hp,
      maxPlayerHp: player.maxHp,
      maxMonsterHp: monster.hp,
      weaponUses: 0,
      armorUses: 0,
      boostUses: 0,
    };

    return this.battleView(jid);
  }

  // ─── BATTLE ACTION ───
  battleAction(jid, action) {
    const b = battles[jid];
    if (!b) return { error: "⚔️ Tidak ada pertempuran aktif." };
    if (this._isOnCooldown(jid)) return { error: "⏳ Tunggu sebentar sebelum aksi berikutnya!" };
    this._setCooldown(jid);

    const player = this.getPlayer(jid);
    let msg = "";
    let playerDmg = 0;
    let monsterDmg = 0;
    let battleEnded = false;

    switch (action) {
      case "attack":
        playerDmg = this._rand(player.atk * 0.8, player.atk * 1.2) - b.monster.def;
        playerDmg = Math.max(1, Math.floor(playerDmg));
        b.monsterHp -= playerDmg;
        msg = `⚔️ Kamu menyerang! Deal *${playerDmg}* damage!\n`;
        break;

      case "skill":
        playerDmg = this._rand(player.atk * 1.3, player.atk * 2.0) - Math.floor(b.monster.def * 0.5);
        playerDmg = Math.max(5, Math.floor(playerDmg));
        b.monsterHp -= playerDmg;
        msg = `💥 *SKILL CRITICAL!* Deal *${playerDmg}* damage!\n`;
        break;

      case "defend":
        monsterDmg = Math.floor(b.monster.atk * 0.3) - player.def;
        monsterDmg = Math.max(0, Math.floor(monsterDmg));
        b.playerHp -= monsterDmg;
        msg = `🛡️ Kamu bertahan! Hanya terkena *${monsterDmg}* damage.\n`;
        b.turns++;
        return this.battleView(jid, msg);

      default:
        return { error: "❌ Aksi tidak valid." };
    }

    b.turns++;

    // Check monster death
    if (b.monsterHp <= 0) {
      b.monsterHp = 0;
      const exp = b.monster.exp + this._rand(0, 20);
      const gold = b.monster.gold + this._rand(0, 50);
      const xpRes = db.addXp(jid, exp);
      db.addMoney(jid, gold);

      let winMsg = `🎉 *VICTORY!* ${b.monster.emoji} *${b.monster.name}* dikalahkan!\n\n` +
        `✨ +${exp} XP\n💰 +$${gold.toLocaleString()}\n` +
        `🔄 ${b.turns} turn`;
      if (xpRes?.leveledUp) winMsg += `\n\n🎊 *LEVEL UP!* -> Level ${xpRes.newLevel}!`;

      // Save final HP before deleting battle state
      const finalHp = Math.max(0, b.playerHp);
      player.hp = finalHp;
      delete battles[jid];
      db._save();
      return { end: true, msg: winMsg };
    }

    // Monster counter-attack
    if (action !== "defend") {
      monsterDmg = b.monster.atk - player.def;
      monsterDmg = Math.max(1, Math.floor(monsterDmg * (0.8 + Math.random() * 0.4)));
      b.playerHp -= monsterDmg;
      msg += `👊 ${b.monster.emoji} *${b.monster.name}* balas! Deal *${monsterDmg}* damage!\n`;
    }

    // Check player death
    if (b.playerHp <= 0) {
      b.playerHp = 0;
      player.hp = 0;
      delete battles[jid];
      db._save();
      const loseMsg = `💀 *DEFEATED!*\n\n${b.monster.emoji} *${b.monster.name}* mengalahkanmu...\n` +
        `🔁 Setelah ${b.turns} turn\n\n` +
        `🧪 Gunakan \`.heal\` untuk memulihkan HP.`;
      return { end: true, msg: loseMsg };
    }

    player.hp = b.playerHp;
    db._save();
    return this.battleView(jid, msg);
  }

  // ─── FLEE ───
  fleeBattle(jid) {
    const b = battles[jid];
    if (!b) return { error: "⚔️ Tidak ada pertempuran aktif." };
    const fled = this._chance(50);
    const savedHp = b.playerHp;
    const monsterRef = { ...b.monster };
    delete battles[jid];
    const player = this.getPlayer(jid);
    if (fled) {
      player.hp = savedHp;
      db._save();
      return { msg: `🏃 *KABUR!*\nKamu berhasil melarikan diri dari ${monsterRef.emoji} *${monsterRef.name}*!` };
    }
    const penalty = this._rand(10, 30);
    player.hp = Math.max(0, savedHp - penalty);
    db._save();
    return { msg: `🚫 *GAGAL KABUR!*\n${monsterRef.emoji} *${monsterRef.name}* menangkapmu! -${penalty} HP` };
  }

  // ─── Battle View ───
  battleView(jid, extraMsg = "") {
    const b = battles[jid];
    if (!b) return { error: "No battle" };
    const m = b.monster;
    const php = Math.round((b.playerHp / b.maxPlayerHp) * 100);
    const mhp = Math.round((b.monsterHp / b.maxMonsterHp) * 100);
    return {
      view: true,
      text: extraMsg +
        `╔═══════════════════════╗\n` +
        `║  ⚔️ *BATTLE!* Turn ${b.turns + 1}\n` +
        `╠═══════════════════════╣\n` +
        `║ *KAMU* ❤️ ${b.playerHp}/${b.maxPlayerHp} (${php}%)\n` +
        `║ ${this._progressBar(b.playerHp, b.maxPlayerHp)}\n` +
        `║ ─────────────────\n` +
        `║ ${m.emoji} *${m.name}* ❤️ ${b.monsterHp}/${b.maxMonsterHp} (${mhp}%)\n` +
        `║ ${this._progressBar(b.monsterHp, b.maxMonsterHp)}\n` +
        `╠═══════════════════════╣\n` +
        `║ Pilih aksi:\n` +
        `╚═══════════════════════╝`,
      monster: m,
    };
  }

  // ─── HUNT ───
  hunt(jid) {
    const player = this.getPlayer(jid);
    if (!player) return { error: "❌ Player tidak ditemukan." };
    if (player.hp <= 0) return { error: "💀 HP habis! Gunakan `.heal`." };

    const roll = Math.random() * 100;
    let cumulative = 0;
    let reward = null;
    for (const r of HUNT_REWARDS) {
      cumulative += r.chance;
      if (roll <= cumulative) { reward = r; break; }
    }
    if (!reward) reward = HUNT_REWARDS[HUNT_REWARDS.length - 1];

    if (reward.type === "gold") {
      const amt = this._rand(reward.min, reward.max);
      db.addMoney(jid, amt);
      return { msg: `🏹 *HUNTING...*\n\n${reward.emoji} Kamu menemukan *${reward.name}*!\n💰 +$${amt.toLocaleString()}` };
    } else if (reward.type === "item") {
      this.addItem(jid, reward.id);
      const shopItem = SHOP.find(s => s.id === reward.id);
      return { msg: `🏹 *HUNTING...*\n\n${reward.emoji} Kamu menemukan *${reward.name}*!\n📦 +1 ${shopItem?.emoji} ${shopItem?.name} (masuk inventory)` };
    } else if (reward.type === "exp") {
      const amt = this._rand(reward.min, reward.max);
      db.addXp(jid, amt);
      return { msg: `🏹 *HUNTING...*\n\n${reward.emoji} Kamu menemukan *${reward.name}*!\n✨ +${amt} XP` };
    } else {
      return { msg: `🏹 *HUNTING...*\n\n${reward.emoji} ${reward.name}\nCoba lagi nanti!` };
    }
  }

  // ─── HEAL ───
  heal(jid) {
    const player = this.getPlayer(jid);
    if (!player) return { error: "❌ Player tidak ditemukan." };
    if (player.hp >= player.maxHp) return { msg: "❤️ HP kamu sudah penuh!" };
    if (!this.hasItem(jid, "potion") && !this.hasItem(jid, "superpot") && !this.hasItem(jid, "elixir")) {
      return { msg: "📦 Kamu tidak punya potion! Beli di `.shop` atau cari di `.hunt`." };
    }

    // Use best potion first
    let used;
    if (this.hasItem(jid, "elixir")) {
      this.removeItem(jid, "elixir");
      player.hp = player.maxHp;
      used = "🍾 Elixir Max";
    } else if (this.hasItem(jid, "superpot")) {
      this.removeItem(jid, "superpot");
      player.hp = Math.min(player.maxHp, player.hp + 150);
      used = "🧴 Super Potion (+150 HP)";
    } else {
      this.removeItem(jid, "potion");
      player.hp = Math.min(player.maxHp, player.hp + 50);
      used = "🧪 Health Potion (+50 HP)";
    }
    db._save();
    return { msg: `💚 *HEALED!*\n\n${used}\n❤️ HP sekarang: ${player.hp}/${player.maxHp}` };
  }

  // ─── BUY ITEM ───
  buyItem(jid, itemId, qty = 1) {
    const item = SHOP.find(s => s.id === itemId);
    if (!item) return { error: "❌ Item tidak ditemukan di shop." };
    const total = item.price * qty;
    const u = db.getUser(jid);
    if (!u) return { error: "❌ Player tidak ditemukan." };
    if (u.money < total) return { error: `💰 Uang tidak cukup! Butuh $${total.toLocaleString()}, kamu punya $${u.money.toLocaleString()}.` };
    db.reduceMoney(jid, total);
    this.addItem(jid, itemId, qty);
    return { msg: `🛒 *PURCHASED!*\n\n${item.emoji} *${item.name}* x${qty}\n💰 -$${total.toLocaleString()}\n📦 Masuk inventory!` };
  }

  // ─── USE ITEM ───
  useItem(jid, itemId) {
    const item = SHOP.find(s => s.id === itemId);
    if (!item) return { error: "❌ Item tidak dikenal." };
    if (!this.hasItem(jid, itemId)) return { error: "📦 Kamu tidak punya item itu." };
    const player = this.getPlayer(jid);
    const u = db.getUser(jid);

    switch (item.type) {
      case "heal":
        this.removeItem(jid, itemId);
        if (itemId === "elixir") player.hp = player.maxHp;
        else if (itemId === "superpot") player.hp = Math.min(player.maxHp, player.hp + 150);
        else player.hp = Math.min(player.maxHp, player.hp + 50);
        db._save();
        return { msg: `${item.emoji} *${item.name}* digunakan!\n❤️ HP: ${player.hp}/${player.maxHp}` };

      case "weapon":
        this.removeItem(jid, itemId);
        if (!u.game) u.game = player;
        u.game.weapon = (u.game.weapon || 0) + 3;
        u.game.atk += 15;
        db._save();
        return { msg: `${item.emoji} *${item.name}* diaktifkan!\n⚔️ +15 ATK untuk 3 battle berikutnya.` };

      case "armor":
        this.removeItem(jid, itemId);
        if (!u.game) u.game = player;
        u.game.armor = (u.game.armor || 0) + 3;
        u.game.def += 15;
        db._save();
        return { msg: `${item.emoji} *${item.name}* diaktifkan!\n🛡️ +15 DEF untuk 3 battle berikutnya.` };

      case "boost":
        this.removeItem(jid, itemId);
        if (!u.game) u.game = player;
        u.game.boost = (u.game.boost || 0) + 3;
        db._save();
        return { msg: `${item.emoji} *${item.name}* diaktifkan!\n📈 Boost untuk 3 battle berikutnya.` };

      case "instant":
        this.removeItem(jid, itemId);
        db.addXp(jid, 100);
        db._save();
        return { msg: `${item.emoji} *${item.name}* digunakan!\n✨ +100 XP!` };

      default:
        return { error: "❌ Item tidak bisa digunakan." };
    }
  }

  // ─── SHOP VIEW ───
  shopView() {
    let txt = `╔═══════════════════════╗\n║  🏪 *SHOP* 🏪\n╠═══════════════════════╣\n`;
    SHOP.forEach(s => {
      txt += `║ ${s.emoji} *${s.name}*\n║ 💰 $${s.price.toLocaleString()}\n║ 📝 ${s.desc}\n║ ID: \`.buy ${s.id}\`\n║ ─────────────────\n`;
    });
    txt += `╚═══════════════════════╝`;
    return txt;
  }

  // ─── INVENTORY VIEW ───
  inventoryView(jid) {
    const inv = this.getInventory(jid);
    const player = this.getPlayer(jid);
    const u = db.getUser(jid);
    const items = Object.entries(inv);
    if (items.length === 0) {
      return `╔═══════════════════════╗\n║  📦 *INVENTORY*\n╠═══════════════════════╣\n║ Kosong! 🫙\n║ Beli di .shop atau .hunt\n╚═══════════════════════╝`;
    }
    let txt = `╔═══════════════════════╗\n║  📦 *INVENTORY*\n║ ${u.name}\n╠═══════════════════════╣\n`;
    items.forEach(([id, qty]) => {
      const s = SHOP.find(x => x.id === id);
      const name = s ? `${s.emoji} ${s.name}` : id;
      txt += `║ ${name} x${qty}\n`;
      if (s && s.type !== "instant") txt += `║  ↳ Gunakan: \`.use ${id}\`\n`;
    });
    txt += `╠═══════════════════════╣\n`;
    txt += `║ ❤️ HP: ${player.hp}/${player.maxHp}\n`;
    txt += `║ ⚔️ ATK: ${player.atk} | 🛡️ DEF: ${player.def}\n`;
    if (u.game?.weapon) txt += `║ 🗡️ Weapon aktif: ${u.game.weapon} battle\n`;
    if (u.game?.armor) txt += `║ 🔰 Armor aktif: ${u.game.armor} battle\n`;
    if (u.game?.boost) txt += `║ 📈 Boost aktif: ${u.game.boost} battle\n`;
    txt += `╚═══════════════════════╝`;
    return txt;
  }

  // ─── Apply equipment decay after battle ───
  afterBattle(jid) {
    const u = db.getUser(jid);
    if (!u?.game) return;
    const g = u.game;
    if (g.weapon > 0) {
      g.weapon--;
      if (g.weapon <= 0) g.atk = Math.max(10, g.atk - 15);
    }
    if (g.armor > 0) {
      g.armor--;
      if (g.armor <= 0) g.def = Math.max(5, g.def - 15);
    }
    if (g.boost > 0) g.boost--;
    db._save();
  }

  // ─── Check active battle ───
  isInBattle(jid) { return !!battles[jid]; }
  getBattle(jid) { return battles[jid] || null; }
}

const game = new Game();
export { game, SHOP, MONSTERS };
export default game;