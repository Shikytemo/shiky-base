import axios from "axios";

// ─── Lyrics Search (lrclib) ───
// Search song lyrics with synced timestamps
export async function lyricsSearch(title) {
  try {
    if (!title) throw new Error("Judul lagu diperlukan");
    const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`, {
      headers: {
        referer: `https://lrclib.net/search/${encodeURIComponent(title)}`,
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
      },
    });

    if (!data || data.length === 0) throw new Error(`Lirik "${title}" tidak ditemukan`);

    const first = data[0];
    return {
      success: true,
      title: first.trackName || first.title,
      artist: first.artistName || first.artist,
      album: first.albumName || first.album || null,
      duration: first.duration ? `${Math.floor(first.duration / 60)}:${String(first.duration % 60).padStart(2, "0")}` : null,
      lyrics: first.syncedLyrics || first.plainLyrics || null,
      instrumental: first.instrumental || false,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
