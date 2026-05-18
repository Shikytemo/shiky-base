import axios from "axios";

// ─── Perplexed (Deep Search) ───
// AI-powered deep search with sources
export async function perplexed(question) {
  try {
    if (!question) throw new Error("Question is required.");
    const { data } = await axios.post(
      "https://d21l5c617zttgr.cloudfront.net/stream_search",
      { user_prompt: question },
      {
        headers: {
          origin: "https://d21l5c617zttgr.cloudfront.net",
          referer: "https://d21l5c617zttgr.cloudfront.net/",
          "user-agent":
            "Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
        },
      }
    );

    if (!data || typeof data !== "string") throw new Error("No result found.");

    const allSteps = data
      .split("[/PERPLEXED-SEPARATOR]")
      .filter((text) => text.trim() !== "")
      .map((part) => {
        try { return JSON.parse(part); } catch {}
      })
      .filter((item) => item !== null);

    const result = allSteps.length > 0 ? allSteps[allSteps.length - 1] : null;
    if (!result) throw new Error("No result found.");

    return {
      success: true,
      answer: result.answer,
      sources: result.websearch_docs || [],
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
