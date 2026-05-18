import axios from "axios";

export async function jooxSearch(query) {
  try {
    const time = Math.floor(Date.now() / 1000);
    const { data } = await axios.get(
      `http://api.joox.com/web-fcgi-bin//web_search?lang=id&country=id&type=0&search_input=${query}&pn=1&sin=0&ein=29&_=${time}`
    );
    const ids = data.itemlist.map(r => r.songid);
    const results = await Promise.all(ids.map(id =>
      axios.get(`http://api.joox.com/web-fcgi-bin/web_get_songinfo?songid=${id}&lang=id&country=id&from_type=null&channel_id=null&_=`, {
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" }
      }).then(r => {
        const j = JSON.parse(r.data.replace("MusicInfoCallback(", "").replace("\n)", ""));
        return { title: j.msong, id: j.encodeSongId, album: j.malbum, artist: j.msinger, img: j.imgSrc, mp3: j.mp3Url };
      })
    ));
    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function jooxDl(url) {
  try {
    const { data } = await axios.get(
      `http://api.joox.com/web-fcgi-bin/web_get_songinfo?songid=${url}&lang=id&country=id&from_type=null&channel_id=null&_=${Date.now()}`,
      { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" } }
    );
    const j = JSON.parse(data.replace("MusicInfoCallback(", "").replace("\n)", ""));
    return {
      success: true,
      title: j.msong, artist: j.msinger, album: j.malbum,
      img: j.imgSrc, mp3: j.mp3Url, duration: j.minterval
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}