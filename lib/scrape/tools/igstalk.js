import axios from "axios";
import { load } from "cheerio";

export async function igstalk(username) {
  try {
    const { data } = await axios.get(`https://dumpoir.com/v/${username}`, {
      headers: {
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
      }
    });
    const $ = load(data);
    return {
      success: true,
      profile: $("#user-page > div.user > div.row > div > div.user__img").attr("style")?.replace(/(background-image: url\(\'|\'\);)/gi, "") || "",
      fullname: $("#user-page > div.user > div > div.col-md-4.col-8.my-3 > div > a > h1").text(),
      username: $("#user-page > div.user > div > div.col-md-4.col-8.my-3 > div > h4").text(),
      posts: $("#user-page > div.user > div > div.col-md-4.col-8.my-3 > ul > li:nth-child(1)").text().replace(" Posts", ""),
      followers: $("#user-page > div.user > div > div.col-md-4.col-8.my-3 > ul > li:nth-child(2)").text().replace(" Followers", ""),
      following: $("#user-page > div.user > div > div.col-md-4.col-8.my-3 > ul > li:nth-child(3)").text().replace(" Following", ""),
      bio: $("#user-page > div.user > div > div.col-md-5.my-3 > div").text()
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}