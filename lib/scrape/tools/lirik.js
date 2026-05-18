import axios from "axios";
import * as cheerio from "cheerio";

const extractLyrics = html => {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();

  const clean = f => {
    if (!f) return "";
    let s = String(f)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|li|section|article|header|footer)[^>]*>/gi, "\n")
      .replace(/<\/?[^>]+>/g, "");
    s = cheerio.load(`<div>${s}</div>`)("div").text();
    return s.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").trim();
  };

  const sel = [
    '[data-lyrics-container="true"]',
    'div[class*="Lyrics__Container"]',
    "div.lyrics",
    ".song_body-lyrics",
    ".lyrics__root"
  ];
  for (const s of sel) {
    const el = $(s);
    if (!el.length) continue;
    const parts = [];
    el.each((i, e) => {
      const txt = clean($(e).html() || "");
      if (txt) parts.push(txt);
    });
    if (!parts.length) continue;
    let text = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    return text.length > 50 ? text : null;
  }
  return null;
};

export async function searchLirik(query) {
  try {
    const api = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`;
    const hd = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/json" };
    const { data: j } = await axios.get(api, { headers: hd });
    const sec = j?.response?.sections?.find(s => s.type === "song");
    if (!sec?.hits?.length) return { success: false, error: "Lagu tidak ditemukan" };

    const song = sec.hits[0].result;
    const { data: page } = await axios.get(song.url, { headers: { "User-Agent": hd["User-Agent"] } });
    const lyrics = extractLyrics(page);

    return {
      success: true,
      title: song.full_title,
      thumbnail: song.song_art_image_url,
      url: song.url,
      lyrics: lyrics || "Lirik tidak bisa diekstrak"
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}