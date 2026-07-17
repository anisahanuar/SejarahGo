# SejarahGo V4 — Multi-Mission Adventure

SejarahGo ialah permainan web pendidikan dwibahasa untuk Sejarah Tingkatan 1, Bab 2, 3 dan 4. Versi ini mengekalkan konsep **adventure runner** tetapi setiap misi membuka **jenis permainan mini yang berbeza**, bukannya semua misi menggunakan kuiz pilihan berganda.

## Peta sembilan misi

| Misi | Bab | Tahap | Permainan mini |
|---|---|---|---|
| 1 | Bab 2 — Zaman Air Batu | Mudah | Kuiz pilihan berganda |
| 2 | Bab 2 — Zaman Air Batu | Sederhana | Puzzle garis masa |
| 3 | Bab 2 — Zaman Air Batu | Sukar | Puzzle gelongsor 3×3 |
| 4 | Bab 3 — Zaman Prasejarah | Mudah | Kuiz benar / palsu |
| 5 | Bab 3 — Zaman Prasejarah | Sederhana | Heritage Hunt / word search |
| 6 | Bab 3 — Zaman Prasejarah | Sukar | Teka silang kata |
| 7 | Bab 4 — Mengenali Tamadun | Mudah | Susun perkataan |
| 8 | Bab 4 — Mengenali Tamadun | Sederhana | Padanan artifak dan fungsi |
| 9 | Bab 4 — Mengenali Tamadun | Sukar | Jawapan bertulis |

## Fungsi utama

- Bahasa Melayu dan English
- Nama watak boleh ditaip sendiri
- Dua gaya watak: 3D cartoon dan historical explorer
- Runner tiga lorong, lompat, slide dan kutipan syiling
- Sembilan mini-game berbeza
- Timer mini-game dan timer runner
- Nyawa, skor, syiling, XP, bintang dan petunjuk
- Level unlock, achievements dan leaderboard
- Bunyi, muzik, volume dan reduced motion
- Simpan progress menggunakan `localStorage`
- Responsive untuk laptop dan telefon
- Boleh dipasang sebagai Progressive Web App apabila dihoskan melalui HTTPS

## Cara buka dalam Visual Studio Code

1. Extract folder projek.
2. Buka folder `SejarahGo_V4_MultiMission` dalam Visual Studio Code.
3. Pasang extension **Live Server**.
4. Klik kanan `index.html`.
5. Pilih **Open with Live Server**.

Jangan buka fail JavaScript secara berasingan. Permainan mesti bermula melalui `index.html`.

## Struktur projek

```text
SejarahGo_V4_MultiMission/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── data.js
│   └── app.js
├── assets/
│   ├── characters/
│   └── icons/
├── manifest.webmanifest
├── sw.js
├── REPORT_GUIDE.md
├── TESTING_CHECKLIST.md
└── DEPLOY_INFINITYFREE.md
```

## Nota kandungan

Semua teks antaramuka dan aktiviti utama mempunyai versi Bahasa Melayu dan English. Data soalan, susunan garis masa, perkataan tersembunyi, crossword, scramble, matching dan jawapan bertulis berada dalam `js/data.js`. Logik permainan berada dalam `js/app.js`.
