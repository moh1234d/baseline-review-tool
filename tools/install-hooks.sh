#!/bin/sh
# Installs the publish guard (tools/pre-push) into this clone's git hooks.
cd "$(dirname "$0")/.." && cp tools/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push && echo "pre-push guard installed"
