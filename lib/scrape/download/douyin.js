import axios from "axios";

export async function douyinDl(url) {
  try {
    const { data } = await axios.post(
      "https://snapdouyin.app/wp-json/mx-downloader/video-data/",
      { url },
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    return { success: true, ...data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}