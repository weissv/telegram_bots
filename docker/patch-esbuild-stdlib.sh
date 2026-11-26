#!/bin/sh
# Swap esbuild's published platform binaries for builds produced with Go 1.26.11.
# Those npm binaries are what carry the Go stdlib into the runtime image.
# pnpm hardlinks each binary into more than one directory, so every copy under
# node_modules is replaced without rewriting the content-addressable store.
set -eu

root="${1:?node_modules path required}"
stdlib_dir="${2:?directory of rebuilt esbuild binaries required}"

if [ ! -d "$root" ]; then
  echo "esbuild stdlib patch: node_modules not found at $root" >&2
  exit 1
fi

list=$(mktemp)
# Each hardlinked copy is a separate directory entry and must be replaced on its own.
find "$root" -type f -name esbuild | sort > "$list"

replaced=0
while IFS= read -r bin; do
  [ -n "$bin" ] || continue
  if ! node -e '
    const fs = require("fs");
    const fd = fs.openSync(process.argv[1], "r");
    const head = Buffer.alloc(4);
    fs.readSync(fd, head, 0, 4, 0);
    fs.closeSync(fd);
    process.exit(head[0] === 0x7f && head.toString("ascii", 1, 4) === "ELF" ? 0 : 1);
  ' "$bin"; then
    continue
  fi
  pkgjson=$(dirname "$(dirname "$bin")")/package.json
  ver=$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).version)' "$pkgjson")
  src="$stdlib_dir/esbuild-$ver"
  if [ ! -f "$src" ]; then
    echo "esbuild stdlib patch: no Go 1.26.11 rebuild for esbuild@$ver ($bin)" >&2
    exit 1
  fi
  rm -f "$bin"
  cp "$src" "$bin"
  chmod 755 "$bin"
  got=$("$bin" --version)
  if [ "$got" != "$ver" ]; then
    echo "esbuild stdlib patch: $bin reports '$got', expected $ver" >&2
    exit 1
  fi
  replaced=$((replaced + 1))
  echo "patched $bin (esbuild $ver -> go1.26.11)"
done < "$list"
rm -f "$list"

if [ "$replaced" -eq 0 ]; then
  echo "esbuild stdlib patch: no esbuild binaries found under $root" >&2
  exit 1
fi

# Every ELF under node_modules that embeds a Go stdlib version must be >= 1.26.9,
# and every esbuild binary must be the Go 1.26.11 rebuild.
node -e '
const fs = require("fs");
const path = require("path");
const root = process.argv[1];
const minMinor = 9;
const versionRe = /go1\.(\d+)\.(\d+)/g;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      walk(p);
      continue;
    }
    if (!ent.isFile()) continue;
    const fd = fs.openSync(p, "r");
    const head = Buffer.alloc(4);
    const n = fs.readSync(fd, head, 0, 4, 0);
    if (n < 4 || head[0] !== 0x7f || head.toString("ascii", 1, 4) !== "ELF") {
      fs.closeSync(fd);
      continue;
    }
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, 0);
    fs.closeSync(fd);
    const text = buf.toString("latin1");
    const versions = [];
    for (const match of text.matchAll(versionRe)) {
      const after = text.charCodeAt(match.index + match[0].length);
      // Ignore versions embedded in prose ("such as go1.22.3not an official").
      // A stdlib version string is a token, not followed by a letter.
      if ((after >= 65 && after <= 90) || (after >= 97 && after <= 122)) continue;
      versions.push(match);
    }
    const isEsbuild = path.basename(p) === "esbuild";
    if (isEsbuild && !versions.some((match) => match[0] === "go1.26.11")) {
      console.error("esbuild binary is not the go1.26.11 rebuild:", p);
      process.exit(1);
    }
    for (const match of versions) {
      const major = Number(match[1]);
      const minor = Number(match[2]);
      if (major < 26 || (major === 26 && minor < minMinor)) {
        console.error("Go stdlib", match[0], "is older than go1.26." + minMinor + ":", p);
        process.exit(1);
      }
    }
  }
}

walk(root);
' "$root"
echo "esbuild stdlib patch: replaced $replaced binaries; Go stdlib is go1.26.11"
