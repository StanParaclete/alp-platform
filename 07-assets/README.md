# ALP media

The live media catalogue is `02-webapp/src/content/media.json`. Change slot IDs, alt text, crop positions and gallery captions there, then build and deploy. Components never contain image filenames.

All twelve supplied images and the MP4 are stored under `02-webapp/public/assets/community-2026-09/`. Originals in Downloads are unchanged. Filenames are retained to preserve attribution context. These photographs are illustrative education imagery, not verified ALP customers or testimonials. Rights and model-release records must be retained by the publisher; filenames alone do not establish a licence.

The video is disabled until its content is reviewed. Illustrations remain available in the catalogue but are not mixed into the photographic homepage. Do not put private school or student uploads in this public folder.

When replacing a published file, use a new filename or a new versioned directory because the CDN caches `/assets/` immutably. Validate all media with `npm run test:media` in `02-webapp`.
