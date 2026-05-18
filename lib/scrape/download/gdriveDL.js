import axios from "axios";

// ─── Google Drive Downloader ───
// Download files from Google Drive
const API_KEY = "AIzaSyAA9ERw-9LZVEohRYtCWka_TQc6oXmvcVU";

export async function gdriveDL(url) {
  try {
    const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /folders\/([a-zA-Z0-9_-]+)/, /^([a-zA-Z0-9_-]+)$/];
    let fileId = null;
    for (const p of patterns) { const m = url.match(p); if (m) { fileId = m[1]; break; } }
    if (!fileId) throw new Error("Invalid Google Drive URL.");

    const { data: meta } = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?key=${API_KEY}&fields=id,name,mimeType,size,webContentLink,owners,createdTime`
    );

    if (meta.mimeType === "application/vnd.google-apps.folder") {
      const { data: list } = await axios.get(
        `https://www.googleapis.com/drive/v3/files?key=${API_KEY}&q='${fileId}'+in+parents&fields=files(id,name,mimeType,size)`
      );
      const files = (list.files || []).filter((f) => !f.mimeType.includes("folder")).map((f) => ({
        id: f.id, name: f.name, size: f.size ? `${(f.size / 1024 / 1024).toFixed(2)} MB` : "N/A",
        download: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`,
      }));
      return { success: true, type: "folder", name: meta.name, files };
    }

    return {
      success: true, type: "file",
      name: meta.name, size: meta.size ? `${(meta.size / 1024 / 1024).toFixed(2)} MB` : "N/A",
      download: `https://www.googleapis.com/drive/v3/files/${meta.id}?alt=media&key=${API_KEY}`,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}