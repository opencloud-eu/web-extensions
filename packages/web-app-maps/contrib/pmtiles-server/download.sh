#!/usr/bin/env sh
set -eu

DIR="/wwwroot"

# --- Check if everything is already present ---

NEED_PMTILES=true
NEED_FONTS=true

existing_tmp=$(find "$DIR" -maxdepth 1 -name "*.pmtiles.tmp" -print -quit 2>/dev/null || true)
existing=$(find "$DIR" -maxdepth 1 -name "*.pmtiles" ! -name "latest.pmtiles" ! -name "*.tmp" -print -quit 2>/dev/null || true)

if [ -z "$existing_tmp" ] && [ -n "$existing" ]; then
  echo "PMTiles file already exists: $(basename "$existing")"
  ln -sf "$(basename "$existing")" "$DIR/latest.pmtiles"
  NEED_PMTILES=false
fi

if [ -d "$DIR/fonts/Noto Sans Regular" ]; then
  echo "Font assets already exist."
  NEED_FONTS=false
fi

if [ "$NEED_PMTILES" = false ] && [ "$NEED_FONTS" = false ]; then
  echo "Nothing to download."
  exit 0
fi

# --- Install tools only when we actually need to download ---

apk add --no-cache aria2 curl tar

# --- PMTiles ---

if [ "$NEED_PMTILES" = true ]; then
  if [ -n "$existing_tmp" ]; then
    # Resume a previous interrupted download
    base="$(basename "$existing_tmp" .tmp)"
    echo "Resuming PMTiles download: $base"
    aria2c -c -x 16 -s 16 -d "$DIR" -o "${base}.tmp" \
      "https://build.protomaps.com/${base}"
    mv "$existing_tmp" "$DIR/$base"
    ln -sf "$base" "$DIR/latest.pmtiles"
  else
    # Start a fresh download for today's build
    TODAY="$(date +%Y%m%d)"
    TARGET="$DIR/$TODAY.pmtiles"
    TMP="$TARGET.tmp"
    echo "Downloading $TODAY.pmtiles (~120 GB)..."
    aria2c -c -x 16 -s 16 -d "$DIR" -o "$TODAY.pmtiles.tmp" \
      "https://build.protomaps.com/$TODAY.pmtiles"
    mv "$TMP" "$TARGET"
    ln -sf "$TODAY.pmtiles" "$DIR/latest.pmtiles"
    echo "Done: $TARGET"
  fi
fi

# --- Fonts ---

if [ "$NEED_FONTS" = true ]; then
  echo "Downloading font assets (~14 MB)..."
  curl -sL https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.tar.gz \
    | tar xz -C "$DIR" --strip-components=1 basemaps-assets-main/fonts
  echo "Done: fonts extracted to $DIR/fonts/"
fi
