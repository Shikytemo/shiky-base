import axios from "axios";

// ─── Dolphin AI Chat ───
// Free AI chat via dolphin.ai
const TEMPLATES = ["logical", "creative", "summarize", "code-beginner", "code-advanced"];

export async function dolphinAI(question, { template = "logical" } = {}) {
  try {
    if (!question) throw new Error("Question is required.");
    if (!TEMPLATES.includes(template))
      throw new Error(`Available templates: ${TEMPLATES.join(", ")}.`);

    const { data } = await axios.post(
      "https://chat.dphn.ai/api/chat",
      {
        messages: [{ role: "user", content: question }],
        model: "dolphinserver:24B",
        template,
      },
      {
        headers: {
          origin: "https://chat.dphn.ai",
          referer: "https://chat.dphn.ai/",
          "user-agent":
            "Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
        },
      }
    );

    const result = data
      .split("\n\n")
      .filter((line) => line && line.startsWith("data: {"))
      .map((line) => JSON.parse(line.substring(6)))
      .map((line) => line.choices[0].delta.content)
      .join("");

    if (!result) throw new Error("No result found.");
    return result;
  } catch (e) {
    throw new Error(e.message);
  }
}
