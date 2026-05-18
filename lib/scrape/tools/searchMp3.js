import { load } from "cheerio";

export async function searchMp3(query) {
  try {
    const res = await fetch(`https://justnaija.com/search?q=${query}&SearchIt=`);
    const $ = load(await res.text());
    const results = [];
    $("article.result").each((i, el) => {
      results.push({
        title: $(el).find("h3.result-title a").text().trim(),
        url: $(el).find("h3.result-title a").attr("href"),
        thumb: $(el).find("div.result-img img").attr("src"),
        desc: $(el).find("p.result-desc").text().trim()
      });
    });
    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function appSearch(query) {
  try {
    const res = await fetch(`https://m.playmods.net/id/search/${query}`);
    const $ = load(await res.text());
    const results = [];
    $("a.beautify.ajax-a-1").each((i, el) => {
      results.push({
        title: $(el).find(".common-exhibition-list-detail-name").text().trim(),
        menu: $(el).find(".common-exhibition-list-detail-menu").text().trim(),
        detail: $(el).find(".common-exhibition-list-detail-txt").text().trim(),
        image: $(el).find(".common-exhibition-list-icon img").attr("data-src"),
        link: "https://m.playmods.net" + $(el).attr("href")
      });
    });
    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}