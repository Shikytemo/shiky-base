// API functions — siputzx endpoints, GET→POST fallback
const BASE = 'https://api.siputzx.my.id'

async function req(url, method, body) {
  const opts = { headers: { 'Content-Type': 'application/json' } }
  if (method === 'POST') { opts.method = 'POST'; opts.body = JSON.stringify(body) }
  const r = await fetch(url, opts)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('image')) return { type: 'image', url }
  if (ct.includes('json')) {
    const j = await r.json()
    if (j.status === false || j.error) throw new Error(j.error || 'API error')
    return { type: 'json', data: j.data || j.result || j }
  }
  return { type: 'text', text: await r.text() }
}

function kv(obj, max) {
  if (!obj || typeof obj !== 'object') return String(obj)
  return Object.entries(obj).filter(([k, v]) => v != null && typeof v !== 'object').slice(0, max || 25).map(([k, v]) => '*' + k + ':* ' + v).join('\n')
}

async function tryBoth(url, inp, params, isImg) {
  const q = new URLSearchParams()
  const p = inp.split(/[,|]/).map(s => s.trim())
  params.forEach((n, i) => { if (p[i]) q.set(n, p[i]) })
  const getUrl = url + '?' + q
  try {
    const r = await req(getUrl, 'GET')
    if (isImg && r.type === 'image') return r
    if (!isImg) return r
  } catch {}
  const body = {}
  params.forEach((n, i) => { if (p[i]) body[n] = p[i] })
  return req(url, 'POST', body)
}

// ═══════════ PRIMBON ═══════════
export const artinama = async inp => {
  const r = await tryBoth(`${BASE}/api/primbon/artinama`, inp, ['nama'])
  return { type: 'text', text: `🔮 *Arti Nama: ${inp}*\n\n${r.data?.arti || kv(r.data)}` }
}
export const tafsirmimpi = async inp => {
  const r = await tryBoth(`${BASE}/api/primbon/tafsirmimpi`, inp, ['mimpi'])
  return { type: 'text', text: `🔮 *Tafsir Mimpi: ${inp}*\n\n${r.data?.arti || r.data?.tafsir || kv(r.data)}` }
}
export const zodiak = async inp => {
  const r = await tryBoth(`${BASE}/api/primbon/zodiak`, inp, ['zodiak'])
  return { type: 'text', text: `🔮 *Zodiak: ${inp}*\n\n${kv(r.data)}` }
}
export const nomorhoki = async inp => {
  const r = await tryBoth(`${BASE}/api/primbon/nomorhoki`, inp, ['phoneNumber'])
  return { type: 'text', text: `🔮 *Nomor Hoki: ${inp}*\n\n${kv(r.data)}` }
}
export const cekpenyakit = async inp => {
  const r = await tryBoth(`${BASE}/api/primbon/cek_potensi_penyakit`, inp, ['tgl', 'bln', 'thn'])
  return { type: 'text', text: `🔮 *Cek Potensi Penyakit*\n\n${kv(r.data)}` }
}
export const cocoknama = async inp => {
  const r = await tryBoth(`${BASE}/api/primbon/kecocokan_nama_pasangan`, inp, ['nama1', 'nama2'])
  return { type: 'text', text: `🔮 *Kecocokan Nama*\n\n${kv(r.data)}` }
}
export const rejekiweton = async inp => {
  const r = await tryBoth(`${BASE}/api/primbon/rejeki_hoki_weton`, inp, ['tgl', 'bln', 'thn'])
  return { type: 'text', text: `🔮 *Rejeki Weton*\n\n${kv(r.data)}` }
}

// ═══════════ AI ═══════════
export const gemini = async inp => {
  const r = await tryBoth(`${BASE}/api/ai/gemini`, inp, ['content'])
  return { type: 'text', text: `🤖 *Gemini AI*\n\n${r.data?.text || r.data?.response || r.data?.result || kv(r.data)}` }
}
export const deepseek = async inp => {
  const r = await tryBoth(`${BASE}/api/ai/deepseekr1`, inp, ['prompt'])
  return { type: 'text', text: `🤖 *DeepSeek R1*\n\n${r.data?.text || r.data?.response || r.data?.result || kv(r.data)}` }
}
export const duckai = async inp => {
  const r = await tryBoth(`${BASE}/api/ai/duckai`, inp, ['message'])
  return { type: 'text', text: `🤖 *DuckAI*\n\n${r.data?.text || r.data?.response || r.data?.result || kv(r.data)}` }
}
export const duckimg = inp => tryBoth(`${BASE}/api/ai/duckaiimage`, inp, ['text'], true)
export const gptoss = async inp => {
  const r = await tryBoth(`${BASE}/api/ai/gptoss120b`, inp, ['prompt'])
  return { type: 'text', text: `🤖 *GPT OSS*\n\n${r.data?.text || r.data?.response || r.data?.result || kv(r.data)}` }
}
export const metaai = async inp => {
  const r = await tryBoth(`${BASE}/api/ai/metaai`, inp, ['query'])
  return { type: 'text', text: `🤖 *Meta AI*\n\n${r.data?.text || r.data?.response || r.data?.result || kv(r.data)}` }
}
export const llama = async inp => {
  const r = await tryBoth(`${BASE}/api/ai/llama`, inp, ['text'])
  return { type: 'text', text: `🤖 *Llama*\n\n${r.data?.text || r.data?.response || kv(r.data)}` }
}

// ═══════════ DOWNLOADER ═══════════
const dlWrap = (fn, label) => async inp => {
  const r = await fn(inp)
  return { type: 'text', text: `⬇️ *${label}*\n\n${kv(r.data)}` }
}
export const ttdl = inp => tryBoth(`${BASE}/api/d/tiktok`, inp, ['url'])
export const igdl = inp => tryBoth(`${BASE}/api/d/igram`, inp, ['url'])
export const ytdl = inp => tryBoth(`${BASE}/api/d/ytpost`, inp, ['url'])
export const fbdl = inp => tryBoth(`${BASE}/api/d/facebook`, inp, ['url'])
export const twdl = inp => tryBoth(`${BASE}/api/d/twitter`, inp, ['url'])
export const spdl = inp => tryBoth(`${BASE}/api/d/spotify`, inp, ['url'])
export const scdl2 = inp => tryBoth(`${BASE}/api/d/soundcloud`, inp, ['url'])
export const pindl = inp => tryBoth(`${BASE}/api/d/pinterest`, inp, ['url'])
export const ccdl = inp => tryBoth(`${BASE}/api/d/capcut`, inp, ['url'])

// ═══════════ GAMES ═══════════
export const tebakgambar = async () => {
  const r = await req(`${BASE}/api/games/tebakgambar`, 'GET')
  const d = r.data
  return {
    type: 'image',
    url: d.img,
    caption: `🎮 *Tebak Gambar #${d.index}*\n\n📝 Clue: ${d.deskripsi}\n\n_Jawab dengan mengetik jawabanmu!_`,
    answer: d.jawaban
  }
}
export const caklontong = async () => {
  const r = await req(`${BASE}/api/games/caklontong`, 'GET')
  const d = r.data
  return {
    type: 'text',
    text: `🎮 *Cak Lontong #${d.index}*\n\n❓ *Soal:* ${d.soal}\n\n💡 _${d.deskripsi}_`,
    answer: d.jawaban
  }
}
export const family100 = async () => {
  const r = await req(`${BASE}/api/games/family100`, 'GET')
  const d = r.data
  const jawaban = Array.isArray(d.jawaban) ? d.jawaban.map((j, i) => `${i + 1}. ${j}`).join('\n') : d.jawaban
  return { type: 'text', text: `🎮 *Family 100*\n\n❓ *Soal:* ${d.soal}`, answer: `📋 *Jawaban:*\n${jawaban}` }
}
export const tebakbendera = async () => {
  const r = await req(`${BASE}/api/games/tebakbendera`, 'GET')
  return { type: 'image', url: r.data.img, caption: `🎮 *Tebak Bendera*\n\nNegara apakah ini? 🇺🇳`, answer: r.data.name }
}
export const tebakkata = async () => {
  const r = await req(`${BASE}/api/games/tebakkata`, 'GET')
  const d = r.data
  return { type: 'text', text: `🎮 *Tebak Kata #${d.index}*\n\n❓ *Clue:* ${d.soal}`, answer: d.jawaban }
}
export const tebaklagu = async () => {
  const r = await req(`${BASE}/api/games/tebaklagu`, 'GET')
  const d = r.data
  return { type: 'audio', url: d.lagu, caption: `🎮 *Tebak Lagu*\n\n🎵 Judul lagu apa ini?`, answer: `${d.judul} - ${d.artis}` }
}
export const susunkata = async () => {
  const r = await req(`${BASE}/api/games/susunkata`, 'GET')
  const d = r.data
  return { type: 'text', text: `🎮 *Susun Kata #${d.index}*\n\n🔤 *Acak:* ${d.soal}\n🏷️ *Tipe:* ${d.tipe}`, answer: d.jawaban }
}
export const asahotak = async () => {
  const r = await req(`${BASE}/api/games/asahotak`, 'GET')
  if (!r.data) throw new Error('Soal tidak tersedia, coba lagi')
  const d = r.data
  return { type: 'text', text: `🎮 *Asah Otak*\n\n❓ *Soal:* ${d.soal || d.pertanyaan}`, answer: d.jawaban }
}

// ═══════════ BERITA ═══════════
export const cnn = async () => {
  const r = await req(`${BASE}/api/berita/cnn`, 'GET')
  const list = Array.isArray(r.data) ? r.data : [r.data]
  let text = `📰 *CNN Indonesia*\n\n`
  list.slice(0, 5).forEach((b, i) => {
    text += `${i + 1}. *${b.title}*\n   ⏰ ${b.time || ''}\n\n`
  })
  return { type: 'text', text: text.trim() }
}
export const cnbc = async () => {
  const r = await req(`${BASE}/api/berita/cnbcindonesia`, 'GET')
  const list = Array.isArray(r.data) ? r.data : [r.data]
  let text = `📰 *CNBC Indonesia*\n\n`
  list.slice(0, 5).forEach((b, i) => text += `${i + 1}. *${b.title}*\n   ⏰ ${b.time || ''}\n\n`)
  return { type: 'text', text: text.trim() }
}
export const antara = async () => {
  const r = await req(`${BASE}/api/berita/antara`, 'GET')
  const list = Array.isArray(r.data) ? r.data : [r.data]
  let text = `📰 *Antara News*\n\n`
  list.slice(0, 5).forEach((b, i) => text += `${i + 1}. *${b.title}*\n   ⏰ ${b.time || ''}\n\n`)
  return { type: 'text', text: text.trim() }
}
export const kompas = async () => {
  const r = await req(`${BASE}/api/berita/kompas`, 'GET')
  const list = Array.isArray(r.data) ? r.data : [r.data]
  let text = `📰 *Kompas*\n\n`
  list.slice(0, 5).forEach((b, i) => text += `${i + 1}. *${b.title}*\n   ⏰ ${b.time || ''}\n\n`)
  return { type: 'text', text: text.trim() }
}
export const liputan6 = async () => {
  const r = await req(`${BASE}/api/berita/liputan6`, 'GET')
  const list = Array.isArray(r.data) ? r.data : [r.data]
  let text = `📰 *Liputan6*\n\n`
  list.slice(0, 5).forEach((b, i) => text += `${i + 1}. *${b.title}*\n   ⏰ ${b.time || ''}\n\n`)
  return { type: 'text', text: text.trim() }
}
export const tribun = async () => {
  const r = await req(`${BASE}/api/berita/tribunnews`, 'GET')
  const list = Array.isArray(r.data) ? r.data : [r.data]
  let text = `📰 *Tribun News*\n\n`
  list.slice(0, 5).forEach((b, i) => text += `${i + 1}. *${b.title}*\n   ⏰ ${b.time || ''}\n\n`)
  return { type: 'text', text: text.trim() }
}

// ═══════════ CANVAS ═══════════
export const brat = inp => tryBoth(`${BASE}/api/m/brat`, inp, ['text'], true)
export const blur = inp => tryBoth(`${BASE}/api/canvas/blur`, inp, ['url'], true)
export const greyscale = inp => tryBoth(`${BASE}/api/canvas/greyscale`, inp, ['url'], true)
export const invert = inp => tryBoth(`${BASE}/api/canvas/invert`, inp, ['url'], true)

// ═══════════ SEARCH ═══════════
export const duck = async inp => {
  const r = await tryBoth(`${BASE}/api/s/duckduckgo`, inp, ['query'])
  return { type: 'text', text: `🔍 *DuckDuckGo: ${inp}*\n\n${kv(r.data)}` }
}
export const brave = async inp => {
  const r = await tryBoth(`${BASE}/api/s/brave`, inp, ['query'])
  return { type: 'text', text: `🔍 *Brave: ${inp}*\n\n${kv(r.data)}` }
}
export const ytsearch2 = async inp => {
  const r = await tryBoth(`${BASE}/api/s/youtube`, inp, ['query'])
  return { type: 'text', text: `🔍 *YouTube: ${inp}*\n\n${kv(r.data)}` }
}
export const ttsearch2 = async inp => {
  const r = await tryBoth(`${BASE}/api/s/tiktok`, inp, ['query'])
  return { type: 'text', text: `🔍 *TikTok: ${inp}*\n\n${kv(r.data)}` }
}
export const igsearch = async inp => {
  const r = await tryBoth(`${BASE}/api/s/instagram`, inp, ['query'])
  return { type: 'text', text: `🔍 *IG: ${inp}*\n\n${kv(r.data)}` }
}
export const ghsearch = async inp => {
  const r = await tryBoth(`${BASE}/api/s/github`, inp, ['query'])
  return { type: 'text', text: `🔍 *GitHub: ${inp}*\n\n${kv(r.data)}` }
}

// ═══════════ STALKER ═══════════
export const igstalk2 = async inp => {
  const r = await tryBoth(`${BASE}/api/stalk/instagram`, inp, ['username'])
  return { type: 'text', text: `👀 *IG Stalk: @${inp}*\n\n${kv(r.data)}` }
}
export const ttstalk = async inp => {
  const r = await tryBoth(`${BASE}/api/stalk/tiktok`, inp, ['username'])
  return { type: 'text', text: `👀 *TT Stalk: @${inp}*\n\n${kv(r.data)}` }
}
export const twstalk = async inp => {
  const r = await tryBoth(`${BASE}/api/stalk/twitter`, inp, ['username'])
  return { type: 'text', text: `👀 *TW Stalk: @${inp}*\n\n${kv(r.data)}` }
}
export const ghstalk2 = async inp => {
  const r = await tryBoth(`${BASE}/api/stalk/github`, inp, ['username'])
  return { type: 'text', text: `👀 *GH Stalk: ${inp}*\n\n${kv(r.data)}` }
}

// ═══════════ INFO ═══════════
export const cuaca2 = async inp => {
  const r = await tryBoth(`${BASE}/api/info/cuaca`, inp, ['q'])
  return { type: 'text', text: `ℹ️ *Cuaca: ${inp}*\n\n${kv(r.data)}` }
}
export const bmkg = async () => {
  const r = await req(`${BASE}/api/info/bmkg`, 'GET')
  return { type: 'text', text: `ℹ️ *Info BMKG*\n\n${kv(r.data)}` }
}
export const jadwaltv = async () => {
  const r = await req(`${BASE}/api/info/jadwaltv`, 'GET')
  if (!r.data) throw new Error('Jadwal tidak tersedia')
  const list = Array.isArray(r.data) ? r.data : [r.data]
  let text = `ℹ️ *Jadwal TV*\n\n`
  list.slice(0, 5).forEach(ch => {
    text += `📺 *${ch.channel}*\n`
    if (ch.jadwal) ch.jadwal.slice(0, 3).forEach(j => text += `  ${j.jam} — ${j.acara}\n`)
    text += '\n'
  })
  return { type: 'text', text: text.trim() }
}

// ═══════════ TOOLS ═══════════
export const ss = inp => tryBoth(`${BASE}/api/tools/ssweb`, inp, ['url'], true)

// ═══════════ RANDOM ═══════════
export const rwaifu = async () => {
  const r = await req(`${BASE}/api/r/waifu`, 'GET')
  return { type: 'text', text: `🎲 *Random Waifu*\n\n${kv(r.data)}` }
}
export const rneko = async () => {
  const r = await req(`${BASE}/api/r/neko`, 'GET')
  return { type: 'text', text: `🎲 *Random Neko*\n\n${kv(r.data)}` }
}
export const rmeme = async () => {
  const r = await req(`${BASE}/api/r/lahelu`, 'GET')
  return { type: 'text', text: `🎲 *Random Meme*\n\n${kv(r.data)}` }
}
export const rjoke = async () => {
  const r = await req(`${BASE}/api/r/quotesanime`, 'GET')
  return { type: 'text', text: `🎲 *Random Joke*\n\n${kv(r.data)}` }
}
export const rquote = async () => {
  const r = await req(`${BASE}/api/r/quotesanime`, 'GET')
  return { type: 'text', text: `🎲 *Random Quote*\n\n${kv(r.data)}` }
}

export { kv }