# Simple WA Bot - Advanced Version

Whatsapp bot base menggunakan library Baileys (`shileys`). Bot ini telah di-upgrade dengan berbagai fitur canggih dan stabilitas tinggi.

## 🚀 Fitur Baru & Upgraded
- **Monolithic Handler**: Perintah bot terpusat di `handler.js` untuk stabilitas maksimal di Termux.
- **Auto Update**: Bot dapat mengupdate dirinya sendiri dari repository GitHub.
- **Interactive Menu**: Menu bantuan interaktif menggunakan button dan list.
- **Advanced Battle System**: Fitur RPG battle dengan UI interaktif.
- **60+ Tools & Scrapers**: Berbagai tools downloader, AI (Gemini, Claude), searching, dan banyak lagi.
- **Tier & Leveling**: Sistem XP dan Tier dengan badge unik untuk setiap level.
- **Performance Caching**: Metadata grup dan blocklist di-cache untuk respon yang lebih cepat.

## 🛠️ Installation

1. Clone repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Konfigurasi `config.js` dan `setting.js`
4. Jalankan bot:
   ```bash
   npm start
   ```

## 📂 Struktur Project
- `lib/`: Kumpulan library, scrapers, dan utility.
- `database/`: Penyimpanan data user dan settings (JSON).
- `handler.js`: Message handler utama tempat semua fitur berada.
- `index.js`: Entry point dan koneksi WhatsApp.

---
© 2026 Shikytemo
