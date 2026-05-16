import axios from "axios";
import spottydl from "spottydl";
import YTMusic from "ytmusic-api";
import { YtdlCore } from "@ybd-project/ytdl-core";

const ytmusic = new YTMusic();
let ytReady = false;

async function initYT() {
  if (ytReady) return;
  await ytmusic.initialize();
  ytReady = true;
}

// ═══════════════════════════════════════════════════
//  SEARCH - via YouTube Music (free, no auth)
// ═══════════════════════════════════════════════════
async function search(query, type = "track", limit = 5) {
  try {
    await initYT();
    const results = await ytmusic.searchSongs(query);
    if (!results || !results.length) return [];

    return results.slice(0, limit).map(t => ({
      name: t.name,
      artist: t.artist?.name || "-",
      album: t.album?.name || "-",
      url: "https://music.youtube.com/watch?v=" + t.videoId,
      uri: t.videoId,
      duration: msToTime(t.duration * 1000 || 0),
      image: t.thumbnails?.[0]?.url || "",
      popularity: 0,
    }));
  } catch (e) {
    console.log("Search error:", e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════
//  PLAY - auto download & send from YouTube
// ═══════════════════════════════════════════════════
async function playSong(query) {
  try {
    await initYT();
    const results = await ytmusic.searchSongs(query);
    if (!results || !results.length) return { error: "Tidak ditemukan" };

    const song = results[0];
    const ytdl = new YtdlCore({ url: song.videoId });
    const info = await ytdl.getFullInfo();
    const format = ytdl.chooseFormat({ filter: "audioonly", quality: "highestaudio" });

    if (!format || !format.url) return { error: "No playable format found" };

    return {
      title: song.name,
      artist: song.artist?.name || "-",
      album: song.album?.name || "-",
      duration: msToTime(song.duration * 1000 || 0),
      cover: song.thumbnails?.[0]?.url || "",
      videoUrl: "https://music.youtube.com/watch?v=" + song.videoId,
      audioUrl: format.url,
      views: info.videoDetails?.viewCount || "0",
    };
  } catch (e) {
    console.log("Play error:", e.message);
    return { error: e.message };
  }
}

// ═══════════════════════════════════════════════════
//  DOWNLOAD - Spotify
// ═══════════════════════════════════════════════════
async function download(url) {
  try {
    const track = await spottydl.getTrack(url);
    const audioUrl = await spottydl.download(url);
    return {
      title: track.title,
      artist: track.artist,
      album: track.album,
      cover: track.cover_url,
      url: audioUrl,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function msToTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSearch(results, query) {
  if (!results.length) return `❌ *Tidak ditemukan!*\n\nCari: "${query}"`;
  let txt = `🎵 *YT MUSIC SEARCH*\n🔍 "${query}"\n\n`;
  results.forEach((t, i) => {
    txt += `*${i + 1}.* ${t.name}\n`;
    txt += `👤 ${t.artist}\n`;
    if (t.album !== "-") txt += `💿 ${t.album}\n`;
    txt += `⏱ ${t.duration}\n`;
    txt += `🔗 ${t.url}\n`;
    if (i < results.length - 1) txt += `\n`;
  });
  return txt;
}

export { search, download, playSong, formatSearch };
export default { search, download, playSong, formatSearch };