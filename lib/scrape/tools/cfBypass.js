import axios from "axios";

// ─── Nekolabs CF Turnstile Bypass ───
// Bypass Cloudflare Turnstile using nekolabs API
export async function cfBypass(url, siteKey) {
  const { data } = await axios.post("https://api.nekolabs.web.id/tools/bypass/cf-turnstile", {
    url,
    siteKey,
  });
  if (!data?.result) throw new Error("Failed to get CF token.");
  return data.result;
}
