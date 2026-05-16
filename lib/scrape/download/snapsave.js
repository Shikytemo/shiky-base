import { snapsave } from "snapsave-media-downloader";

const MAX_RETRY = 5;
const DELAY = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Download media dari Facebook/Instagram/TikTok/Twitter via snapsave.app
 * Auto retry up to 5x jika gagal
 */
export async function snapDl(url) {
  let lastErr;
  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      const res = await snapsave(url, { retry: 3, retryDelay: 1000 });

      if (!res.success) throw new Error(res.message || "Snapsave gagal");

      let platform = "unknown";
      if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) platform = "facebook";
      else if (/instagram\.com/i.test(url)) platform = "instagram";
      else if (/tiktok\.com/i.test(url)) platform = "tiktok";
      else if (/twitter\.com|x\.com/i.test(url)) platform = "twitter";

      const data = res.data || {};
      const media = (data.media || []).filter(m => !m.shouldRender);

      return {
        success: true,
        platform,
        description: data.description || "",
        preview: data.preview || "",
        media: media.map(m => ({
          url: m.url,
          type: m.type || "video",
          resolution: m.resolution || "",
          thumbnail: m.thumbnail || "",
        })),
      };
    } catch (err) {
      lastErr = err;
      if (i < MAX_RETRY - 1) await sleep(DELAY * (i + 1));
    }
  }
  throw lastErr;
}
