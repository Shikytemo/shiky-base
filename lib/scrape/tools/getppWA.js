import axios from "axios";

// ─── Get PP WhatsApp ───
// Get WhatsApp profile picture by phone number
export async function getppWA(no) {
  try {
    if (isNaN(no)) throw new Error("Nomor telepon tidak valid");

    const { data } = await axios.get("https://wa-api.b-cdn.net/wa-dp/", {
      headers: {
        accept: "*/*",
        origin: "https://snaplytics.io",
        referer: "https://snaplytics.io/",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36",
      },
      params: { phone: no },
    });

    return { success: true, result: data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}