import { fetchPage, cleanText, truncate } from "../utils.js";

// ─── Dictionary Scraper ───
// Scrape merriam-webster.com for word definitions
export async function define(word) {
  try {
    const $ = await fetchPage(`https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`);

    // Get pronunciation
    const pronunciation = cleanText($(".word-header .prons-entries-list .pr").first().text()) ||
      cleanText($("[data-pron]").first().text());

    // Get definitions
    const defs = [];
    $(".word-sense-list .word-sense, .dtText, .sense-block .sb-0").each((i, el) => {
      if (defs.length >= 5) return;
      const text = cleanText($(el).text());
      if (text.length > 5) defs.push(text.replace(/^:\s*/, ""));
    });

    // Fallback: try another selector structure
    if (defs.length === 0) {
      $(".vg-sseq-entry-item .sb-0 .dt, .def-text").each((i, el) => {
        if (defs.length >= 5) return;
        const text = cleanText($(el).text());
        if (text.length > 5) defs.push(text.replace(/^:\s*/, ""));
      });
    }

    // Get part of speech
    const pos = [];
    $(".word-header .important-blue-link, .vg-sseq-entry-item .fl").each((i, el) => {
      const t = cleanText($(el).text());
      if (t && !pos.includes(t)) pos.push(t);
    });

    // Get synonyms
    const synonyms = [];
    $("[class*='synonyms'] a, .mw-list a").each((i, el) => {
      if (synonyms.length >= 8) return;
      const t = cleanText($(el).text());
      if (t && t.length > 1 && !synonyms.includes(t)) synonyms.push(t);
    });

    if (defs.length === 0) {
      return { success: false, error: `Kata "${word}" tidak ditemukan di dictionary.` };
    }

    return {
      success: true,
      word,
      pronunciation: pronunciation || null,
      partOfSpeech: pos.length ? pos.join(", ") : null,
      definitions: defs,
      synonyms: synonyms.length ? synonyms : null,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
