import axios from "axios";
import FormData from "form-data";

// ─── Audio Transcription ───
// Transcribe audio to text
export async function transcribe(buffer) {
  try {
    if (!buffer || !Buffer.isBuffer(buffer)) throw new Error("Audio buffer is required");

    const form = new FormData();
    form.append("file", buffer, `${Date.now()}_audio.mp3`);

    const { data } = await axios.post(
      "https://audio-transcription-api.752web.workers.dev/api/transcribe",
      form,
      { headers: form.getHeaders() }
    );

    return { success: true, text: data.transcription };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
