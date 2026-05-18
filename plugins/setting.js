import botSettings from "../lib/botSettings.js";
import { singleSelectButton } from "shileys";
import setting from "../setting.js";

const handler = {
  command: ["set", "setting"],
  category: "admin",
  description: "Mengatur konfigurasi bot",
  async run({ sock, m, args, isOwner, sender, prefix, reply }) {
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
      const labels = { 
        autoread: "Auto Read", 
        autotyping: "Auto Typing", 
        antispam: "Anti Spam", 
        gamemode: "Game Mode", 
        welcome: "Welcome Message", 
        selfmode: "Self Mode",
        autoupdate: "Auto Update"
      };
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
};

export default handler;
