import axios from "axios";

// ─── Qwen TTS ───
// Text to speech via Qwen HuggingFace
const VOICES = ["Dylan", "Sunny", "Jada", "Cherry", "Ethan", "Serena", "Chelsie"];

export async function qwenTTS(text, voice = "Dylan") {
  try {
    if (!text) throw new Error("Text is required");
    if (!VOICES.includes(voice)) throw new Error(`Available voices: ${VOICES.join(", ")}`);

    const sessionHash = Math.random().toString(36).substring(2);

    await axios.post("https://qwen-qwen-tts-demo.hf.space/gradio_api/queue/join?", {
      data: [text, voice],
      event_data: null,
      fn_index: 2,
      trigger_id: 13,
      session_hash: sessionHash,
    });

    const { data } = await axios.get(
      `https://qwen-qwen-tts-demo.hf.space/gradio_api/queue/data?session_hash=${sessionHash}`
    );

    const lines = data.split("\n\n");
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const d = JSON.parse(line.substring(6));
        if (d.msg === "process_completed") return d.output.data[0].url;
      }
    }
    throw new Error("No audio result found.");
  } catch (e) {
    throw new Error(e.message);
  }
}
