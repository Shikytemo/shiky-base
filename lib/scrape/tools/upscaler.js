// HD Image Upscaler - Visual Paradigm API
import axios from "axios";
import FormData from "form-data";
import { writeFileSync, unlinkSync, createReadStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export async function upscaleImage(buffer) {
  const inputPath = join(tmpdir(), `hd_in_${Date.now()}.jpg`);

  try {
    writeFileSync(inputPath, buffer);

    const form = new FormData();
    form.append("file", createReadStream(inputPath));

    const res = await axios.post(
      "https://ai-services.visual-paradigm.com/api/super-resolution/file",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "user-agent": "Mozilla/5.0 (Linux; Android 10)",
          referer: "https://online.visual-paradigm.com/id/photo-effects-studio/image-upscale-tool/",
        },
        responseType: "arraybuffer",
        timeout: 60000,
      }
    );

    const result = Buffer.from(res.data);
    return { success: true, buffer: result };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { unlinkSync(inputPath); } catch {}
  }
}