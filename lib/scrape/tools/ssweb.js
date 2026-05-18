import axios from "axios";

// ─── Website Screenshot ───
// Take screenshot of a website
export async function ssweb(url, { width = 1280, height = 720, fullPage = false } = {}) {
  try {
    if (!url.startsWith("https://") && !url.startsWith("http://"))
      throw new Error("URL tidak valid");
    if (!url.startsWith("https://")) url = "https://" + url.replace(/^http:\/\//, "");

    const { data } = await axios.post(
      "https://gcp.imagy.app/screenshot/createscreenshot",
      {
        url,
        browserWidth: parseInt(width),
        browserHeight: parseInt(height),
        fullPage,
        deviceScaleFactor: 1,
        format: "png",
      },
      {
        headers: {
          "content-type": "application/json",
          referer: "https://imagy.app/full-page-screenshot-taker/",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        },
      }
    );

    return data.fileUrl;
  } catch (e) {
    throw new Error(e.message);
  }
}
