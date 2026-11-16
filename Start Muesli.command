#!/bin/bash
# Double-click this file to start the Muesli GUI and open it in your browser.
# Keep the Terminal window it opens; closing that window (or pressing Ctrl+C) stops the service.

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-4747}"
URL="http://localhost:$PORT"

# Finder-launched shells can have a minimal PATH; add the usual Node.js locations.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

pause_and_exit() {
  echo
  read -n 1 -s -r -p "Press any key to close this window."
  echo
  exit "$1"
}

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Muesli is already running. Opening $URL"
  open "$URL"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install it from https://nodejs.org and try again."
  pause_and_exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies…"
  npm install || pause_and_exit 1
fi

echo "Starting Muesli at $URL"
echo "Keep this window open. Press Ctrl+C or close the window to stop the service."
echo

# Open the browser as soon as the server answers (waits up to 30 seconds).
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "$URL"; then
      open "$URL"
      break
    fi
    sleep 0.5
  done
) &

npm run gui -- --port "$PORT"
STATUS=$?
if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 130 ]; then
  echo
  echo "The service stopped unexpectedly (exit code $STATUS)."
  pause_and_exit "$STATUS"
fi
