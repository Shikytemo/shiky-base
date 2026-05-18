export async function threadsDl(url) {
  try {
    const res = await fetch("https://snapthreads.net/api/download?url=" + encodeURIComponent(url), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
        "Referer": "https://snapthreads.net/"
      }
    });
    const j = await res.json();
    return { success: true, thumbnail: j.thumbnail };
  } catch (e) {
    return { success: false, error: e.message };
  }
}