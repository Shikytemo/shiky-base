export async function pinterestDl(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" },
      redirect: "follow"
    });
    const data = await res.text();
    const video = data.match(/"contentUrl":"(https:\/\/v1\.pinimg\.com\/videos\/[^"]+\.mp4)"/);
    const image = data.match(/"imageSpec_736x":\{"url":"(https:\/\/i\.pinimg\.com\/736x\/[^"]+)"/)
      || data.match(/"imageSpec_564x":\{"url":"(https:\/\/i\.pinimg\.com\/564x\/[^"]+)"/);
    const title = data.match(/"name":"([^"]+)"/);
    const author = data.match(/"fullName":"([^"]+)".+?"username":"([^"]+)"/);
    return {
      success: true,
      type: video ? "video" : "image",
      title: title?.[1] || "-",
      author: author?.[1] || "-",
      username: author?.[2] || "-",
      media: video?.[1] || image?.[1] || null
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}