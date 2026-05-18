import axios from "axios";
import crypto from "crypto";
import { cfBypass } from "./cfBypass.js";

// ─── Edit Img (Nano Banana 3) ───
// AI image editing via image-editor.org
export async function editImg(prompt, imageBuffer) {
  try {
    if (!prompt) throw new Error("Prompt is required.");
    if (!Buffer.isBuffer(imageBuffer)) throw new Error("Image must be a buffer.");

    const inst = axios.create({
      baseURL: "https://image-editor.org/api",
      headers: {
        origin: "https://image-editor.org",
        referer: "https://image-editor.org/editor",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
      },
    });

    const { data: up } = await inst.post("/upload/presigned", {
      filename: `${Date.now()}_ai.jpg`,
      contentType: "image/jpeg",
    });
    if (!up?.data?.uploadUrl) throw new Error("Upload url not found.");

    await axios.put(up.data.uploadUrl, imageBuffer);

    const cfToken = await cfBypass("https://image-editor.org/editor", "0x4AAAAAAB8ClzQTJhVDd_pU");

    const { data: task } = await inst.post("/edit", {
      prompt,
      image_urls: [up.data.fileUrl],
      image_size: "auto",
      turnstileToken: cfToken,
      uploadIds: [up.data.uploadId],
      userUUID: crypto.randomUUID(),
      imageHash: crypto.createHash("sha256").update(imageBuffer).digest("hex").substring(0, 64),
    });
    if (!task?.data?.taskId) throw new Error("Task id not found.");

    // Poll for result
    for (let i = 0; i < 60; i++) {
      const { data } = await inst.get(`/task/${task.data.taskId}`);
      if (data?.data?.status === "completed") return data.data.result;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Timeout waiting for result.");
  } catch (e) {
    throw new Error(e.message);
  }
}
