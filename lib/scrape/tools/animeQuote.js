import axios from "axios";

// ─── Anime Quote ───
// Random anime quotes from otakotaku.com
export async function animeQuote() {
  try {
    const page = Math.floor(Math.random() * 184);
    const { data } = await axios.get(`https://otakotaku.com/quote/feed/${page}`);

    // Use regex to extract links from the feed
    const links = [...data.matchAll(/href="(\/quote\/[^"]+)"/g)].map((m) => `https://otakotaku.com${m[1]}`);

    if (links.length === 0) throw new Error("No quotes found.");

    const randomLink = links[Math.floor(Math.random() * links.length)];
    const { data: quoteHtml } = await axios.get(randomLink);

    const char = (quoteHtml.match(/href="\/character\/[^"]+">([^<]+)</) || [])[1] || "Unknown";
    const anime = (quoteHtml.match(/href="\/anime\/[^"]+">([^<]+)</) || [])[1] || "Unknown";
    const text = (quoteHtml.match(/<blockquote[^>]*><p>([^<]+)<\/p>/) || [])[1] || "No quote text";

    return {
      success: true,
      character: char.trim(),
      anime: anime.trim(),
      quote: text.trim(),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}