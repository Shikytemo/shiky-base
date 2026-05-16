import axios from "axios";

const API = "https://www.tikwm.com/api/";
const MAX_RETRY = 5;
const DELAY = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Download TikTok video/slide via tikwm.com API
 * Auto retry up to 5x jika gagal
 */
export async function tiktokDl(url) {
  let lastErr;
  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      const { data: res } = await axios.post(API, new URLSearchParams({ url, hd: 1 }), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
        timeout: 15000,
      });

      if (res.code !== 0) throw new Error(res.msg || "TikTok API error");

      const d = res.data;
      const isSlide = Array.isArray(d.images) && d.images.length > 0;

      return {
        type: isSlide ? "image" : "video",
        id: d.id,
        title: d.title,
        cover: d.cover,
        duration: d.duration,
        author: {
          name: d.author?.nickname,
          username: d.author?.unique_id,
          avatar: d.author?.avatar,
        },
        video: {
          noWm: d.play,
          withWm: d.wmplay,
          size: d.size,
          wmSize: d.wm_size,
        },
        music: {
          url: d.music,
          title: d.music_info?.title,
          author: d.music_info?.author,
        },
        images: isSlide ? d.images : [],
        stats: {
          play: d.play_count,
          like: d.digg_count,
          comment: d.comment_count,
          share: d.share_count,
          download: d.download_count,
        },
      };
    } catch (err) {
      lastErr = err;
      if (i < MAX_RETRY - 1) await sleep(DELAY * (i + 1));
    }
  }
  throw lastErr;
}
