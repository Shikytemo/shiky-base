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

function fmt(data) {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.slice(0, 10).map((x, i) => typeof x === 'object' ? Object.entries(x).slice(0, 3).map(([k, v]) => k + ': ' + v).join(', ') : (i + 1) + '. ' + x).join('\n')
  if (typeof data === 'object' && data !== null) return Object.entries(data).filter(([k, v]) => v != null && typeof v !== 'object').slice(0, 25).map(([k, v]) => '*' + k + ':* ' + v).join('\n')
  return String(data)
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
  // Fallback POST
  const body = {}
  params.forEach((n, i) => { if (p[i]) body[n] = p[i] })
  return req(url, 'POST', body)
}

// ─── PRIMBON ───
export const artinama = (inp) => tryBoth(`${BASE}/api/primbon/artinama`, inp, ['nama'])
export const tafsirmimpi = (inp) => tryBoth(`${BASE}/api/primbon/tafsirmimpi`, inp, ['mimpi'])
export const zodiak = (inp) => tryBoth(`${BASE}/api/primbon/zodiak`, inp, ['zodiak'])
export const nomorhoki = (inp) => tryBoth(`${BASE}/api/primbon/nomorhoki`, inp, ['phoneNumber'])
export const cekpenyakit = (inp) => tryBoth(`${BASE}/api/primbon/cek_potensi_penyakit`, inp, ['tgl', 'bln', 'thn'])
export const cocoknama = (inp) => tryBoth(`${BASE}/api/primbon/kecocokan_nama_pasangan`, inp, ['nama1', 'nama2'])
export const rejekiweton = (inp) => tryBoth(`${BASE}/api/primbon/rejeki_hoki_weton`, inp, ['tgl', 'bln', 'thn'])

// ─── AI ───
export const gemini = (inp) => tryBoth(`${BASE}/api/ai/gemini`, inp, ['text'])
export const deepseek = (inp) => tryBoth(`${BASE}/api/ai/deepseekr1`, inp, ['text'])
export const duckai = (inp) => tryBoth(`${BASE}/api/ai/duckai`, inp, ['text'])
export const duckimg = (inp) => tryBoth(`${BASE}/api/ai/duckaiimage`, inp, ['text'], true)
export const gptoss = (inp) => tryBoth(`${BASE}/api/ai/gptoss120b`, inp, ['text'])
export const metaai = (inp) => tryBoth(`${BASE}/api/ai/metaai`, inp, ['text'])
export const llama = (inp) => tryBoth(`${BASE}/api/ai/llama`, inp, ['text'])

// ─── DOWNLOADER ───
export const ttdl = (inp) => tryBoth(`${BASE}/api/downloader/tiktok`, inp, ['url'])
export const igdl = (inp) => tryBoth(`${BASE}/api/downloader/instagram`, inp, ['url'])
export const ytdl = (inp) => tryBoth(`${BASE}/api/downloader/youtube`, inp, ['url'])
export const fbdl = (inp) => tryBoth(`${BASE}/api/downloader/facebook`, inp, ['url'])
export const twdl = (inp) => tryBoth(`${BASE}/api/downloader/twitter`, inp, ['url'])
export const spdl = (inp) => tryBoth(`${BASE}/api/downloader/spotify`, inp, ['url'])
export const scdl2 = (inp) => tryBoth(`${BASE}/api/downloader/soundcloud`, inp, ['url'])
export const pindl = (inp) => tryBoth(`${BASE}/api/downloader/pinterest`, inp, ['url'])
export const ccdl = (inp) => tryBoth(`${BASE}/api/downloader/capcut`, inp, ['url'])

// ─── GAMES ───
export const tebakgambar = () => req(`${BASE}/api/games/tebakgambar`, 'GET')
export const caklontong = () => req(`${BASE}/api/games/caklontong`, 'GET')
export const family100 = () => req(`${BASE}/api/games/family100`, 'GET')
export const tebakbendera = () => req(`${BASE}/api/games/tebakbendera`, 'GET')
export const tebakkata = () => req(`${BASE}/api/games/tebakkata`, 'GET')
export const tebaklagu = () => req(`${BASE}/api/games/tebaklagu`, 'GET')
export const susunkata = () => req(`${BASE}/api/games/susunkata`, 'GET')
export const cermat = () => req(`${BASE}/api/games/cerdascermat`, 'GET')

// ─── BERITA ───
export const cnn = () => req(`${BASE}/api/berita/cnn`, 'GET')
export const cnbc = () => req(`${BASE}/api/berita/cnbc`, 'GET')
export const antara = () => req(`${BASE}/api/berita/antara`, 'GET')
export const kompas = () => req(`${BASE}/api/berita/kompas`, 'GET')
export const detik = () => req(`${BASE}/api/berita/detik`, 'GET')
export const tribun = () => req(`${BASE}/api/berita/tribun`, 'GET')

// ─── CANVAS ───
export const brat = (inp) => tryBoth(`${BASE}/api/canvas/brat`, inp, ['text'], true)
export const blur = (inp) => tryBoth(`${BASE}/api/canvas/blur`, inp, ['url'], true)
export const greyscale = (inp) => tryBoth(`${BASE}/api/canvas/greyscale`, inp, ['url'], true)
export const invert = (inp) => tryBoth(`${BASE}/api/canvas/invert`, inp, ['url'], true)
export const sepia = (inp) => tryBoth(`${BASE}/api/canvas/sepia`, inp, ['url'], true)
export const pixelate = (inp) => tryBoth(`${BASE}/api/canvas/pixelate`, inp, ['url'], true)

// ─── SEARCH ───
export const duck = (inp) => tryBoth(`${BASE}/api/search/duckduckgo`, inp, ['query'])
export const brave = (inp) => tryBoth(`${BASE}/api/search/brave`, inp, ['query'])
export const ytsearch2 = (inp) => tryBoth(`${BASE}/api/search/youtube`, inp, ['query'])
export const ttsearch2 = (inp) => tryBoth(`${BASE}/api/search/tiktok`, inp, ['query'])
export const igsearch = (inp) => tryBoth(`${BASE}/api/search/instagram`, inp, ['query'])
export const ghsearch = (inp) => tryBoth(`${BASE}/api/search/github`, inp, ['query'])

// ─── STALKER ───
export const igstalk2 = (inp) => tryBoth(`${BASE}/api/stalker/instagram`, inp, ['username'])
export const ttstalk = (inp) => tryBoth(`${BASE}/api/stalker/tiktok`, inp, ['username'])
export const twstalk = (inp) => tryBoth(`${BASE}/api/stalker/twitter`, inp, ['username'])
export const ghstalk2 = (inp) => tryBoth(`${BASE}/api/stalker/github`, inp, ['username'])

// ─── INFO ───
export const cuaca2 = (inp) => tryBoth(`${BASE}/api/info/cuaca`, inp, ['kota'])
export const bmkg = () => req(`${BASE}/api/info/bmkg`, 'GET')
export const jadwaltv = () => req(`${BASE}/api/info/jadwaltv`, 'GET')

// ─── TOOLS ───
export const ss = (inp) => tryBoth(`${BASE}/api/tools/ss`, inp, ['url'], true)
export const rmbg = (inp) => tryBoth(`${BASE}/api/tools/removebg`, inp, ['url'], true)

// ─── RANDOM ───
export const rwaifu = () => req(`${BASE}/api/random/waifu`, 'GET')
export const rneko = () => req(`${BASE}/api/random/neko`, 'GET')
export const rmeme = () => req(`${BASE}/api/random/meme`, 'GET')
export const rjoke = () => req(`${BASE}/api/random/joke`, 'GET')
export const rquote = () => req(`${BASE}/api/random/quote`, 'GET')

export { fmt }