#!/bin/bash
# MCJS Mirror - Game Files Downloader
# Downloads all available game files from MCJS CDN mirrors.
# Files > 10MB are automatically split for GitHub Pages compatibility.

set -e

BASE_URLS=(
  "https://play.mcjs.144449.xyz"
  "https://mirror.mcjs.cc"
  "https://ipv6.mcjs.cc"
)

DEST="versions"
CHUNK_SIZE=$((9 * 1024 * 1024))  # 9MB per chunk (safe margin under 10MB)

declare -A VERSIONS=(
  ["1.8.8"]="1.8.8"
  ["1.8.8wasm"]="1.8.8wasm"
  ["1.12.2"]="1.12.2"
  ["1.12.2wasm"]="1.12.2wasm"
  ["1.12.2u3wasm"]="1.12.2u3wasm"
  ["1.6.4"]="1.6.4"
  ["1.5.2"]="1.5.2"
  ["1.2.5"]="1.2.5"
  ["beta1.7.3"]="beta1.7.3"
  ["beta1.3"]="beta1.3"
  ["alpha1.2.6"]="alpha1.2.6"
)

# Also try beta CDN for newer versions
declare -A BETA_VERSIONS=(
  ["1.16.5"]="1.16.5"
  ["1.21.11"]="1.21.11"
  ["26.1.2"]="26.1.2"
)

download_file() {
  local url="$1"
  local dest_file="$2"
  local version_name="$3"
  
  for base in "${BASE_URLS[@]}"; do
    local full_url="${base}/${url}"
    echo -n "  Trying ${base}... "
    local http_code
    http_code=$(curl -sL --max-time 120 -o "${dest_file}.tmp" -w "%{http_code}" "$full_url" 2>/dev/null)
    
    if [ "$http_code" = "200" ]; then
      local file_size
      file_size=$(stat -c%s "${dest_file}.tmp" 2>/dev/null || stat -f%z "${dest_file}.tmp" 2>/dev/null)
      if [ "$file_size" -lt 1000 ]; then
        echo "too small (likely redirect), skipping"
        rm -f "${dest_file}.tmp"
        continue
      fi
      mv "${dest_file}.tmp" "$dest_file"
      local size_mb=$((file_size / 1024 / 1024))
      echo "OK (${size_mb}MB)"
      
      # Split if > 10MB
      if [ "$file_size" -gt $((10 * 1024 * 1024)) ]; then
        echo "  Splitting into chunks..."
        split -b $CHUNK_SIZE -d -a 2 "$dest_file" "${dest_file}.part"
        rm -f "$dest_file"
        local chunk_count
        chunk_count=$(ls "${dest_file}.part"* | wc -l)
        echo "  Split into $chunk_count chunks"
      fi
      return 0
    else
      rm -f "${dest_file}.tmp"
      echo "failed (HTTP $http_code)"
    fi
  done
  
  echo "  [SKIP] Could not download $version_name from any mirror"
  return 1
}

echo "========================================="
echo "  MCJS Mirror - Game Files Downloader"
echo "========================================="
echo ""

mkdir -p "$DEST"

success=0
fail=0

# Download standard versions
for ver in "${!VERSIONS[@]}"; do
  echo "[$ver]"
  mkdir -p "$DEST/$ver"
  
  for file in "classes.js" "assets.epk"; do
    download_file "${VERSIONS[$ver]}/$file" "$DEST/$ver/$file" "$ver/$file" && success=$((success+1)) || fail=$((fail+1))
  done
  echo ""
done

# Download beta versions from alternate CDN
echo "--- Beta Versions (alternate CDN) ---"
echo ""

for ver in "${!BETA_VERSIONS[@]}"; do
  echo "[$ver]"
  mkdir -p "$DEST/$ver"
  
  local_url="https://mcjs-beta.144449.xyz/${BETA_VERSIONS[$ver]}/classes.js"
  dest_file="$DEST/$ver/classes.js"
  echo -n "  Trying mcjs-beta CDN... "
  http_code=$(curl -sL --max-time 180 -o "${dest_file}.tmp" -w "%{http_code}" "$local_url" 2>/dev/null)
  
  if [ "$http_code" = "200" ]; then
    file_size=$(stat -c%s "${dest_file}.tmp" 2>/dev/null || stat -f%z "${dest_file}.tmp" 2>/dev/null)
    if [ "$file_size" -gt 1000 ]; then
      mv "${dest_file}.tmp" "$dest_file"
      size_mb=$((file_size / 1024 / 1024))
      echo "OK (${size_mb}MB)"
      
      if [ "$file_size" -gt $((10 * 1024 * 1024)) ]; then
        echo "  Splitting into chunks..."
        split -b $CHUNK_SIZE -d -a 2 "$dest_file" "${dest_file}.part"
        rm -f "$dest_file"
        chunk_count=$(ls "${dest_file}.part"* | wc -l)
        echo "  Split into $chunk_count chunks"
      fi
      success=$((success+1))
    else
      rm -f "${dest_file}.tmp"
      echo "too small, skipping"
      fail=$((fail+1))
    fi
  else
    rm -f "${dest_file}.tmp"
    echo "failed (HTTP $http_code)"
    fail=$((fail+1))
  fi
  echo ""
done

echo "========================================="
echo "  Download complete!"
echo "  Success: $success | Failed/Skipped: $fail"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Push this folder to your GitHub repository"
echo "  2. Enable GitHub Pages in Settings > Pages"
echo "  3. The launcher will auto-detect local files"
