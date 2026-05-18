import axios from "axios";
import FormData from "form-data";
import { cfBypass } from "./cfBypass.js";

// ─── Waifu2x Upscaler ───
// Anime-style image upscaling via waifu2x.net
export async function waifu2x(image, { style = "artwork", noise = "medium", upscaling = "1.6x" } = {}) {
  try {
    const conf = {
      style: { artwork: "art", scans: "art_scan", photo: "photo" },
      noise: { none: "-1", low: "0", medium: "1", high: "2", highest: "3" },
      upscaling: { none: "-1", "1.6x": "1", "2x": "2" },
    };

    if (!Buffer.isBuffer(image)) throw new Error("Image must be a buffer.");
    if (!conf.style[style]) throw new Error(`Styles: ${Object.keys(conf.style).join(", ")}`);
    if (!conf.noise[noise]) throw new Error(`Noise: ${Object.keys(conf.noise).join(", ")}`);
    if (!conf.upscaling[upscaling]) throw new Error(`Upscaling: ${Object.keys(conf.upscaling).join(", ")}`);

    const cfToken = await cfBypass("https://www.waifu2x.net/", "0x4AAAAAABqlY7DKXMzoS81U");

    const form = new FormData();
    form.append("turnstile", cfToken);
    form.append("file", image, `${Date.now()}_waifu2x.jpg`);
    form.append("style", conf.style[style]);
    form.append("noise", conf.noise[noise]);
    form.append("scale", conf.upscaling[upscaling]);

    const { data } = await axios.post("https://www.waifu2x.net/api", form, {
      headers: {
        ...form.getHeaders(),
        origin: "https://www.waifu2x.net",
        referer: "https://www.waifu2x.net/",
        "user-agent": "Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 Chrome/130.0.6723.86 Mobile Safari/537.36",
      },
      responseType: "arraybuffer",
    });

    return Buffer.from(data);
  } catch (e) {
    throw new Error(e.message);
  }
}