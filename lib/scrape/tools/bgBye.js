import axios from "axios";
import FormData from "form-data";
import { fileTypeFromBuffer } from "file-type";

// ─── Remove BG (BgBye) ───
// Remove image/video background
const METHODS = ["bria", "inspyrenet", "u2net", "tracer", "basnet", "deeplab", "u2net_human_seg", "ormbg", "isnet-general-use", "isnet-anime"];
const BG_BYE_URL = "https://bgbye2.fyrean.com";

export async function removeBg(buffer, { method = "bria" } = {}) {
  try {
    if (!buffer || !Buffer.isBuffer(buffer)) throw new Error("Image buffer is required");
    if (!METHODS.includes(method)) throw new Error(`Available methods: ${METHODS.join(", ")}`);

    const { mime } = await fileTypeFromBuffer(buffer);
    if (!/image/.test(mime)) throw new Error("Must be an image buffer");

    const form = new FormData();
    form.append("file", buffer, `${Date.now()}_bgbye.jpg`);
    form.append("method", method);

    const { data } = await axios.post(`${BG_BYE_URL}/remove_background/`, form, {
      headers: form.getHeaders(),
      responseType: "arraybuffer",
    });

    return Buffer.from(data);
  } catch (e) {
    throw new Error(e.message);
  }
}
