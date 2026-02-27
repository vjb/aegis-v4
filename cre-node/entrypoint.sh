#!/bin/bash
set -e

# Aegis CRE Oracle — Container Entrypoint
# Runs cre-setup on first start (compiles the Javy WASM plugin),
# then keeps the container alive for docker exec access.

SETUP_FLAG="/app/.cre_setup_done"

if [ ! -f "$SETUP_FLAG" ]; then
    echo "[entrypoint] Running cre-setup (first start — compiling WASM plugin)..."
    cd /app && bun x cre-setup
    touch "$SETUP_FLAG"
    echo "[entrypoint] cre-setup complete."
else
    echo "[entrypoint] cre-setup already done — skipping."
fi

echo "[entrypoint] Oracle container ready. Use: docker exec aegis-oracle-node bash"
exec tail -f /dev/null
