# Panduan Laporan Assignment 3 — SejarahGo V4

Gunakan bahagian berikut untuk memenuhi perkara yang dinyatakan dalam guideline Assignment 3.

## 1. Visual Ideas

SejarahGo menggunakan konsep **time-travel historical adventure**. Pemain mengawal pengembara yang berlari melalui laluan sejarah, mengutip syiling dan memasuki gerbang cabaran. Setiap gerbang membuka permainan mini yang berlainan supaya pengalaman pembelajaran tidak berulang.

Elemen visual utama:

- peta masa Bab 2, 3 dan 4;
- watak 3D cartoon dan historical explorer;
- warna navy, gold, cyan dan warna tanah;
- artifak, manuskrip, peta, glasier dan simbol tamadun;
- animasi parallax, particles, rotating carousel dan animated challenge modal.

## 2. Graphic Design

Reka bentuk menggunakan pendekatan game UI moden:

- gradient gelap untuk latar;
- warna emas untuk ganjaran dan butang utama;
- cyan untuk maklumat dan kemajuan;
- coral untuk kesalahan dan kehilangan nyawa;
- rounded cards, glow, shadow dan animated feedback;
- layout responsive untuk desktop dan telefon.

## 3. Knowledge on Components

Komponen utama projek:

- `index.html` — struktur skrin, menu, runner, tetapan dan modal cabaran;
- `css/styles.css` — tema, responsive layout dan animasi;
- `js/data.js` — terjemahan, bab, watak, kandungan serta sembilan jenis misi;
- `js/app.js` — state management, runner engine, mini-game engine, scoring dan saving;
- `localStorage` — menyimpan nama, watak, bahasa, skor, syiling dan progress;
- Canvas API — menghasilkan runner tiga lorong;
- Web Audio API — menghasilkan muzik dan kesan bunyi tanpa fail audio luar;
- Service Worker — cache aset untuk pengalaman PWA apabila dihoskan melalui HTTPS.

## 4. Project Flow

```text
Splash Screen
→ Main Menu
→ Create Player Name
→ Character Studio
→ Time Map
→ Select Mission
→ Runner Phase
→ Collect Challenge Artefact
→ Mission-Specific Mini-Game
→ Result and Rewards
→ Unlock Next Mission
```

Mini-game mengikut misi:

1. Multiple-choice quiz
2. Timeline puzzle
3. 3×3 sliding puzzle
4. True/false quiz
5. Word search
6. Crossword
7. Word scramble
8. Matching activity
9. Written answer

## 5. Content Platform

SejarahGo dibangunkan sebagai web-based game menggunakan:

- HTML5;
- CSS3;
- JavaScript;
- Visual Studio Code;
- Live Server untuk local testing;
- InfinityFree atau GitHub Pages untuk online deployment.

Platform ini dipilih kerana permainan boleh dibuka melalui browser tanpa pemasangan Unity atau aplikasi tambahan.

## 6. Final Setup

Sebelum presentation:

1. Jalankan semua sembilan misi.
2. Uji Bahasa Melayu dan English.
3. Uji pada laptop dan telefon.
4. Upload kandungan projek ke folder `htdocs` pada InfinityFree.
5. Pastikan `index.html` berada terus dalam `htdocs`.
6. Buka link HTTPS dan lakukan final testing.
7. Masukkan link serta QR code dalam slide presentation.

## Ayat penerangan platform untuk laporan

> SejarahGo was developed as a bilingual web-based educational game using HTML5, CSS3 and JavaScript in Visual Studio Code. The final game combines a three-lane adventure runner with nine different mini-games, including a multiple-choice quiz, timeline puzzle, 3×3 sliding puzzle, true-or-false challenge, word search, crossword, word scramble, artefact matching and written-answer activity. Player progress, coins, achievements and settings are stored locally through the browser's localStorage feature. The game is deployed online so it can be accessed through desktop and mobile web browsers.
