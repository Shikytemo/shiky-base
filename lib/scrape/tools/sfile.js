import { load } from "cheerio";

export async function sfileSearch(query, page = 1) {
  try {
    const res = await fetch(`https://sfile.mobi/search.php?q=${query}&page=${page}`);
    const $ = load(await res.text());
    const result = [];
    $("div.list").each(function () {
      const title = $(this).find("a").text();
      const size = $(this).text().trim().split("(")[1]?.replace(")", "");
      const link = $(this).find("a").attr("href");
      if (link) result.push({ title, size, link });
    });
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function sfileDl(url) {
  try {
    const res = await fetch(url);
    const $ = load(await res.text());
    const filename = $("div.w3-row-padding").find("img").attr("alt");
    const mimetype = $("div.list").text().split(" - ")[1]?.split("\n")[0];
    const filesize = $("#download").text().replace(/Download File/g, "").replace(/\(|\)/g, "").trim();
    const download = $("#download").attr("href") + "&k=" + Math.floor(Math.random() * 6 + 10);
    return { success: true, filename, filesize, mimetype, download };
  } catch (e) {
    return { success: false, error: e.message };
  }
}