# 🤖 Shiky-Base

**Bot WhatsApp serbaguna berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) lewat library [Shileys](https://npmjs.com/shileys) — ringan, cepat, dan penuh fitur RPG.**

---

## ✨ Fitur Unggulan

### 🎮 Sistem RPG & Player
Bot ini bukan sekadar bot biasa — setiap pemain punya **profil, level, XP, uang, dan tier** sendiri. Makin sering pakai command, makin naik levelmu!

| Fitur | Command | Deskripsi |
|-------|---------|-----------|
| Profil | `.profile` | Lihat kartu profil & tier kamu |
| Level | `.level` | Cek level & XP kamu |
| Daily | `.daily` | Klaim hadiah harian (uang + XP) |
| Balance | `.bal` | Cek saldo uang kamu |
| Transfer | `.transfer` | Kirim uang ke pemain lain |
| Limit | `.limit` | Cek sisa limit harian |
| Leaderboard | `.lb` | Top 10 pemain terkaya |
| Tier List | `.tier` | Lihat semua tier yang ada |

### ⚔️ Battle & Hunt System
Lawan monster, berburu harta karun, dan jadi yang terkuat!

| Command | Deskripsi |
|---------|-----------|
| `.battle` | Mulai pertarungan melawan monster random |
| `.attack` | Serang monster dengan serangan normal |
| `.skill` | Gunakan skill spesial (damage besar!) |
| `.defend` | Bertahan untuk mengurangi damage |
| `.flee` | Kabur dari pertarungan |
| `.hunt` | Berburu item, gold, dan XP di alam liar |
| `.heal` | Pulihkan HP pakai potion |
| `.shop` | Lihat daftar item yang bisa dibeli |
| `.buy <item>` | Beli item dari shop |
| `.inv` | Cek inventory kamu |
| `.use <item>` | Pakai item dari inventory |

> **8 tier** bisa kamu capai: dari 🌑 *Novice Wanderer* sampai 🌟 *Celestial Emperor*. 12 monster dengan level berbeda siap menantangmu!

### 📥 Media Downloader
Download video & audio dari berbagai platform langsung lewat chat.

| Command | Platform |
|---------|----------|
| `.tt <url>` | TikTok (video + audio + slide) |
| `.ttsound <url>` | TikTok (audio only) |
| `.ttwm <url>` | TikTok (dengan watermark) |
| `.fb <url>` | Facebook |
| `.ig <url>` | Instagram |
| `.tw <url>` | Twitter / X |

### 🎵 Musik
Cari dan download lagu favoritmu.

| Command | Deskripsi |
|---------|-----------|
| `.yts <judul>` | Cari lagu di YouTube Music |
| `.play <judul>` | Putar & download lagu |
| `.spdl <url>` | Download lagu dari Spotify |

### 🛠️ Tools & Utility

| Command | Deskripsi |
|---------|-----------|
| `.ping` | Cek kecepatan respon bot |
| `.say <teks>` | Bot mengulangi teks kamu |
| `.resend` | Kirim ulang gambar/video (reply) |
| `.tourl` | Upload media ke catbox.moe |
| `.cekidch` / `.idch` | Lihat ID chat/channel saat ini |
| `.cekidgc` / `.idgc` | Lihat ID grup (khusus di grup) |

### 👑 Owner & Admin Panel

| Command | Deskripsi |
|---------|-----------|
| `.setting` | Panel pengaturan bot (interaktif) |
| `.addpremium <nomor>` | Tambah user premium |
| `.delpremium <nomor>` | Hapus user premium |
| `.addadmin <nomor>` | Tambah admin bot |
| `.deladmin <nomor>` | Hapus admin bot |
| `.addmoney <nomor> <jumlah>` | Tambah uang user |
| `.addlimit <nomor> <jumlah>` | Tambah limit user |
| `.addxp <nomor> <jumlah>` | Tambah XP user |
| `.setlevel <nomor> <level>` | Set level user |
| `.set <key>` | Toggle pengaturan bot |

---

## ⚙️ Bot Settings

| Setting | Default | Fungsi |
|---------|---------|--------|
| `autoread` | 🟢 ON | Auto read pesan masuk |
| `autotyping` | 🔴 OFF | Tampilkan indikator mengetik |
| `antispam` | 🟢 ON | Filter spam (cooldown per command) |
| `gamemode` | 🟢 ON | Aktifkan fitur battle & hunt |
| `welcome` | 🔴 OFF | Sambut member baru di grup |
| `selfmode` | 🔴 OFF | Hanya owner yang bisa pakai bot |

---

## 🚀 Cara Install

### Persyaratan
- **Node.js** v18+
- **PM2** (untuk production)
- **Termux** / **VPS Linux**

### Langkah-langkah

```bash
# 1. Clone repo
git clone https://github.com/Shikytemo/shiky-base.git
cd shiky-base

# 2. Install dependencies
npm install

# ⚠️ Khusus Termux/Android: jika gagal install sharp,
#    jalankan ini dulu lalu ulangi npm install:
export GYP_DEFINES="android_ndk_path=''"
npm install

# 3. Edit config.js — isi nomor WhatsApp kamu
nano config.js
```

<details>
<summary>📝 Contoh <code>config.js</code></summary>

```js
const config = {
    phoneNumber: "628123456789",   // nomor WhatsApp bot
    pairingCode: "SHIKYBOT",       // kode pairing (bebas)
    browser: ["Chrome (Linux)", "Linux", "Chrome"]
};
export default config;
```
</details>

```bash
# 4. Jalankan bot
npm start
```

Saat pertama kali jalan, bot akan menghasilkan **pairing code**. Buka WhatsApp di HP kamu, masuk ke **Perangkat Tertaut > Tautkan Perangkat**, lalu masukkan kode yang muncul di terminal.

### Production (PM2)

```bash
# Install PM2
npm install -g pm2

# Jalankan dengan PM2
pm2 start ecosystem.config.cjs

# Simpan agar auto-start saat reboot
pm2 save
pm2 startup
```

---

## 🔥 Fitur Keren Lainnya

| Fitur | Keterangan |
|-------|------------|
| 🔄 **Hot Reload** | Edit `handler.js` langsung, bot auto reload tanpa restart |
| 🧹 **Auto Clear Cache** | Session cache dibersihkan otomatis tiap 30 menit |
| 📵 **Auto Reject Call** | Panggilan suara/video otomatis ditolak |
| 🛡️ **Anti Spam** | Filter cooldown mencegah spam command |
| 🌐 **Any-ASCII** | Command support karakter unicode & simbol |

---

## 📁 Struktur Folder

```
shiky-base/
├── config.js              # Konfigurasi nomor & pairing
├── setting.js             # Nama bot, owner, admin
├── index.js               # Entry point + koneksi WhatsApp
├── handler.js             # Semua command handler
├── ecosystem.config.cjs   # Konfigurasi PM2
├── lib/
│   ├── database.js        # Sistem database player
│   ├── game.js            # Battle, hunt, shop logic
│   ├── botSettings.js     # Pengaturan bot
│   ├── logger.js          # Logger terminal keren
│   ├── spotify.js         # Spotify search & download
│   ├── utils.js           # Utility functions
│   ├── Messages.js        # Message parser
│   └── scrape/            # Scraper TikTok, FB, IG, dll
├── database/              # Data player & settings
└── session/               # Auth session WhatsApp
```

---

## 🧑‍💻 Credits

Dibuat dengan ❤️ oleh [@Shikytemo](https://github.com/Shikytemo)

- Library: [Shileys](https://npmjs.com/shileys) — Baileys wrapper
- RPG System: Custom-built dari nol
- Scraper: TikTok, Snapsave, Catbox

---

## 📜 License

MIT — bebas dipakai, dimodifikasi, dan disebarluaskan.