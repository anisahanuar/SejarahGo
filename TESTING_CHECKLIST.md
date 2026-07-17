# SejarahGo V4 — Testing Checklist

## General

- [ ] Splash screen masuk ke main menu.
- [ ] Nama pemain wajib diisi.
- [ ] Nama custom muncul pada home, result dan leaderboard.
- [ ] Kedua-dua gaya watak boleh dipilih.
- [ ] Bahasa BM dan EN menukar menu serta kandungan misi.
- [ ] Progress kekal selepas refresh.
- [ ] Reset progress berfungsi.

## Runner

- [ ] Kiri dan kanan menukar lorong.
- [ ] Jump mengelakkan barrier.
- [ ] Slide mengelakkan arch.
- [ ] Syiling menambah jumlah kutipan.
- [ ] Pelanggaran mengurangkan nyawa.
- [ ] Gerbang cabaran membuka mini-game yang betul.
- [ ] Pause, resume dan quit berfungsi.

## Mini-games

- [ ] Misi 1 — pilihan jawapan boleh ditekan dan jawapan dinilai.
- [ ] Misi 2 — item timeline boleh digerakkan naik dan turun.
- [ ] Misi 3 — jubin puzzle 3×3 hanya bergerak ke ruang kosong.
- [ ] Misi 4 — siri benar/palsu bergerak ke pernyataan seterusnya.
- [ ] Misi 5 — pilihan huruf awal dan akhir mengesan perkataan.
- [ ] Misi 6 — kotak crossword menerima satu huruf dan menyemak semua jawapan.
- [ ] Misi 7 — scramble menerima istilah yang betul.
- [ ] Misi 8 — kad matching terbuka, tertutup dan kekal apabila betul.
- [ ] Misi 9 — jawapan bertulis dinormalisasi dan dinilai.
- [ ] Hint berfungsi untuk kesemua sembilan mini-game.
- [ ] Timer tamat menghasilkan kegagalan percubaan.

## Progression and rewards

- [ ] Misi seterusnya hanya dibuka selepas misi semasa selesai.
- [ ] Skor, syiling, XP dan bintang dikira.
- [ ] Keputusan gagal mempunyai retry.
- [ ] Leaderboard menyimpan skor terbaik pemain.
- [ ] Achievement dibuka mengikut progress.

## Deployment

- [ ] Semua fail dimuat naik ke `htdocs`.
- [ ] `index.html` berada terus dalam `htdocs`.
- [ ] Folder `css`, `js` dan `assets` tidak ditukar nama.
- [ ] Website boleh dibuka melalui HTTPS.
- [ ] Browser console tidak menunjukkan ralat JavaScript.
