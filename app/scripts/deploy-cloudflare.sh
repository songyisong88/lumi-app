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

# ONLY=real | ONLY=demo deploys just one site (default: both).
ONLY="${ONLY:-both}"
APP="$PWD"
if [ "$ONLY" != demo ]; then
  npx tsc -b
  VITE_BASE=/ npx vite build --outDir dist-cf-real --emptyOutDir
  headers dist-cf-real
fi
if [ "$ONLY" != real ]; then
  # DEMO: new features are tried there first. Built from the `demo` branch when it exists (same rule as the
  # GitHub Pages workflow); DEMO_REF=main (or any ref) overrides; without a `demo` branch it is built from this tree.
  DEMO_REF="${DEMO_REF:-}"
  if [ -z "$DEMO_REF" ] && git ls-remote --exit-code --heads origin demo >/dev/null 2>&1; then DEMO_REF=origin/demo; fi
  if [ -n "$DEMO_REF" ] && [ "$DEMO_REF" != "." ]; then
    git fetch -q origin main demo 2>/dev/null || true
    SRC="$(mktemp -d)/demo-src"; git worktree add -q --detach "$SRC" "$DEMO_REF"
    trap 'git -C "$APP" worktree remove --force "$SRC" >/dev/null 2>&1 || true' EXIT
    echo "DEMO built from $DEMO_REF @ $(git -C "$SRC" rev-parse --short HEAD)"
    # keep the demo up to date with main (merged only in this temp worktree, nothing is pushed)
    if [ "$DEMO_REF" = origin/demo ] && ! git -C "$SRC" merge-base --is-ancestor origin/main HEAD; then
      git -C "$SRC" -c user.name=deploy -c user.email=deploy@localhost merge -q --no-edit origin/main \
        && echo "  + merged main @ $(git rev-parse --short origin/main)" \
        || { git -C "$SRC" merge --abort; echo "WARNING: demo conflicts with main - built from demo only; merge main into demo"; }
    fi
    if cmp -s "$SRC/app/package-lock.json" "$APP/package-lock.json" && [ -d "$APP/node_modules" ]; then ln -s "$APP/node_modules" "$SRC/app/node_modules"; else (cd "$SRC/app" && npm ci); fi
    (cd "$SRC/app" && npx tsc -b && VITE_BASE=/ VITE_SITE=demo npx vite build --outDir "$APP/dist-cf-demo" --emptyOutDir)
  else
    npx tsc -b
    VITE_BASE=/ VITE_SITE=demo npx vite build --outDir dist-cf-demo --emptyOutDir
  fi
  headers dist-cf-demo
fi

if [ "${BUILD_ONLY:-0}" = 1 ]; then exit 0; fi
BR="${CF_BRANCH:-main}"
if [ "$ONLY" != demo ]; then $WR pages deploy dist-cf-real --project-name "$REAL_PROJECT" --branch "$BR" --commit-dirty=true; fi
if [ "$ONLY" != real ]; then $WR pages deploy dist-cf-demo --project-name "$DEMO_PROJECT" --branch "$BR" --commit-dirty=true; fi
