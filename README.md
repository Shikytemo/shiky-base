# Simple WA Bot - Advanced Version

Whatsapp bot base menggunakan library Baileys (`shileys`). Bot ini telah di-upgrade dengan sistem plugin yang modular dan berbagai fitur canggih.

## 🚀 Fitur Baru & Upgraded
- **Modular Plugin System**: Memudahkan penambahan fitur baru tanpa menyentuh file core.
- **Auto Update**: Bot dapat mengupdate dirinya sendiri dari repository GitHub.
- **Dynamic Help Menu**: Menu bantuan yang terorganisir per kategori secara otomatis.
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
- `plugins/`: Tempat file perintah bot (modular).
- `lib/`: Kumpulan library, scrapers, dan utility.
- `database/`: Penyimpanan data user dan settings (JSON).
- `handler.js`: Message handler utama (sekarang mendukung plugin).

## 📝 Kontribusi
Silakan tambahkan plugin baru di folder `plugins/` dengan format yang sudah ditentukan.

---
© 2026 Shikytemo
