import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { cfBypass } from "./cfBypass.js";

// ─── Photo Enhancer ───
// AI photo enhancement via supawork.ai
export async function photoEnhancer(image, { scale = 4 } = {}) {
  try {
    const scales = [1, 4, 8, 16];
    if (!Buffer.isBuffer(image)) throw new Error("Image must be a buffer.");
    if (!scales.includes(scale)) throw new Error(`Available scales: ${scales.join(", ")}`);

    const identity = uuidv4();
    const inst = axios.create({
      baseURL: "https://supawork.ai/supawork/headshot/api",
      headers: {
        authorization: "null",
        origin: "https://supawork.ai/",
        referer: "https://supawork.ai/ai-photo-enhancer",
        "user-agent": "Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 Chrome/130.0.6723.86 Mobile Safari/537.36",
        "x-identity-id": identity,
      },
    });

    const { data: up } = await inst.get("/sys/oss/token", { params: { f_suffix: "png", get_num: 1, unsafe: 1 } });
    const img = up?.data?.[0];
    if (!img) throw new Error("Upload url not found.");
    await axios.put(img.put, image);

    const cfToken = await cfBypass("https://supawork.ai/ai-photo-enhancer", "0x4AAAAAACBjrLhJyEE6mq1c");
    const { data: t } = await inst.get("/sys/challenge/token", { headers: { "x-auth-challenge": cfToken } });
    if (!t?.data?.challenge_token) throw new Error("Failed to get token.");

    const { data: task } = await inst.post("/media/image/generator", {
      aigc_app_code: "image_enhancer", model_code: "supawork-ai",
      image_urls: [img.get], extra_params: { scale: parseInt(scale) },
      currency_type: "silver", identity_id: identity,
    }, { headers: { "x-auth-challenge": t.data.challenge_token } });
    if (!task?.data?.creation_id) throw new Error("Failed to create task.");

    for (let i = 0; i < 60; i++) {
      const { data } = await inst.get("/media/aigc/result/list/v1", { params: { page_no: 1, page_size: 10, identity_id: identity } });
      const list = data?.data?.list?.[0]?.list?.[0];
      if (list?.status === 1) return list.url;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Timeout.");
  } catch (e) {
    throw new Error(e.message);
  }
}