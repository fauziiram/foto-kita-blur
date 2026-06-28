# Foto Kita Blur

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/fauziiram/foto-kita-blur)

Aplikasi web interaktif bertenaga AI lokal untuk mendeteksi pose tangan dan menyensor (blur) feed kamera secara real-time. Aplikasi ini dibangun menggunakan React, TypeScript, Vite, Tailwind CSS, dan Google MediaPipe Hand Landmarker.

## Fitur Utama

- **Deteksi Pose Real-Time**: Menggunakan model AI MediaPipe Hand Landmarker untuk mengenali pose tangan langsung dari webcam.
- **Auto-Blur Otomatis**: Sensor buram (blur) secara otomatis diaktifkan pada video feed ketika mendeteksi pose "Peace" (✌️).
- **100% Proses Lokal (Privacy-Friendly)**: Semua proses pengolahan gambar dan inferensi AI dijalankan sepenuhnya di dalam browser pengguna. Tidak ada data video atau gambar yang dikirim ke server luar.
- **Galeri Snapshot**: Ambil foto hasil sensor blur dan simpan di galeri lokal proyek Anda.

## Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan Anda memiliki perangkat lunak berikut yang terinstal di komputer Anda:

- **Node.js** (versi 18 ke atas disarankan)
- **NPM** (termasuk saat menginstal Node.js)
- Perangkat kamera/webcam yang berfungsi.

## Cara Menjalankan Aplikasi Secara Lokal

1. **Unduh atau Kloning Repositori**
   Pastikan Anda berada di direktori proyek ini:
   ```bash
   cd kamera-pose-blur
   ```

2. **Instal Dependensi**
   Jalankan perintah berikut untuk menginstal seluruh pustaka yang diperlukan:
   ```bash
   npm install
   ```

3. **Jalankan Server Pengembangan (Dev Server)**
   Mulai server lokal menggunakan Vite:
   ```bash
   npm run dev
   ```

4. **Buka Aplikasi di Browser**
   Buka peramban (browser) dan akses alamat:
   ```
   http://localhost:3000
   ```
   *Catatan: Izinkan akses webcam saat diminta oleh browser agar aplikasi dapat bekerja.*

## Teknologi yang Digunakan

- **Frontend**: React (v19) & TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **AI Engine**: `@mediapipe/tasks-vision` (Hand Landmarker)
- **Icons**: Lucide React
