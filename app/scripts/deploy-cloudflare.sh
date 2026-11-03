#!/usr/bin/env bash
# Build both LUMI sites at the domain root and upload them to Cloudflare Pages (direct upload).
#   REAL  -> Pages project "lumi-app"   (only real server data, no sample content)
#   DEMO  -> Pages project "lumi-demo"  (VITE_SITE=demo, sample data + test accounts)
# Needs wrangler signed in (`npx wrangler login --device`) or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
# Never put a secret in this file.
set -euo pipefail
cd "$(dirname "$0")/.."
REAL_PROJECT="${CF_REAL_PROJECT:-lumi-app}"
DEMO_PROJECT="${CF_DEMO_PROJECT:-lumi-demo}"
WR="${WRANGLER:-npx --yes wrangler@4}"

headers() { # cache + basic security headers (no visual effect)
  cat > "$1/_headers" <<'H'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
/index.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/registerSW.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
H
}

npx tsc -b
VITE_BASE=/ npx vite build --outDir dist-cf-real --emptyOutDir
VITE_BASE=/ VITE_SITE=demo npx vite build --outDir dist-cf-demo --emptyOutDir
headers dist-cf-real; headers dist-cf-demo

if [ "${BUILD_ONLY:-0}" = 1 ]; then exit 0; fi
BR="${CF_BRANCH:-main}"
$WR pages deploy dist-cf-real --project-name "$REAL_PROJECT" --branch "$BR" --commit-dirty=true
$WR pages deploy dist-cf-demo --project-name "$DEMO_PROJECT" --branch "$BR" --commit-dirty=true
