# Cara menjalankan BlockMotion Studio

## Persyaratan

- Node.js 20.19+ atau 22.12+ (disarankan Node 22)
- npm
- Browser desktop modern dengan WebGL
- Koneksi internet untuk `npm install` pertama kali

## Langkah

Buka Terminal dari folder `blockmotion-studio`:

```bash
npm install
npm run dev
```

Buka alamat localhost yang muncul di terminal, biasanya `http://localhost:5173`.

## Cara membuat animasi

1. Tambahkan **Blocky R6 Male / Female** lewat **Explorer → Add object / Presets**. Buka daftar sendi karakter, lalu pilih tubuh, kepala, lengan, atau kaki. Bagian tubuh juga bisa dipilih langsung di viewport. Pilih nama karakter untuk menggerakkan seluruh karakter.
2. Pilih tool **Rotate (R)** dan putar gizmo untuk menggerakkan joint.
3. Geser playhead ke waktu yang diinginkan melalui timeline.
4. Ubah rotasi/posisi, lalu tekan **K** atau tombol **Insert keyframe**. Mode **Auto key** aktif secara default.
5. Lakukan pada beberapa waktu berbeda, kemudian tekan **Space** untuk preview.
6. Pilih karakter male atau female, lalu klik **Wave / Walk / Jump / Idle** untuk menerapkan contoh animasi hanya pada karakter tersebut. Preset **Camera** mengubah animasi kamera.
7. Pilih **Shot Camera** pada Explorer, gunakan gizmo untuk mengubah kamera dan tambah keyframe pada track kamera. Klik **Camera view** untuk melihat hasil.
8. Klik **Save** untuk mengunduh project JSON; gunakan **Open** untuk memuatnya kembali. **Export** juga menyediakan screenshot PNG dan video WebM (tergantung browser).

Semua karakter adalah node scene biasa. Tombol sampah di Explorer atau **Delete character** di Inspector menghapus karakter beserta seluruh animasi sendinya. **Ctrl/Cmd+Z** mengembalikannya. Tidak ada karakter utama yang wajib dipertahankan. Duplikasi karakter ikut menyalin animasi setiap sendi.

## Struktur singkat

- `src/engine/StudioScene.ts` — Three.js scene, kamera, gizmo, pemilihan node, dan rendering. Karakter bersendi dibuat di `src/engine/CharacterAsset.ts`.
- `src/editor/` — model data, Zustand state, keyframe sampling, procedural animation presets.
- `src/components/` — Explorer, Inspector, Viewport, Timeline.
- `src/App.tsx` — layout, import/export, keyboard shortcuts, video recording.
- `src/style.css` — dark theme + responsive layout.

## Catatan

Versi ini adalah MVP. Tidak memerlukan file GLB/FBX, backend, atau database server. Format projek adalah JSON khusus BlockMotion Studio, **bukan** file animasi native Roblox. Jalankan `npm test` untuk memeriksa objek, animasi, karakter, dan migrasi proyek lama; gunakan `npm run build` untuk memeriksa TypeScript dan membuat build produksi. Jika ditemukan error `npm install` atau `npm run dev`, bagikan log terminal untuk debugging.

## Hapus dan reset

- **Timeline → Keyframes**: reset/hapus keyframe terpilih; hapus semua keyframe node, karakter, atau proyek. Track yang dikosongkan kembali ke transform dasar.
- **Reset pose**: netralkan sendi karakter pada playhead tanpa mengubah posisi seluruh karakter. Auto-key merekam perubahan ini; jika nonaktif, tekan **Key pose** untuk menyimpannya.
- **Explorer → Delete all**: hapus seluruh objek, karakter, dan keyframe (termasuk animasi kamera). Scene tidak menambahkan karakter default kembali. Pengaturan proyek dan sky tetap disimpan.
- Gunakan **Ctrl/Cmd+Z** untuk membatalkan reset atau penghapusan.

## Generator lingkungan

Buka **Explorer → Environment generator**, lalu pilih **Town**, **City**, **Mountains**, **Jungle**, atau **Desert**. Atur jumlah blok/bangunan untuk kota atau ukuran, tinggi, jumlah pohon/kaktus, dan batu untuk alam. **Seed** yang sama menghasilkan susunan yang sama. **Origin X/Z** menggeser lokasi hasil.

Pilih **Add to scene** untuk menambahkan hasil, atau **Replace scene objects** untuk mengganti objek yang ada. Perkiraan jumlah objek ditampilkan sebelum Generate, dengan batas 500 objek. Hasil langsung masuk ke tampilan kamera editor; **Frame result** menampilkannya kembali. Satu kali **Ctrl/Cmd+Z** membatalkan satu generasi. Bangunan dan vegetasi bisa diedit terpisah; terrain dan jaringan jalan masing-masing berupa satu node.

## Pergantian kamera otomatis saat Play

Di timeline, pilih sudut pada **Camera cuts**, geser playhead, lalu tekan **Cut here**. Ulangi pada waktu lain. Aktifkan **Preview cuts**, kemudian tekan **Play** untuk mengganti sudut otomatis sesuai timeline.

**Current view** menyimpan tampilan kamera yang sedang terlihat. **Front / Back / Left / Right / Top / Perspective** membingkai objek terpilih; **Shot Camera** memakai animasi kamera yang sudah dibuat. Sudut tersimpan bersifat tetap, belum mengikuti objek otomatis.

Ikon kamera pada baris **Camera cuts** bisa digeser, dipilih untuk mengedit waktunya, atau dihapus dengan tombol sampah / **Delete**. **Capture view** mengganti sudut cut terpilih. Perubahan mendukung undo/redo dan ikut tersimpan dalam proyek maupun digunakan saat rekaman WebM.
