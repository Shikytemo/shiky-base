import axios from "axios";

export const Jawa = {
  translate: async (text, { from = "indo", to = "krama-alus" } = {}) => {
    if (!text) throw new Error("Text is required.");
    const languageMap = { indo: "id", jawa: "jw", "krama-lugu": "kl", "krama-alus": "ka", ngoko: "ng" };
    const fromCode = languageMap[from];
    const toCode = languageMap[to];
    if (!fromCode) throw new Error(`Invalid 'from' language: ${from}.`);
    if (!toCode) throw new Error(`Invalid 'to' language: ${to}.`);
    if (fromCode === "id" && toCode === "id") throw new Error("Cannot translate from indo to indo.");
    if (fromCode === "jw" && toCode !== "id") throw new Error("When translating from jawa, target must be indo.");
    const { data } = await axios.post("https://api.translatejawa.id/translate",
      { text: text.trim(), from: fromCode, to: toCode },
      { headers: { "content-type": "application/json", referer: "https://translatejawa.id/", "user-agent": "Mozilla/5.0" } }
    );
    return data.result;
  },
  aksara: async (text, { direction = "toJavanese", withSpace = true, withMurda = true } = {}) => {
    if (!text) throw new Error("Text is required.");
    const validDirections = ["toJavanese", "toLatin"];
    if (!validDirections.includes(direction)) throw new Error(`Invalid 'direction': ${direction}.`);
    const { data } = await axios.post("https://aksarajawa.id/api/translate",
      { text: text.trim(), direction, options: { withSpace, withMurda, typeMode: true } },
      { headers: { "content-type": "application/json", referer: "https://aksarajawa.id/", "user-agent": "Mozilla/5.0" } }
    );
    return data.result;
  },
  sunda: async (text) => {
    if (!text) throw new Error("Text is required.");
    const body = new URLSearchParams({ from_lang: "id_ID", to: "su_ID", text, platform: "dp" }).toString();
    const { data } = await axios.post("https://lingvanex.com/translation/translate", body, {
      headers: {
        Host: "lingvanex.com", "User-Agent": "Mozilla/5.0",
        Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://lingvanex.com", Referer: "https://lingvanex.com/translation/indonesia-ke-bahasa-sunda"
      }
    });
    return data.result;
  }
};