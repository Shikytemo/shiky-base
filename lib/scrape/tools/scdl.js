import axios from "axios";
import { load } from "cheerio";

export async function scdl(url) {
  try {
    const { data } = await axios.post("https://www.klickaud.co/download.php",
      new URLSearchParams({ value: url }),
      { headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0" } }
    );
    const $ = load(data);
    const onclick = $("#dlMP3").attr("onclick") || "";
    const link = onclick.split("downloadFile('")[1]?.split("',")[0] || "";
    const thumb = $("#header > div > div > div.col-lg-8 > div > table > tbody > tr > td:nth-child(1) > img").attr("src") || "";
    const title = $("#header > div > div > div.col-lg-8 > div > table > tbody > tr > td:nth-child(2)").text();
    return { success: true, title, thumb, download: link };
  } catch (e) {
    return { success: false, error: e.message };
  }
}