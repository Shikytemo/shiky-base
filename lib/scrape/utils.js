import axios from "axios";
import { load } from "cheerio";

// ─── Shared Axios Instance ───
// Browser-like headers, timeout, connection pooling
const client = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  },
});

// ─── Retry with exponential backoff ───
export async function fetchHtml(url, opts = {}) {
  const maxRetries = opts.retries ?? 2;
  const headers = { ...client.defaults.headers.common, ...opts.headers };
  let lastErr;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data } = await client.get(url, { ...opts, headers, timeout: opts.timeout ?? 15000 });
      return data;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      // Don't retry 404 or client errors
      if (status >= 400 && status < 500) throw err;
      // Retry on network error, 429, 5xx
      if (i < maxRetries) {
        const delay = 1000 * Math.pow(2, i); // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Fetch + parse with Cheerio ───
export async function fetchPage(url, opts = {}) {
  const html = await fetchHtml(url, opts);
  return load(html);
}

// ─── Extract JSON from <script> tags ───
// Finds __NEXT_DATA__, or any script containing the keyword
export function extractJson($, keyword) {
  // Try __NEXT_DATA__ first
  const nextData = $("#__NEXT_DATA__").text();
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData);
      return parsed.props?.pageProps || parsed;
    } catch {}
  }
  // Search all script tags for keyword
  const scripts = $("script[type='application/json'], script:not([src])");
  for (let i = 0; i < scripts.length; i++) {
    const text = $(scripts[i]).text();
    if (text.includes(keyword)) {
      try { return JSON.parse(text); } catch {}
    }
  }
  return null;
}

// ─── Clean text helper ───
export function cleanText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

// ─── Truncate text ───
export function truncate(str, max = 500) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + "...";
}

export { client, load };
export default { client, fetchHtml, fetchPage, extractJson, cleanText, truncate };
