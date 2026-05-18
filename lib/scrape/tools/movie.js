import { fetchPage, cleanText, truncate } from "../utils.js";

// ─── Movie Scraper ───
// Uses TMDB (themoviedb.org) — reliable, no JS needed, works on Termux
export async function movieInfo(query) {
  try {
    // Step 1: Search TMDB for the movie
    const searchUrl = `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(query)}`;
    const $ = await fetchPage(searchUrl, {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
    });

    // Find first movie link with an ID
    let moviePath = null;
    $("a[href*='/movie/']").each((i, el) => {
      if (moviePath) return;
      const href = $(el).attr("href");
      const match = href?.match(/\/movie\/(\d+)/);
      if (match) moviePath = href;
    });

    if (!moviePath) {
      return { success: false, error: `Film "${query}" tidak ditemukan.` };
    }

    const movieUrl = moviePath.startsWith("http") ? moviePath : `https://www.themoviedb.org${moviePath}`;

    // Step 2: Scrape the movie page
    const $$ = await fetchPage(movieUrl, {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
    });

    // Title (includes year)
    const titleRaw = cleanText($$(".title h2, .title span").first().text());
    const yearMatch = titleRaw.match(/\((\d{4})\)$/);
    const title = titleRaw.replace(/\s*\(\d{4}\)\s*$/, "").trim();
    const year = yearMatch ? yearMatch[1] : null;

    // Rating (data-percent = percentage out of 100)
    const ratingPercent = $$(".user_score_chart").attr("data-percent");
    const rating = ratingPercent ? (parseFloat(ratingPercent) / 10).toFixed(1) : null;

    // Other details
    const tagline = cleanText($$(".tagline").text());
    const overview = cleanText($$(".overview p, .overview").first().text());
    const genres = [];
    $$(".genres a").each((i, el) => {
      const t = cleanText($$(el).text());
      if (t) genres.push(t);
    });
    const runtime = cleanText($$(".runtime").text());
    const release = cleanText($$(".release_date").text()).replace(/[()]/g, "").trim();

    // Image (upgrade to larger size)
    const imgSmall = $$(".poster img, .image_content img").first().attr("src");
    const image = imgSmall ? imgSmall.replace(/\/p\/w\d+/, "/p/w500") : null;

    // Director — first person link is usually the director
    let director = null;
    const firstPerson = $$("a[href*='/person/']").first();
    if (firstPerson.length) {
      director = cleanText(firstPerson.text());
    }

    return {
      success: true,
      title: title || query,
      rating,
      year: year || release || null,
      genre: genres.join(", ") || null,
      duration: runtime || null,
      director,
      plot: truncate(overview, 400) || tagline || null,
      image,
      url: movieUrl,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
