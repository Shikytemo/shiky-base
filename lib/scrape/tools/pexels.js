import axios from "axios";

// ─── Pexels Image/Video Search ───
// Search free stock photos and videos from Pexels
export async function pexelsSearch(q, type = "photos") {
  try {
    if (!q) throw new Error("Query diperlukan");
    const typeList = ["photos", "videos"];
    if (!typeList.includes(type)) throw new Error(`Tipe: ${typeList.join(", ")}`);

    const { data } = await axios.get(
      `https://www.pexels.com/en-us/api/v3/search/${type}?query=${encodeURIComponent(q)}&page=1&per_page=5&orientation=all&size=all&sort=popular`,
      { headers: { "secret-key": "H2jk9uKnhRmL6WPwh89zBezWvr" } }
    );

    if (!data.data || data.data.length === 0) throw new Error(`"${q}" tidak ditemukan di Pexels`);

    const results = data.data.map((r) => ({
      title: r.attributes.title || "No Title",
      author: `${r.attributes.user.first_name || ""}${r.attributes.user.last_name ? " " + r.attributes.user.last_name.trim() : ""}`,
      type: r.type,
      ...(type === "photos"
        ? { image: r.attributes.image, download: r.attributes.image?.src }
        : { thumbnail: r.attributes.video?.thumbnail, video: r.attributes.video?.video_files?.[0]?.link }),
      url: `https://www.pexels.com/${r.type}/${r.attributes.slug}-${r.id}/`,
    }));

    return { success: true, query: q, type, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
