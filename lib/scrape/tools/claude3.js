import axios from "axios";
import { cfBypass } from "./cfBypass.js";

// ─── Claude 3 AI Chat ───
// Claude 3 via minitoolai.com
export async function claude3(question) {
  try {
    if (!question) throw new Error("Question is required.");

    const { data: html, headers } = await axios.get("https://minitoolai.com/Claude-3/");
    const cfToken = await cfBypass("https://minitoolai.com/Claude-3/", "0x4AAAAAABjI2cBIeVpBYEFi");

    const utoken = html.match(/var\s+utoken\s*=\s*"([^"]*)"/)?.[1];
    if (!utoken) throw new Error("Failed to get utoken.");

    const { data: task } = await axios.post(
      "https://minitoolai.com/Claude-3/claude3_stream.php",
      new URLSearchParams({
        messagebase64img1: "", messagebase64img0: "",
        select_model: "claude-3-haiku-20240307", temperature: "0.7",
        utoken, message: question, umes1a: "", bres1a: "", umes2a: "", bres2a: "",
        cft: encodeURIComponent(cfToken),
      }).toString(),
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          cookie: headers["set-cookie"].join("; "),
          origin: "https://minitoolai.com", referer: "https://minitoolai.com/Claude-3/",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
          "x-requested-with": "XMLHttpRequest",
        },
      }
    );

    const { data } = await axios.get("https://minitoolai.com/Claude-3/claude3_stream.php", {
      headers: {
        cookie: headers["set-cookie"].join("; "),
        origin: "https://minitoolai.com", referer: "https://minitoolai.com/Claude-3/",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
      },
      params: { streamtoken: task },
    });

    const result = data
      .split("\n")
      .filter((line) => line && line.startsWith("data: {"))
      .map((line) => JSON.parse(line.substring(6)))
      .filter((line) => line.type === "content_block_delta")
      .map((line) => line.delta.text)
      .join("");

    if (!result) throw new Error("No result found.");
    return result;
  } catch (e) {
    throw new Error(e.message);
  }
}