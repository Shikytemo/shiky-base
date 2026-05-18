import axios from "axios";
import { load } from "cheerio";

// ─── Cookpad Recipe Search ───
// Search recipes on cookpad.com
class CookpadClient {
  async search(query) {
    try {
      if (!query) throw new Error("Query diperlukan");
      const { data } = await axios.get(`https://cookpad.com/id/cari/${encodeURIComponent(query)}`);
      const $ = load(data);
      const recipes = [];

      $('li[id^="recipe_"]').each((i, el) => {
        if (recipes.length >= 5) return;
        const recipeId = $(el).attr("id")?.replace("recipe_", "");
        const title = $(el).find("a.block-link__main").text().trim();
        const imageUrl = $(el).find("picture img[fetchpriority='auto']").attr("src");
        const author = $(el).find(".flex.items-center.mt-auto span.text-cookpad-gray-600").text().trim();
        const prepTime = $(el).find(".mise-icon-time + .mise-icon-text").text().trim() || null;
        const servings = $(el).find(".mise-icon-user + .mise-icon-text").text().trim() || null;
        const ingredients = $(el)
          .find("[data-ingredients-highlighter-target='ingredients']")
          .text()
          .split(",")
          .map((item) => item.replace(/\s+/g, " ").trim())
          .filter((item) => item.length > 0);

        if (title && recipeId) {
          recipes.push({
            id: recipeId,
            title,
            imageUrl,
            author,
            prepTime,
            servings,
            ingredients,
            url: `https://cookpad.com/id/resep/${recipeId}`,
          });
        }
      });

      if (recipes.length === 0) throw new Error(`Resep "${query}" tidak ditemukan`);
      return { success: true, query, recipes };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

const cookpad = new CookpadClient();
export async function cookpadSearch(query) {
  return cookpad.search(query);
}
