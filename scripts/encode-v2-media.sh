#!/usr/bin/env bash
# Кадры из Blender (blender/render_v2.py) → видео-петли и постеры для /v2 в public/v2/media.
#   scripts/encode-v2-media.sh <папка-с-рендерами>
# Ожидает <папка>/corridor/*.png и <папка>/products/<имя>/*.png.
set -euo pipefail

SRC=${1:?папка с рендерами}
OUT=public/v2/media
mkdir -p "$OUT"

encode() { # <папка-кадров> <имя> <ширина>
  local dir=$1 name=$2 width=$3
  ffmpeg -loglevel error -y -framerate 24 -i "$dir/%03d.png" \
    -vf "scale=${width}:-2:flags=lanczos" -c:v libx264 -preset slow -crf 22 \
    -pix_fmt yuv420p -movflags +faststart -an "$OUT/$name.mp4"
  ffmpeg -loglevel error -y -i "$dir/001.png" -vf "scale=${width}:-2:flags=lanczos" -q:v 3 "$OUT/$name.jpg"
  echo "$name: $(du -h "$OUT/$name.mp4" | cut -f1)"
}

[ -d "$SRC/corridor" ] && encode "$SRC/corridor" corridor 1600
for dir in "$SRC"/products/*/; do
  [ -d "$dir" ] && encode "$dir" "$(basename "$dir")" 960
done
