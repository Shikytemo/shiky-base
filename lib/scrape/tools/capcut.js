import axios from "axios";
import { load } from "cheerio";

export async function capcutDl(url) {
  try {
    const token = url.match(/\d+/)[0];
    const { data } = await axios.get(`https://ssscapcut.com/api/download/${token}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36",
        "X-Requested-With": "acr.browser.barebones",
        "Referer": "https://ssscapcut.com/"
      }
    });
    return { success: true, title: data.title, desc: data.description, video: data.originalVideoUrl };
  } catch (e) {
    return { success: false, error: e.message };
  }
}