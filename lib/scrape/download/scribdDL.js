import axios from "axios";
import FormData from "form-data";

// ─── Scribd Downloader ───
// Download documents from Scribd
export async function scribdDL(url) {
  try {
    if (!url.includes("scribd.com")) throw new Error("URL Scribd tidak valid");

    const form = new FormData();
    form.append("action", "scribd_action_slide");
    form.append("code", "download");
    form.append("scribd", `scribd_video_url=${encodeURIComponent(url)}`);

    const { data } = await axios.post("https://scribdownloader.com/wp-admin/admin-ajax.php", form, {
      headers: {
        ...form.getHeaders(),
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
      },
    });

    return { success: true, result: data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}