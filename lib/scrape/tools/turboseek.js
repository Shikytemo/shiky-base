import axios from "axios";

// ─── Turboseek (Deep Search) ───
// AI-powered search with sources and similar questions
export async function turboseek(question) {
  try {
    if (!question) throw new Error("Question is required.");

    const inst = axios.create({
      baseURL: "https://www.turboseek.io/api",
      headers: {
        origin: "https://www.turboseek.io",
        referer: "https://www.turboseek.io/",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
      },
    });

    const { data: sources } = await inst.post("/getSources", { question });
    const { data: answer } = await inst.post("/getAnswer", { question, sources });

    const cleanAnswer =
      answer
        .match(/<p>(.*?)<\/p>/gs)
        ?.map((m) =>
          m
            .replace(/<\/?p>/g, "")
            .replace(/<\/?strong>/g, "")
            .replace(/<\/?em>/g, "")
            .replace(/<\/?[^>]+(>|$)/g, "")
            .trim()
        )
        .join("\n\n") || answer.replace(/<\/?[^>]+(>|$)/g, "").trim();

    return {
      success: true,
      answer: cleanAnswer,
      sources: sources.map((s) => s.url),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
