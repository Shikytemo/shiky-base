import { fetchPage, cleanText, truncate } from "../utils.js";

// ─── News/Berita Scraper ───
// Scrape Indonesian news from detik.com or Google News
export async function berita(kategori = "terpopuler") {
  try {
    // Scrape detik.com terpopuler
    const urlMap = {
      terpopuler: "https://www.detik.com/terpopuler",
      teknologi: "https://www.detik.com/terpopuler/tech",
      sport: "https://www.detik.com/terpopuler/sport",
      entertainment: "https://www.detik.com/terpopuler/entertainment",
      bisnis: "https://www.detik.com/terpopuler/finance",
      health: "https://www.detik.com/terpopuler/health",
    };
    const url = urlMap[kategori.toLowerCase()] || urlMap.terpopuler;

    const $ = await fetchPage(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9",
      },
    });

    const articles = [];
    $(".list-content .media, .list-berita .media, article").each((i, el) => {
      if (articles.length >= 8) return;
      const titleEl = $(el).find("a[title], .media__title a, h2 a, h3 a").first();
      const title = titleEl.attr("title") || cleanText(titleEl.text());
      const link = titleEl.attr("href");
      const time = cleanText($(el).find(".media__date span, time, .date").last().text());
      const img = $(el).find("img").first().attr("src") || $(el).find("img").first().attr("data-src");

      if (title && link) {
        articles.push({
          title: truncate(title, 100),
          link: link.startsWith("http") ? link : `https://www.detik.com${link}`,
          time: time || null,
          image: img || null,
        });
      }
    });

    // Fallback: try another selector structure
    if (articles.length === 0) {
      $(".grid-row .grid-col, .ph_news, .box-berita").each((i, el) => {
        if (articles.length >= 8) return;
        const title = cleanText($(el).find("a").first().text());
        const link = $(el).find("a").first().attr("href");
        if (title && link) {
          articles.push({
            title: truncate(title, 100),
            link: link.startsWith("http") ? link : `https://www.detik.com${link}`,
            time: null,
            image: null,
          });
        }
      });
    }

    if (articles.length === 0) {
      return { success: false, error: "Gagal ambil berita. Coba lagi nanti." };
    }

    return { success: true, kategori, articles };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
