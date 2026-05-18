// Nano Banana AI Image Generation - Multiple Fallback Providers
// All scrapers return { success: boolean, buffer?: Buffer, error?: string }

import axios from "axios";

// Helper: download image from URL
async function dl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// 1. nanabana.berrry.app (free, no key)
export async function nano1(prompt, w = 512, h = 512) {
  try {
    const buf = await dl(`https://nanabana.berrry.app/api/nanobanana/image/${w}/${h}?prompt=${encodeURIComponent(prompt)}`);
    return { success: true, buffer: buf };
  } catch (e) { return { success: false, error: e.message }; }
}

// 2. Pollinations.ai (free, no key, general image gen)
export async function nano2(prompt) {
  try {
    const buf = await dl(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`);
    return { success: true, buffer: buf };
  } catch (e) { return { success: false, error: e.message }; }
}

// 3. felo.ai nano-banana (free, no registration)
export async function nano3(prompt) {
  try {
    const res = await axios.post("https://api.felo.ai/v1/nano-banana/generate", {
      prompt, num_images: 1, aspect_ratio: "1:1"
    }, { headers: { "Content-Type": "application/json", "Origin": "https://felo.ai", "Referer": "https://felo.ai/" } });
    if (res.data?.images?.[0]?.url) {
      return { success: true, buffer: await dl(res.data.images[0].url) };
    }
    return { success: false, error: "No image in response" };
  } catch (e) { return { success: false, error: e.message }; }
}

// 4. nanobanana-pro.com (free, no key, 500/day)
export async function nano4(prompt) {
  try {
    const res = await axios.post("https://nanobanana-pro.com/api/generate", {
      prompt, aspect_ratio: "1:1"
    }, { headers: { "Content-Type": "application/json" } });
    if (res.data?.image_url) {
      return { success: true, buffer: await dl(res.data.image_url) };
    }
    return { success: false, error: "No image" };
  } catch (e) { return { success: false, error: e.message }; }
}

// 5. nano-banana.ai (free, email, 100-200/day)
export async function nano5(prompt) {
  try {
    const res = await axios.post("https://nano-banana.ai/api/generate", {
      prompt, ratio: "1:1"
    }, { headers: { "Content-Type": "application/json", "Origin": "https://nano-banana.ai" } });
    if (res.data?.url) {
      return { success: true, buffer: await dl(res.data.url) };
    }
    return { success: false, error: "No image" };
  } catch (e) { return { success: false, error: e.message }; }
}

// 6. Google Gemini direct (free tier, needs key - use env)
export async function nano6(prompt) {
  try {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    if (!key) return { success: false, error: "No GEMINI_API_KEY set" };
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${key}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } },
      { headers: { "Content-Type": "application/json" } }
    );
    const parts = res.data?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p.inlineData?.data) return { success: true, buffer: Buffer.from(p.inlineData.data, "base64") };
    }
    return { success: false, error: "No image in Gemini response" };
  } catch (e) { return { success: false, error: e.message }; }
}

// 7. Leonardo.ai (free tier, needs key)
export async function nano7(prompt) {
  try {
    const key = process.env.LEONARDO_API_KEY || "";
    if (!key) return { success: false, error: "No LEONARDO_API_KEY set" };
    const { data } = await axios.post("https://cloud.leonardo.ai/api/rest/v2/generations", {
      model: "gemini-2.5-flash-image",
      parameters: { width: 1024, height: 1024, prompt, quantity: 1, prompt_enhance: "OFF" },
      public: false
    }, { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });
    const genId = data?.sdGenerationJob?.generationId;
    if (!genId) return { success: false, error: "No generation ID" };
    // Poll for result
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { data: status } = await axios.get(`https://cloud.leonardo.ai/api/rest/v2/generations/${genId}`, {
        headers: { Authorization: `Bearer ${key}` }
      });
      const img = status?.generations_by_pk?.generated_images?.[0];
      if (img?.url) return { success: true, buffer: await dl(img.url) };
      if (img?.status === "FAILED") return { success: false, error: "Generation failed" };
    }
    return { success: false, error: "Timeout waiting for image" };
  } catch (e) { return { success: false, error: e.message }; }
}

// 8. Fal.ai (free tier, needs key)
export async function nano8(prompt) {
  try {
    const key = process.env.FAL_KEY || "";
    if (!key) return { success: false, error: "No FAL_KEY set" };
    const { data } = await axios.post("https://fal.run/fal-ai/nano-banana", {
      prompt, num_images: 1, aspect_ratio: "1:1", output_format: "png"
    }, { headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" } });
    if (data?.images?.[0]?.url) {
      return { success: true, buffer: await dl(data.images[0].url) };
    }
    return { success: false, error: "No image" };
  } catch (e) { return { success: false, error: e.message }; }
}

// 9. Mountsea.ai (free tier, needs key)
export async function nano9(prompt) {
  try {
    const key = process.env.MOUNTSEA_KEY || "";
    if (!key) return { success: false, error: "No MOUNTSEA_KEY set" };
    const { data } = await axios.post("https://api.mountsea.ai/gemini/image/generate", {
      prompt, action: "generate", model: "nano-banana-fast", aspect_ratio: "1:1", num_images: 1
    }, { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });
    if (data?.images?.[0]?.url) {
      return { success: true, buffer: await dl(data.images[0].url) };
    }
    return { success: false, error: "No image" };
  } catch (e) { return { success: false, error: e.message }; }
}

// 10. Puter.com nano-banana (free, user-pays, browser-only skip)
// Use another free alternative: prodia.com or stablediffusionapi
export async function nano10(prompt) {
  try {
    const buf = await dl(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=flux`);
    return { success: true, buffer: buf };
  } catch (e) { return { success: false, error: e.message }; }
}

// Main fallback function - tries all providers
export async function nanoBananaFallback(prompt, width = 512, height = 512) {
  const providers = [
    { name: "berry", fn: () => nano1(prompt, width, height) },
    { name: "pollinations", fn: () => nano2(prompt) },
    { name: "felo", fn: () => nano3(prompt) },
    { name: "nanobanana-pro", fn: () => nano4(prompt) },
    { name: "nano-banana.ai", fn: () => nano5(prompt) },
    { name: "gemini", fn: () => nano6(prompt) },
    { name: "leonardo", fn: () => nano7(prompt) },
    { name: "fal", fn: () => nano8(prompt) },
    { name: "mountsea", fn: () => nano9(prompt) },
    { name: "pollinations-flux", fn: () => nano10(prompt) },
  ];

  for (const p of providers) {
    try {
      const r = await p.fn();
      if (r.success) {
        console.log(`[nano] success via ${p.name}`);
        return r;
      }
      console.log(`[nano] ${p.name} failed: ${r.error}`);
    } catch {}
  }
  return { success: false, error: "All 10 providers failed" };
}

export { nanoBananaFallback as nanoBanana };