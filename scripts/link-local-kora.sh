#!/bin/bash
# Link local Kora framework packages for development.
# Run this when you want to test changes from ../Kora before publishing.
# Run `pnpm install` to revert back to npm registry versions.

KORA_ROOT="${KORA_ROOT:-../Kora}"

if [ ! -d "$KORA_ROOT/packages" ]; then
  echo "Error: Kora repo not found at $KORA_ROOT"
  echo "Set KORA_ROOT to the correct path and retry."
  exit 1
fi

echo "Linking local Kora packages from $KORA_ROOT..."

pnpm link "$KORA_ROOT/packages/auth"
pnpm link "$KORA_ROOT/packages/core"
pnpm link "$KORA_ROOT/packages/react"
pnpm link "$KORA_ROOT/packages/server"
pnpm link "$KORA_ROOT/packages/store"
pnpm link "$KORA_ROOT/packages/sync"
pnpm link "$KORA_ROOT/packages/merge"
pnpm link "$KORA_ROOT/packages/cli"
pnpm link "$KORA_ROOT/kora"

echo "Done! Local Kora packages linked."
echo "Run 'pnpm install' to revert to npm registry versions."
