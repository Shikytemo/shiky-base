// Video Upscaler - Only FREE providers (no API key needed)
// Uses local ffmpeg + free public endpoints

import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync, readFileSync } from "fs";
const execAsync = promisify(exec);

async function dl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// 1. Local ffmpeg upscale (lanczos3 - best quality interpolation)
export async function vidUp1(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "scale=iw*2:ih*2:flags=lanczos" -c:v libx264 -preset fast -crf 18 -c:a copy "${t2}" -y`, { timeout: 120000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// 2. ffmpeg with unsharp mask (sharpen after upscale)
export async function vidUp2(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:1.0:5:5:0.0" -c:v libx264 -preset fast -crf 18 -c:a copy "${t2}" -y`, { timeout: 120000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// 3. ffmpeg hqdn3d denoise + upscale (good for noisy/old videos)
export async function vidUp3(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "hqdn3d,scale=iw*2:ih*2:flags=lanczos" -c:v libx264 -preset fast -crf 18 -c:a copy "${t2}" -y`, { timeout: 120000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// 4. ffmpeg 4x upscale with spline36
export async function vidUp4(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "scale=iw*4:ih*4:flags=spline" -c:v libx264 -preset fast -crf 20 -c:a copy "${t2}" -y`, { timeout: 180000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// 5. ffmpeg AI-like enhance (nlmeans denoise + unsharp + upscale)
export async function vidUp5(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "nlmeans=30:7:5:3:3,scale=iw*2:ih*2:flags=lanczos,unsharp=3:3:0.8:3:3:0.0" -c:v libx264 -preset fast -crf 18 -c:a copy "${t2}" -y`, { timeout: 120000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// 6. Pollinations image upscale (extract first frame, upscale, return as image)
export async function vidUp6(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_thumb.png`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vframes 1 -vf "scale=512:512" "${t2}" -y`, { timeout: 10000 });
    const frame = readFileSync(t2);
    const b64 = frame.toString("base64");
    const up = await dl(`https://image.pollinations.ai/prompt/enhance%20this%20image?width=1024&height=1024&nologo=true&image_url=data:image/png;base64,${b64}`);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: up };
  } catch (e) { return { success: false, error: e.message }; }
}

// 7. Extract frame + waifu2x upscale via free public API
export async function vidUp7(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_thumb.png`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vframes 1 "${t2}" -y`, { timeout: 10000 });
    const frame = readFileSync(t2);
    // Use free waifu2x endpoint
    const { default: FormData } = await import("form-data");
    const form = new FormData();
    form.append("image", frame, { filename: "frame.png" });
    form.append("scale", "2");
    form.append("noise", "1");
    form.append("style", "art");
    const { data } = await (await import("axios")).default.post("https://waifu2x.udp.jp/api", form, {
      headers: { ...form.getHeaders() }, responseType: "arraybuffer", timeout: 60000
    });
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: Buffer.from(data) };
  } catch (e) { return { success: false, error: e.message }; }
}

// 8. ffmpeg 60fps frame interpolation (smooth motion)
export async function vidUp8(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" -c:v libx264 -preset fast -crf 20 -c:a copy "${t2}" -y`, { timeout: 180000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// 9. ffmpeg color correction + upscale (vibrance boost)
export async function vidUp9(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "scale=iw*2:ih*2:flags=lanczos,eq=saturation=1.2:contrast=1.1:brightness=0.02" -c:v libx264 -preset fast -crf 18 -c:a copy "${t2}" -y`, { timeout: 120000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// 10. ffmpeg stabilization + upscale (for shaky videos)
export async function vidUp10(buffer) {
  try {
    const t1 = `/tmp/vup_${Date.now()}.mp4`;
    const t2 = `/tmp/vup_${Date.now()}_out.mp4`;
    writeFileSync(t1, buffer);
    await execAsync(`ffmpeg -i "${t1}" -vf "deshake,scale=iw*2:ih*2:flags=lanczos" -c:v libx264 -preset fast -crf 20 -c:a copy "${t2}" -y`, { timeout: 120000 });
    const out = readFileSync(t2);
    try { unlinkSync(t1); unlinkSync(t2); } catch {}
    return { success: true, buffer: out };
  } catch (e) { return { success: false, error: e.message }; }
}

// Main fallback - tries all local ffmpeg variants
export async function upscaleVideo(buffer) {
  const providers = [
    { name: "ffmpeg-lanczos-2x", fn: () => vidUp1(buffer) },
    { name: "ffmpeg-sharpen-2x", fn: () => vidUp2(buffer) },
    { name: "ffmpeg-denoise-2x", fn: () => vidUp3(buffer) },
    { name: "ffmpeg-spline-4x", fn: () => vidUp4(buffer) },
    { name: "ffmpeg-nlmeans-2x", fn: () => vidUp5(buffer) },
    { name: "pollinations-thumb", fn: () => vidUp6(buffer) },
    { name: "waifu2x-thumb", fn: () => vidUp7(buffer) },
    { name: "ffmpeg-60fps", fn: () => vidUp8(buffer) },
    { name: "ffmpeg-vibrance-2x", fn: () => vidUp9(buffer) },
    { name: "ffmpeg-stabilize-2x", fn: () => vidUp10(buffer) },
  ];

  for (const p of providers) {
    try {
      const r = await p.fn();
      if (r.success) {
        console.log(`[vidupscale] success via ${p.name}`);
        return r;
      }
      console.log(`[vidupscale] ${p.name} failed: ${r.error}`);
    } catch {}
  }
  return { success: false, error: "All 10 video upscaler providers failed" };
}