import axios from "axios";
import qs from "qs";
import { load } from "cheerio";

// ssstik.io - alternative TikTok downloader
export async function ssstik(url) {
  try {
    const { data: html } = await axios.post("https://ssstik.io/abc?url=dl",
      qs.stringify({ id: url, locale: "en", tt: "Taka Aja Ya Ges Yak", debug: "ab=0&loc=ID&ip=1.1.1.1.1" }),
      { headers: { "HX-Request": "true", "HX-Trigger": "_gcaptcha_pt", "HX-Target": "target", "HX-Current-URL": "https://ssstik.io/en-1", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36", Referer: "https://ssstik.io/en-1" } }
    );
    const $ = load(html);
    const images = [];
    $("img[data-splide-lazy]").each((i, el) => { const u = $(el).attr("data-splide-lazy"); if (u) images.push(u); });
    const mp3 = $("a.music").attr("href") || null;
    const author = $("h2").first().text().trim() || null;
    const video_hd = $("#hd_download").attr("data-directurl") || null;
    const video_nowm = $("a.without_watermark").attr("href") || null;
    if (images.length > 0) return { success: true, type: "image", author, mp3, images };
    return { success: true, type: "video", author, mp3, video: { hd: video_hd, no_watermark: video_nowm } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// DailyMotion downloader
export async function dailyMotion(url) {
  try {
    const { data } = await axios.post("https://vidomon.com/wp-json/aio-dl/video-data/", { url }, {
      headers: { "content-type": "application/json", origin: "https://vidomon.com", referer: "https://vidomon.com/" }
    });
    return { success: true, ...data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Apple Music search
export async function searchAppleMusic(query) {
  try {
    const { data: html } = await axios.get(`https://music.apple.com/id/search?term=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const $ = load(html);
    const script = $("#serialized-server-data").html();
    if (!script) return { success: false, error: "Data tidak ditemukan" };
    const json = JSON.parse(script);
    const songs = [];
    if (Array.isArray(json)) {
      for (const page of json) {
        if (!page.data?.sections) continue;
        for (const section of page.data.sections) {
          if (!section.items) continue;
          for (const item of section.items) {
            if (item.itemKind !== "songs") continue;
            const artwork = item.artwork?.dictionary?.url?.replace("{w}", "300").replace("{h}", "300").replace("{f}", "jpg");
            if (item.title && item.contentDescriptor?.url && artwork) {
              songs.push({ title: item.title, url: item.contentDescriptor.url, thumbnail: artwork });
            }
          }
        }
      }
    }
    return { success: true, data: songs };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Instagram DL v2 via snapinsta
export async function snapinsta(url) {
  try {
    const { data: cfData } = await axios.get("https://api.nekolabs.web.id/tls/bypass/cf-turnstile", {
      params: { url: "https://snapinsta.to", siteKey: "0x4AAAAAAA4IDAOil0Jqxtin" }
    });
    const body = new URLSearchParams({ q: url, t: "media", v: "v2", lang: "en", cftoken: cfData.result }).toString();
    const { data } = await axios.post("https://snapinsta.to/api/ajaxSearch", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", Referer: "https://snapinsta.to/en2", "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36" }
    });
    const $ = load(data.data);
    const downloads = $("a.abutton.is-success").map((_, el) => $(el).attr("href")).get();
    return { success: true, downloads };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Facebook DL v2 via publer
export async function fbdl2(url) {
  try {
    const { data: tk } = await axios.get("https://api.nekolabs.web.id/tls/bypass/cf-turnstile", {
      params: { url: "https://publer.com/tools/facebook-video-downloader", siteKey: "0x4AAAAAAA1JIGkp03IUKRWx" }
    });
    const { data: job } = await axios.post("https://app.publer.com/tools/media", { url, token: tk.result, macOS: false }, {
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", Referer: "https://publer.com/tools/facebook-video-downloader" }
    });
    let result;
    while (true) {
      const { data: status } = await axios.get(`https://app.publer.com/api/v1/job_status/${job.job_id}`);
      if (status.status === "complete") { result = status; break; }
      if (status.status !== "working") throw new Error(JSON.stringify(status));
      await new Promise(r => setTimeout(r, 2000));
    }
    return { success: true, download: result.payload?.[0]?.path || null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// OCR
export async function ocrBuffer(buffer) {
  try {
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    const { data: cf } = await axios.post("https://api.nekolabs.web.id/tools/bypass/cf-turnstile", {
      url: "https://freeocr.ai/", siteKey: "0x4AAAAAABrId8YvQ6YAVsLJ"
    });
    form.append("image", buffer, { filename: "image.jpg" });
    form.append("cf_token", cf.result);
    const { data } = await axios.post("https://freeocr.ai/api/v1/ocr", form, {
      headers: { ...form.getHeaders() }
    });
    return { success: true, text: data.text };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// What Music (identify song from audio)
export async function whatMusic(buffer) {
  try {
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("file", buffer, { filename: "audio.mp3", contentType: "audio/mp3" });
    form.append("sample_size", 118784);
    const { data } = await axios.post("https://api.doreso.com/humming", form, {
      headers: { ...form.getHeaders(), "user-agent": "Mozilla/5.0", accept: "application/json", origin: "https://www.aha-music.com", referer: "https://www.aha-music.com/" },
      maxBodyLength: Infinity, maxContentLength: Infinity
    });
    return { success: true, title: data.data?.title, artists: data.data?.artists };
  } catch (e) {
    return { success: false, error: e.message };
  }
}