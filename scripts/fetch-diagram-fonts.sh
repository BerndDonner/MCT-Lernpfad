#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
font_dir="$repo_root/fonts"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$font_dir"

inter_url="https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip"
jetbrains_url="https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip"

curl -fL "$inter_url" -o "$tmp_dir/inter.zip"
curl -fL "$jetbrains_url" -o "$tmp_dir/jetbrains-mono.zip"

unzip -q "$tmp_dir/inter.zip" -d "$tmp_dir/inter"
unzip -q "$tmp_dir/jetbrains-mono.zip" -d "$tmp_dir/jetbrains-mono"

inter_font="$(find "$tmp_dir/inter" -type f -name 'InterVariable.ttf' -print -quit)"
jetbrains_font="$(find "$tmp_dir/jetbrains-mono" -type f -path '*/fonts/variable/*.ttf' ! -iname '*italic*' -print -quit)"

if [[ -z "$inter_font" || -z "$jetbrains_font" ]]; then
  echo "Fontdatei im Release-Archiv nicht gefunden." >&2
  exit 1
fi

install -m 0644 "$inter_font" "$font_dir/InterVariable.ttf"
install -m 0644 "$jetbrains_font" "$font_dir/JetBrainsMonoVariable.ttf"

inter_license="$(find "$tmp_dir/inter" -type f \( -iname 'LICENSE.txt' -o -iname 'OFL.txt' \) -print -quit)"
jetbrains_license="$(find "$tmp_dir/jetbrains-mono" -type f \( -iname 'OFL.txt' -o -iname 'LICENSE.txt' \) -print -quit)"

[[ -z "$inter_license" ]] || install -m 0644 "$inter_license" "$font_dir/OFL-Inter.txt"
[[ -z "$jetbrains_license" ]] || install -m 0644 "$jetbrains_license" "$font_dir/OFL-JetBrainsMono.txt"

echo "Diagramm-Fonts installiert in: $font_dir"
