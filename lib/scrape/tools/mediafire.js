import axios from "axios";
import { load } from "cheerio";

export async function mediafireDl(url) {
  try {
    const { data } = await axios.get(url);
    const $ = load(data);
    const link = $("a#downloadButton").attr("href");
    const size = $("a#downloadButton").text().replace(/Download|\(|\)|\n/g, "").trim();
    const filename = link?.split("/")[5] || "unknown";
    return { success: true, filename, size, download: link };
  } catch (e) {
    return { success: false, error: e.message };
  }
}