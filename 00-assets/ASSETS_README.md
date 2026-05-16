# ALP Platform — Assets Guide
## Built by Stan Paraclete | www.stanparaclete.com

This folder contains ALL images, logos, videos, and fonts needed for the ALP Platform.

---

## FOLDER STRUCTURE

```
00-assets/
├── logos/              ← All logo variants
├── images/
│   ├── hero/           ← Landing page hero images
│   ├── screens/        ← App screenshots for marketing
│   ├── team/           ← Team/teacher photos
│   ├── icons/          ← App icons (PWA, desktop)
│   ├── flags/          ← Country flags for global compliance
│   └── backgrounds/    ← Dot grid, textures
├── videos/
│   ├── hero/           ← Landing page background/hero video
│   ├── demo/           ← Product demo videos
│   └── tutorials/      ← How-to tutorial videos
├── fonts/              ← Self-hosted fonts (backup)
└── illustrations/      ← SVG illustrations
```

---

## LOGOS NEEDED

Place these files in: `00-assets/logos/`

| File Name | Size | Usage |
|-----------|------|-------|
| `alp-logo.png` | Your ALP.png (already have it) | App header, login |
| `alp-logo.svg` | Vector version | Scalable everywhere |
| `alp-logo-white.png` | White version | Dark backgrounds |
| `alp-logo-black.png` | Black version | Light backgrounds |
| `alp-icon-32.png` | 32×32px | Browser favicon |
| `alp-icon-192.png` | 192×192px | PWA install icon |
| `alp-icon-512.png` | 512×512px | PWA splash screen |
| `alp-icon-1024.png` | 1024×1024px | App Store / Play Store |
| `stan-paraclete-logo.png` | Your personal logo | Footer "Built by" |

**You already have:** `ALP.png` — use this as `alp-logo.png`

---

## IMAGES NEEDED

### Landing Page Hero (`images/hero/`)
| File | Dimensions | Content |
|------|-----------|---------|
| `hero-teacher.jpg` | 1200×800px | Teacher working with student (diverse classroom) |
| `hero-classroom.jpg` | 1600×900px | Modern special education classroom |
| `hero-family.jpg` | 800×600px | Parent and child reviewing progress |
| `dashboard-preview.png` | 1440×900px | Screenshot of ALP dashboard (use app screenshot) |

### App Screenshots for Marketing (`images/screens/`)
| File | Dimensions | Content |
|------|-----------|---------|
| `screen-dashboard.png` | 1440×900px | Dashboard screenshot |
| `screen-builder.png` | 1440×900px | ALP Builder screenshot |
| `screen-progress.png` | 1440×900px | Progress monitoring screenshot |
| `screen-family.png` | 1440×900px | Family portal screenshot |
| `screen-mobile.png` | 390×844px | Mobile app screenshot |

### Country/Region Icons (`images/flags/`)
| File | Size | For |
|------|------|-----|
| `flag-us.svg` | 24×18px | IDEA USA compliance |
| `flag-gh.svg` | 24×18px | GES Ghana |
| `flag-ng.svg` | 24×18px | NERDC Nigeria |
| `flag-ke.svg` | 24×18px | KICD Kenya |
| `flag-za.svg` | 24×18px | WCED South Africa |
| `flag-gb.svg` | 24×18px | UK SEND |
| `flag-ca.svg` | 24×18px | Canada IEP |
| `flag-au.svg` | 24×18px | Australia NCCD |

### App Icons (PWA + Desktop) (`images/icons/`)
| File | Size | Usage |
|------|------|-------|
| `icon-72.png` | 72×72px | PWA |
| `icon-96.png` | 96×96px | PWA |
| `icon-128.png` | 128×128px | PWA |
| `icon-144.png` | 144×144px | PWA / Android |
| `icon-152.png` | 152×152px | iOS |
| `icon-192.png` | 192×192px | PWA / Android |
| `icon-384.png` | 384×384px | PWA |
| `icon-512.png` | 512×512px | PWA splash |
| `favicon.ico` | 16,32,48px | Browser tab |
| `apple-touch.png` | 180×180px | iPhone home screen |

---

## VIDEOS NEEDED

Place in: `00-assets/videos/`

### Hero Video (`videos/hero/`)
| File | Length | Format | Usage |
|------|--------|--------|-------|
| `hero-bg.mp4` | 15–30 sec | MP4 H.264 | Landing page subtle background loop |
| `hero-bg.webm` | 15–30 sec | WebM | Fallback for Firefox |

**Content:** Slow motion classroom footage — teacher with students, writing, learning.
**Style:** Warm tones, slightly blurred/darkened to show text over it.

### Demo Video (`videos/demo/`)
| File | Length | Format | Usage |
|------|--------|--------|-------|
| `alp-demo.mp4` | 2–3 min | MP4 H.264 | Product walkthrough on landing page |
| `alp-demo-thumb.jpg` | 1280×720px | JPG | Video thumbnail |

**Content:** Screen recording showing:
1. Login → Dashboard
2. Creating an ALP in 60 seconds
3. AI goal generation
4. Family portal
5. Export PDF

### Tutorial Videos (`videos/tutorials/`)
| File | Length | Content |
|------|--------|---------|
| `01-getting-started.mp4` | 5 min | First ALP from scratch |
| `02-ai-goals.mp4` | 3 min | Using AI goal suggestions |
| `03-progress-monitoring.mp4` | 4 min | Logging and tracking progress |
| `04-family-portal.mp4` | 3 min | Family collaboration features |
| `05-export-pdf.mp4` | 2 min | Exporting and sharing ALPs |

---

## WHERE EACH ASSET IS USED IN CODE

### In `02-webapp/` (React Web App)
```
public/
├── favicon.ico          ← Browser tab icon
├── apple-touch-icon.png ← iPhone home screen
├── manifest.json        ← PWA (already created, references icons)
├── sw.js               ← Service worker (already created)
└── icons/              ← All PWA icons above
```

### In `01-website/` (Marketing Site)
```
public/
├── images/
│   ├── hero-teacher.jpg
│   ├── dashboard-preview.png
│   └── screen-*.png
└── videos/
    └── hero-bg.mp4
```

### In `03-app/` (React Native Mobile)
```
assets/
├── icon.png            ← 1024×1024 app icon
├── splash.png          ← Splash screen
├── adaptive-icon.png   ← Android adaptive icon
└── favicon.png         ← Web build favicon
```

### In `04-software/` (Electron Desktop)
```
assets/
├── icon.icns           ← macOS icon
├── icon.ico            ← Windows icon
└── icon.png            ← Linux icon
```

---

## HOW TO ADD YOUR ALP LOGO TO THE APP

Your `ALP.png` logo is the purple geometric snowflake + AI robot head.

**Step 1:** Copy your logo to the right places:
```bash
# Web App
cp ALP.png 02-webapp/public/icons/alp-logo.png
cp ALP.png 02-webapp/public/icons/icon-192.png

# Mobile App
cp ALP.png 03-app/assets/icon.png

# Desktop App
cp ALP.png 04-software/assets/icon.png
```

**Step 2:** In `ALP_Platform_FINAL.jsx`, replace the text "ALP" box in the nav/sidebar with:
```jsx
<img src="/icons/alp-logo.png" alt="ALP" style={{width:36,height:36,borderRadius:9}}/>
```

---

## FREE IMAGE SOURCES (for placeholders)

- **Unsplash:** https://unsplash.com/s/photos/special-education
  Search: "classroom", "teacher student", "special education", "learning"
- **Pexels:** https://pexels.com - search "diverse classroom Africa"
- **Undraw:** https://undraw.co - Free SVG illustrations (education themed)
- **Flaticon:** https://flaticon.com - Icons for features
- **Country Flags:** https://flagicons.lipis.dev - Free SVG country flags

---

## VIDEO RESOURCES

- **Screen Recording:** Use QuickTime (Mac) or OBS Studio (free)
- **Stock Footage:** https://coverr.io (free classroom/education videos)
- **Background Music:** https://pixabay.com/music (royalty-free)

---

## QUICK START: What to do RIGHT NOW

1. ✅ **You already have:** `ALP.png` (your logo)
2. 📸 **Take screenshots** of the running app for `images/screens/`
3. 🎥 **Record a demo video** using QuickTime screen recording
4. 🌐 **Download 2–3 hero images** from Unsplash (education/classroom)
5. 🏳️ **Download flag SVGs** from flagicons.lipis.dev for compliance section

---
*Built by Stan Paraclete · www.stanparaclete.com · ALP Platform v2.4.1*
