# Cara Publish SejarahGo di InfinityFree

## 1. Cipta akaun hosting

Cadangan subdomain:

```text
sejarahgo.free.nf
```

Jika sudah digunakan, cuba:

```text
playsejarahgo.free.nf
sejarahgo2026.free.nf
sejarahgo.42web.io
```

## 2. Buka File Manager

Selepas hosting account siap:

1. Buka Control Panel.
2. Pilih Online File Manager.
3. Buka folder `htdocs`.
4. Padam fail default seperti `index2.html` jika ada.

## 3. Upload fail permainan

Upload **isi di dalam folder projek**, bukan folder luar dan bukan ZIP yang belum diextract.

Susunan yang betul:

```text
htdocs/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── data.js
│   └── app.js
├── assets/
├── manifest.webmanifest
└── sw.js
```

Susunan yang salah:

```text
htdocs/SejarahGo_V4_MultiMission/index.html
```

Jika `index.html` berada dalam folder tambahan, domain utama mungkin memaparkan halaman kosong atau directory listing.

## 4. Buka website

Tunggu beberapa minit selepas upload, kemudian buka domain. Gunakan hard refresh:

```text
Ctrl + F5
```

Jika versi lama masih muncul, clear cache atau buka dalam Incognito Mode kerana projek menggunakan Service Worker.

## 5. Semakan akhir

- Pastikan semua watak muncul.
- Pastikan CSS dan JavaScript dimuatkan.
- Cuba BM dan EN.
- Main sekurang-kurangnya Misi 1 hingga result page.
- Buka pada telefon.
