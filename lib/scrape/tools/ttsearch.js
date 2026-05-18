import axios from "axios";

export async function ttSearch(query) {
  try {
    const { data } = await axios.post("https://tikwm.com/api/feed/search", {
      keywords: query, count: 12, cursor: 0, web: 1, hd: 1
    }, {
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "cookie": "current_language=en",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36"
      }
    });
    return { success: true, videos: data.data?.videos || [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}