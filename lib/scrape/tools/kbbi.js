import axios from "axios";
import { load } from "cheerio";
import FormData from "form-data";

// ─── KBBI (Kamus Besar Bahasa Indonesia) ───
// Search Indonesian dictionary via kbbi.kemdikbud.go.id
class KBBIClient {
  async login() {
    const ryn = await axios.get("https://kbbi.kemdikbud.go.id/Account/Login");
    const $ = load(ryn.data);
    const form = new FormData();
    form.append("__RequestVerificationToken", $('input[name="__RequestVerificationToken"]').attr("value"));
    form.append("Posel", "rynn.stuff@neko2.net");
    form.append("KataSandi", "RynnStuff20");
    form.append("IngatSaya", "true");

    const rynn = await axios.post("https://kbbi.kemdikbud.go.id/Account/Login", form, {
      headers: { cookie: ryn.headers["set-cookie"].join("; "), ...form.getHeaders() },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    return rynn.headers["set-cookie"].join("; ");
  }

  async search(word) {
    try {
      if (!word) throw new Error("Kata diperlukan");
      const cookies = await this.login();
      const { data } = await axios.get(`https://kbbi.kemdikbud.go.id/entri/${word}`, {
        headers: { cookie: cookies },
      });
      const $ = load(data);
      const results = [];

      $('h2[style*="margin-bottom:3px"]').each((index, element) => {
        const $h2 = $(element);
        const $cloned = $h2.clone();
        const $nonStd = $cloned.find("small:contains('bentuk tidak baku:')");
        let kataTidakBaku = null;
        if ($nonStd.length > 0) {
          kataTidakBaku = $nonStd.find("b").text().trim();
          $nonStd.remove();
        }
        const wordKey = $cloned.text().trim().replace(/(\d+)/g, "^$1");
        const entry = { makna: [], kata_tidak_baku: kataTidakBaku };

        const meaningList = $h2.nextAll("ul.adjusted-par, ol.last-list-child").first();
        if (meaningList.length > 0) {
          meaningList.find("li").each((i, li) => {
            const $li = $(li);
            if ($li.find("a.entrisButton span[title='Usulkan makna baru']").length > 0) return;
            const kelas_kata = $li.find("span[title]").attr("title");
            const $clonedLi = $li.clone();
            $clonedLi.find("font[color='red'] > i > span[title]").closest("font").remove();
            $clonedLi.find("span.entrisButton").remove();
            const deskripsi = load($clonedLi.html() || "").text().trim().replace(/\s+/g, " ");
            if (kelas_kata && deskripsi) {
              entry.makna.push({ kelas_kata, deskripsi });
            }
          });
        }

        results.push({ kata: wordKey, ...entry });
      });

      if (results.length === 0) throw new Error(`Kata "${word}" tidak ditemukan di KBBI`);
      return { success: true, kata: word, entri: results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

const kbbi = new KBBIClient();
export async function kbbiSearch(word) {
  return kbbi.search(word);
}
