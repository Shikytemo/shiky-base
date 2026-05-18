import { fetchPage, cleanText, truncate } from "../utils.js";

// ─── Anime Info Scraper ───
// Scrape MyAnimeList (mal) for anime info
export async function animeInfo(query) {
  try {
    const searchUrl = `https://myanimelist.net/search/prefix.json?type=anime&keyword=${encodeURIComponent(query)}&v=1`;
    // MAL has a JSON search prefix endpoint, but user wants pure scrape
    // So let's scrape the search page instead
    const $ = await fetchPage(`https://myanimelist.net/anime.php?q=${encodeURIComponent(query)}&cat=anime`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    // Get first result link
    const firstLink = $("table a.hoverinfo_trigger, .js-anime-category a").first().attr("href");
    if (!firstLink) {
      return { success: false, error: `Anime "${query}" tidak ditemukan.` };
    }

    const animeUrl = firstLink.startsWith("http") ? firstLink : `https://myanimelist.net${firstLink}`;

    // Scrape the anime page
    const $$ = await fetchPage(animeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    const title = cleanText($$("h1 span").first().text() || $$("h1").text());
    const score = cleanText($$("[itemprop='ratingValue']").text()) || cleanText($$(".score-label").first().text());
    const synopsis = truncate(cleanText($$("[itemprop='description'], .js-synopsis").text()), 400);
    const image = $$("img[itemprop='image'], .leftside img").first().attr("data-src") || $$("img[itemprop='image']").first().attr("src");

    // Get details from sidebar
    const details = {};
    $$(".leftside .spaceit_pad, .leftside .dark_text").each((i, el) => {
      const text = cleanText($$(el).text());
      if (text.includes("Episodes:")) details.episodes = text.replace("Episodes:", "").trim();
      if (text.includes("Status:")) details.status = text.replace("Status:", "").trim();
      if (text.includes("Aired:")) details.aired = text.replace("Aired:", "").trim();
      if (text.includes("Studios:")) details.studios = text.replace("Studios:", "").trim();
      if (text.includes("Genre") || text.includes("Genres")) details.genres = text.replace(/Genres?:/, "").trim();
      if (text.includes("Rating:")) details.rating = text.replace("Rating:", "").trim();
      if (text.includes("Duration:")) details.duration = text.replace("Duration:", "").trim();
    });

    return {
      success: true,
      title,
      score: score || null,
      synopsis: synopsis || null,
      image: image || null,
      url: animeUrl,
      details,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
