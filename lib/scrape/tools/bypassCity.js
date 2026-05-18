import axios from "axios";
import { cfBypass } from "./cfBypass.js";

// ─── Bypass City (Link Bypass) ───
// Bypass link shorteners (linkvertise, etc.)
export async function bypassCity(url) {
  try {
    if (!url) throw new Error("URL diperlukan.");

    const cfToken = await cfBypass(
      `https://bypass.city/bypass?bypass=${encodeURIComponent(url)}`,
      "0x4AAAAAAAGzw6rXeQWJ_y2P"
    );

    const { data } = await axios.post("https://api2.bypass.city/bypass", { url }, {
      headers: {
        accept: "*/*",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8",
        "content-type": "application/json",
        origin: "https://bypass.city",
        referer: "https://bypass.city/",
        "sec-ch-ua": '"Chromium";v="137", "Not(A)Brand";v="24"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        token: cfToken,
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        "x-captcha-provider": "TURNSTILE",
      },
    });

    return { success: true, result: data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
