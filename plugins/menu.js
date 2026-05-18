import db from "../lib/database.js";
import setting from "../setting.js";
import moment from "moment-timezone";
import plugins from "../lib/plugins.js";

const handler = {
  command: ["menu", "help"],
  category: "main",
  description: "Menampilkan menu bot",
  async run({ sock, m, pushname, sender, prefix }) {
    const p = db.getProfile(sender);
    const tier = p ? p.tier : db.getTier(1);
    const xpBar = p ? p.xpBar : "░░░░░░░░░░";
    const maxLim = p ? p.maxLimit : 25;

    const menuText = `Halo *${pushname}* 👋

┌─── *Player Info* ───
│ *ID:* ${sender.split("@")[0]}
│ *Name:* ${pushname}
│ *Role:* ${p ? p.roleDisplay : "User"}
│
│ ${tier.badge} *Tier ${tier.symbol}* - ${tier.name}
│ *Level:* ${p ? p.level : 1}
│ *XP:* ${p ? p.xp : 0}/${p ? p.xpNeeded : 50}
│ ${xpBar}
│
│ *Money:* $${p ? p.money.toLocaleString() : "0"}
│ *Limit:* ${p ? (p.limit >= 99999 ? "♾️" : p.limit) : 25}/${maxLim}
│ *Total Cmd:* ${p ? p.totalCmd : 0}
└─────────────────

_Bot ini memiliki banyak fitur yang sudah di-upgrade ke versi terbaru. Silakan pilih kategori di bawah:_`;

    const allPlugins = plugins.getAll();
    const categories = [...new Set(allPlugins.map(p => p.category))].filter(Boolean);
    
    const rows = categories.map(cat => ({
      title: `📁 Category: ${cat.toUpperCase()}`,
      description: `Lihat semua perintah di kategori ${cat}`,
      id: `${prefix}listmenu ${cat}`
    }));

    // Add a row for all commands
    rows.unshift({
      title: "📋 All Commands",
      description: "Tampilkan semua perintah yang tersedia",
      id: `${prefix}allmenu`
    });

    await sock.sendMessage(m.chat, {
      image: { url: "https://files.catbox.moe/7jmjhh.jpeg" },
      title: setting.name,
      text: menuText,
      footer: `© ${setting.name} | ${moment().format("HH:mm:ss")}`,
      interactiveButtons: [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📋 Pilih Kategori",
            sections: [{ title: "Main Menu", rows }]
          })
        }
      ]
    }, { quoted: m, ephemeralExpiration: m.contextInfo?.expiration });
  }
};

export default handler;
