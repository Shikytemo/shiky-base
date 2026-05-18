import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const tmpDir = "./database"; // use database dir for temp files

/**
 * Convert buffer to WebP sticker using FFmpeg
 * @param {Buffer} buffer 
 * @param {String} type - 'image' or 'video'
 * @returns {Promise<Buffer>}
 */
export async function createSticker(buffer, type = "image") {
  const input = path.join(tmpDir, `st_in_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const output = input + ".webp";
  
  await fs.promises.writeFile(input, buffer);

  return new Promise((resolve, reject) => {
    const args = type === "image" 
      ? ["-i", input, "-vf", "scale='if(gt(iw,ih),512,-1)':'if(gt(iw,ih),-1,512)',pad=512:512:(512-iw)/2:(512-ih)/2:color=white@0,format=rgba,subtitles=f=null", "-vcodec", "libwebp", "-lossless", "1", "-f", "webp", "-y", output]
      : ["-i", input, "-vf", "scale='if(gt(iw,ih),512,-1)':'if(gt(iw,ih),-1,512)',pad=512:512:(512-iw)/2:(512-ih)/2:color=white@0,format=rgba", "-vcodec", "libwebp", "-lossless", "0", "-compression_level", "6", "-q:v", "50", "-loop", "0", "-preset", "picture", "-an", "-vsync", "0", "-s", "512:512", "-f", "webp", "-y", output];

    // Simpler image args if above fails
    const finalArgs = type === "image"
      ? ["-i", input, "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=white@0", "-vcodec", "libwebp", "-f", "webp", "-y", output]
      : args;

    const ff = spawn("ffmpeg", finalArgs);

    ff.on("close", async (code) => {
      try {
        if (code === 0 && fs.existsSync(output)) {
          const res = await fs.promises.readFile(output);
          resolve(res);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      } catch (err) {
        reject(err);
      } finally {
        if (fs.existsSync(input)) fs.unlinkSync(input);
        if (fs.existsSync(output)) fs.unlinkSync(output);
      }
    });

    ff.on("error", (err) => {
      if (fs.existsSync(input)) fs.unlinkSync(input);
      reject(err);
    });
  });
}
