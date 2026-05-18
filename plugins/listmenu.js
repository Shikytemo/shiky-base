import plugins from "../lib/plugins.js";
import setting from "../setting.js";

const handler = {
  command: ["listmenu", "allmenu"],
  category: "main",
  description: "Menampilkan list perintah",
  async run({ sock, m, args, command, prefix }) {
    const allPlugins = plugins.getAll();
    let text = "";
    
    if (command === "allmenu") {
      const categories = [...new Set(allPlugins.map(p => p.category))].filter(Boolean).sort();
      text = `📋 *ALL COMMANDS*\n\n`;
      for (const cat of categories) {
        text += `┌─── *${cat.toUpperCase()}* ───\n`;
        const cmdInCategory = allPlugins.filter(p => p.category === cat);
        for (const p of cmdInCategory) {
          text += `│ • ${prefix}${p.command[0]}\n`;
        }
        text += `└─────────────────\n\n`;
      }
    } else {
      const cat = args[0]?.toLowerCase();
      if (!cat) return m.reply("Pilih kategori!");
      const cmdInCategory = allPlugins.filter(p => p.category === cat);
      if (!cmdInCategory.length) return m.reply("Kategori tidak ditemukan!");
      
      text = `📁 *CATEGORY: ${cat.toUpperCase()}*\n\n`;
      for (const p of cmdInCategory) {
        text += `• *${prefix}${p.command[0]}*\n  _${p.description || "-"}_\n\n`;
      }
    }
    
    await sock.sendMessage(m.chat, { text: text.trim() }, { quoted: m });
  }
};

export default handler;
