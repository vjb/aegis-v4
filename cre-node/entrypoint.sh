#!/bin/bash
set -e

# Aegis CRE Oracle — Container Entrypoint
# On first start: runs bun x cre-setup (compiles the Javy WASM plugin).
# Subsequent starts: skips setup (flag file present).
#
# Secrets are automatic: docker-compose passes .env as env vars,
# secrets.yaml maps CRE secret IDs → env var names,
# and the CRE framework resolves them at runtime.
# No manual 'cre secrets' command needed for local simulation.

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
