import axios from "axios";
import { load } from "cheerio";

const normalize = v => v.toLowerCase().replace(/[^a-z0-9\s-_]/gi, "").replace(/\s+/g, "_").replace(/_+/g, "_").trim();

export async function mlbbHero(hero) {
  try {
    const heroSlug = hero.replace(/\s+/g, "_");
    const url = `https://liquipedia.net/mobilelegends/${heroSlug}`;
    const { data: html } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const $ = load(html);
    const image = $('meta[name="twitter:image:src"]').attr("content") || null;
    const information = {};

    const parseSection = (title, target) => {
      const header = $("div.infobox-header-2").filter((_, el) => $(el).text().trim() === title);
      let current = header.parent().next();
      while (current.length) {
        const label = current.find(".infobox-description").first().text().trim();
        if (!label) break;
        target[normalize(label.replace(":", ""))] = current.find("div").last().text().replace(/\s+/g, " ").trim();
        current = current.next();
      }
    };

    parseSection("General Information", information);

    // Skills
    const skills = {};
    const passiveCard = $("#Passive").closest("h3").nextAll(".spellcard-wrapper").first();
    if (passiveCard.length) {
      skills.passive = {
        name: passiveCard.find(".wiki-backgroundcolor-light b").first().text().trim(),
        description: passiveCard.find(".spellcard-description").text().replace(/\s+/g, " ").trim()
      };
    }

    const parseSkill = (id) => {
      const card = $(`#${id}`).closest("h3").nextAll(".spellcard-wrapper").first();
      if (!card.length) return null;
      return {
        name: card.find(".wiki-backgroundcolor-light b").first().text().trim(),
        description: card.find(".spellcard-description").text().replace(/\s+/g, " ").trim()
      };
    };
    skills.skill1 = parseSkill("Skill_1") || parseSkill("Skill_2");
    skills.ultimate = parseSkill("Ultimate");

    return { success: true, hero, image, information, skills };
  } catch (e) {
    return { success: false, error: e.message };
  }
}