import { fetchPage, cleanText, truncate } from "../utils.js";

// ─── Search Scraper ───
// Uses Bing (reliable, no JS needed, works on Termux)
export async function googleSearch(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const $ = await fetchPage(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
    });

    const results = [];
    $("#b_results .b_algo").each((i, el) => {
      if (results.length >= 5) return;
      const h2 = $(el).find("h2");
      const title = cleanText(h2.text());
      // Bing wraps h2 in <a> on mobile, or has <a> inside h2 on desktop
      const link = h2.find("a").attr("href") || h2.parent("a").attr("href") || "";
      const snippet = cleanText($(el).find(".b_caption p, p").first().text());

      if (title) {
        results.push({
          title,
          link: link.startsWith("http") ? link : null,
          snippet: truncate(snippet, 150) || null,
        });
      }
    });

    if (results.length === 0) {
      return { success: false, error: "Tidak ada hasil pencarian." };
    }

    return { success: true, query, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
