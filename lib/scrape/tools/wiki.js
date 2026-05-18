import { fetchPage, cleanText, truncate } from "../utils.js";

// ─── Wikipedia Scraper ───
// Scrape id.wikipedia.org (Indonesian) or en.wikipedia.org
export async function wiki(query, lang = "id") {
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}&ns0=1`;
    const $ = await fetchPage(searchUrl);

    // Check if we landed directly on an article
    let articleUrl;
    const firstResult = $(".mw-search-result-heading a").first();
    if (firstResult.length) {
      articleUrl = `https://${lang}.wikipedia.org` + firstResult.attr("href");
    } else if ($("#mw-content-text").length && !$(".mw-search-results").length) {
      // Direct redirect to article
      articleUrl = searchUrl;
    } else {
      return { success: false, error: "Tidak ditemukan di Wikipedia." };
    }

    const $$ = await fetchPage(articleUrl);
    const title = cleanText($$("#firstHeading").text());
    const paragraphs = [];
    // Use broader selector — direct child > p fails on some wiki pages
    $$("#mw-content-text p").each((i, el) => {
      const t = cleanText($$(el).text());
      if (t.length > 30 && paragraphs.length < 3) paragraphs.push(t);
    });

    if (paragraphs.length === 0) {
      return { success: false, error: "Konten tidak ditemukan." };
    }

    const content = truncate(paragraphs.join("\n\n"), 800);
    const thumb = $$("#mw-content-text .infobox img, #mw-content-text .thumbimage").first().attr("src");
    const imageUrl = thumb ? (thumb.startsWith("http") ? thumb : `https:${thumb}`) : null;

    return { success: true, title, content, url: articleUrl, image: imageUrl };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
