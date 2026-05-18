import axios from "axios";

// ─── Unsplash Image Search ───
// Search high-quality free images from Unsplash
export async function unsplashSearch(q) {
  try {
    if (!q) throw new Error("Query diperlukan");
    const { data } = await axios.get(
      `https://unsplash.com/napi/search/photos?page=1&per_page=5&query=${encodeURIComponent(q)}`,
      { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36" } }
    );

    if (!data.results || data.results.length === 0) throw new Error(`Gambar "${q}" tidak ditemukan`);

    const results = data.results.map((r) => ({
      title: r.alt_description || "No Title",
      author: r.user?.name || "Unknown",
      likes: r.likes || 0,
      image: r.urls?.regular || r.urls?.small,
      download: r.links?.download,
      url: r.links?.html,
    }));

    return { success: true, query: q, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
