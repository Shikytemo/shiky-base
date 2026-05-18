import axios from "axios";
import { cfBypass } from "../tools/cfBypass.js";

// ─── Terabox Downloader ───
// Download files from Terabox
export async function teraboxDL(url) {
  try {
    if (!url.includes("/s/") && !url.includes("surl"))
      throw new Error("URL Terabox tidak valid.");

    const cfToken = await cfBypass("https://teraboxdl.site/", "0x4AAAAAACG0B7jzIiua8JFj");

    const { data } = await axios.post(
      "https://teraboxdl.site/api/proxy",
      { url, cf_token: cfToken },
      {
        headers: {
          origin: "https://teraboxdl.site",
          referer: "https://teraboxdl.site/",
          "user-agent":
            "Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
        },
      }
    );

    return { success: true, ...data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
