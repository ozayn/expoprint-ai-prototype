#!/usr/bin/env bash
# ExpoPrint AI prototype — local Next.js dev (macOS-friendly)
set -e

echo "Starting ExpoPrint AI prototype…"

if [[ ! -d node_modules ]]; then
  echo "node_modules not found; running npm install…"
  npm install
fi

if lsof -ti :3000 >/dev/null 2>&1; then
  if pgrep -f "next-server" >/dev/null 2>&1; then
    echo ""
    echo "Warning: port 3000 is already in use (often a stale Next.js dev server)."
    echo "  /progress and other pages may show OLD content on http://localhost:3000"
    echo "  Stop it:  kill \$(lsof -ti :3000 | while read p; do ps -p \"\$p\" -o comm= | grep -q next && echo \"\$p\"; done | head -1)"
    echo "  Or use the URL printed below if Next starts on another port (e.g. 3001)."
    echo ""
  fi
fi

exec npm run dev
