import { Sticker } from "wa-sticker-formatter";
import { downloadMediaMessage } from "shileys";
import Pino from "pino";

const handler = {
  command: ["s", "stiker", "sticker"],
  category: "tools",
  description: "Mengubah gambar/video menjadi stiker",
  async run({ sock, m, isImage, isVideo, isQuotedImage, isQuotedVideo, setting, reply }) {
    if (!isImage && !isVideo && !isQuotedImage && !isQuotedVideo) 
      return reply("📸 Kirim atau reply foto/video untuk dijadikan stiker!");
    
    try {
      await m.react("⏳");
      const quotedMsg = m.quoted || null;
      const mediaMsg = isQuotedImage || isQuotedVideo ? { message: quotedMsg.message } : { message: m.message };
      const buffer = await downloadMediaMessage(mediaMsg, "buffer", {}, { Pino, reuploadRequest: sock.updateMediaMessage });
      
      const sticker = new Sticker(buffer, {
        pack: setting.name,
        author: "github.com/Shikytemo",
        type: isVideo || isQuotedVideo ? "full" : "default",
        quality: 80
      });
      
      await sock.sendMessage(m.chat, { sticker: await sticker.toBuffer() }, { quoted: m });
      await m.react("✅");
    } catch (err) {
      console.log(err);
      await m.react("❌");
      reply("❌ *Gagal membuat stiker!*");
    }
  }
};

export default handler;
