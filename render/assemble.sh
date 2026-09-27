#!/bin/bash
# Concatenate rendered picture segments and mux with the final mix.
set -e
cd "$(dirname "$0")/.."
FF="${FFMPEG:-$(command -v ffmpeg || ls $HOME/Library/Python/*/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-* 2>/dev/null | head -1)}"
printf "file '%s'\n" "$PWD/out/master/part1.mp4" "$PWD/out/master/part2.mp4" "$PWD/out/master/part3.mp4" > out/master/parts.txt
"$FF" -hide_banner -loglevel error -y -f concat -safe 0 -i out/master/parts.txt -c copy out/master/picture.mp4
# Master: picture as rendered (x264 CRF 12) + AAC 320k
"$FF" -hide_banner -loglevel error -y -i out/master/picture.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart \
  -metadata title="The Same Fire" -metadata comment="NovaLT and gas-to-power as a service. Rendered entirely in code." \
  out/THE_SAME_FIRE_1080p_master.mp4
# Share: re-encoded to a friendlier size
"$FF" -hide_banner -loglevel error -y -i out/master/picture.mp4 -i audio/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -x264-params aq-mode=3 -c:a aac -b:a 256k -shortest -movflags +faststart \
  -metadata title="The Same Fire" out/THE_SAME_FIRE_1080p.mp4
ls -la out/*.mp4
