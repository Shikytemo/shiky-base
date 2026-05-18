import axios from "axios";
import { load } from "cheerio";

export async function stickerSearch(query) {
  try {
    const { data } = await axios.get(`https://getstickerpack.com/stickers?query=${query}`);
    const $ = load(data);
    const links = [];
    $("#stickerPacks > div > div:nth-child(3) > div > a").each((i, el) => links.push($(el).attr("href")));
    if (!links.length) return { success: false, error: "Sticker tidak ditemukan" };
    const rand = links[Math.floor(Math.random() * links.length)];
    const { data: detail } = await axios.get(rand);
    const $$ = load(detail);
    const stickers = [];
    $$("#stickerPack > div > div.row > div > img").each((i, el) => stickers.push($$(el).attr("src").split("&d=")[0]));
    return {
      success: true,
      title: $$("#intro > div > div > h1").text(),
      author: $$("#intro > div > div > h5 > a").text(),
      stickers
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function ttRandom(query) {
  try {
    const { data } = await axios.post("https://tikwm.com/api/feed/search",
      { keywords: query, count: 10, cursor: 0, HD: 1 },
      { headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Cookie": "current_language=en", "User-Agent": "Mozilla/5.0" } }
    );
    const videos = data.data?.videos;
    if (!videos?.length) return { success: false, error: "Tidak ada video" };
    const v = videos[Math.floor(Math.random() * videos.length)];
    return { success: true, title: v.title, cover: v.cover, no_watermark: v.play, watermark: v.wmplay, music: v.music };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function surah(no) {
  try {
    const { data } = await axios.get(`https://kalam.sindonews.com/surah/${no}`);
    const $ = load(data);
    const ar = [], id = [], lt = [];
    $("div.ayat-arab").each((i, el) => ar.push($(el).text()));
    $("li > div.ayat-text").each((i, el) => id.push($(el).text().replace(",", "").trim()));
    $("div.ayat-latin").each((i, el) => lt.push($(el).text().trim()));
    const result = ar.map((arab, i) => ({ arab, indo: id[i] || "", latin: lt[i] || "" }));
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}