import axios from "axios";
import crypto from "crypto";

// ─── Mega Downloader ───
// Download files from mega.nz
export async function megaDL(megaUrl) {
  try {
    const match = megaUrl.match(/mega\.nz\/(?:#!|file\/)([a-zA-Z0-9_-]+)[!#]([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error("Invalid MEGA URL format.");
    const [, fileId, key] = match;

    const { data } = await axios.post("https://g.api.mega.co.nz/cs", [
      { a: "g", g: 1, ssl: 2, v: 2, p: fileId },
    ], { headers: { "Content-Type": "application/json" } });

    const fileInfo = data[0];
    if (!fileInfo || !fileInfo.at) throw new Error("File not found.");

    const keyBuffer = Buffer.from(
      key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (key.length % 4)) % 4),
      "base64"
    );

    const paddedKey = Buffer.concat([keyBuffer, Buffer.alloc((4 - (keyBuffer.length % 4)) % 4)]);
    let keyArray = Array.from({ length: paddedKey.length / 4 }, (_, i) => paddedKey.readUInt32BE(i * 4));
    if (keyArray.length === 8) {
      keyArray = [keyArray[0] ^ keyArray[4], keyArray[1] ^ keyArray[5], keyArray[2] ^ keyArray[6], keyArray[3] ^ keyArray[7]];
    }

    const keyBuf = Buffer.alloc(keyArray.length * 4);
    keyArray.forEach((val, i) => keyBuf.writeUInt32BE(val >>> 0, i * 4));

    const encAttr = Buffer.from(
      fileInfo.at.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (fileInfo.at.length % 4)) % 4),
      "base64"
    );

    const decipher = crypto.createDecipheriv("aes-128-cbc", keyBuf, Buffer.alloc(16, 0));
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(encAttr), decipher.final()]);
    const trimmed = decrypted.toString("utf8").replace(/\0+$/, "");
    const attributes = trimmed.startsWith("MEGA{") ? JSON.parse(trimmed.substring(4)) : { n: "Unknown" };

    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const sizeIdx = Math.floor(Math.log(fileInfo.s || 0) / Math.log(1024));
    const fileSize = `${(fileInfo.s / Math.pow(1024, sizeIdx || 0)).toFixed(2)} ${sizes[sizeIdx] || "Bytes"}`;

    return {
      success: true,
      fileId,
      fileName: attributes.n || "Unknown",
      fileSize,
      downloadUrl: fileInfo.g,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}