import axios from "axios";
import FormData from "form-data";
import { v4 as uuidv4 } from "uuid";

// ─── Ghibli AI ───
// Convert image to Studio Ghibli art style
export async function ghibliAI(buffer, prompt = "Please convert this image into Studio Ghibli art style with the Ghibli AI generator.") {
  try {
    const form = new FormData();
    form.append("file", buffer, `ghibli_${Date.now()}.jpg`);

    const { data: a } = await axios.post("https://ghibliai.ai/api/upload", form);

    const { data: b } = await axios.post(
      "https://ghibliai.ai/api/transform-stream",
      {
        imageUrl: a.data.url,
        sessionId: uuidv4(),
        prompt,
        timestamp: Date.now().toString(),
      },
      { headers: { "content-type": "application/json" } }
    );

    // Poll for result
    for (let i = 0; i < 60; i++) {
      const { data: c } = await axios.get(
        `https://ghibliai.ai/api/transform-stream?taskId=${b.taskId}`,
        { headers: { "content-type": "application/json" } }
      );
      if (c.status === "success") return c.imageUrl;
      if (c.status === "error") throw new Error("Ghibli transform failed.");
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Timeout waiting for result.");
  } catch (e) {
    throw new Error(e.message);
  }
}
