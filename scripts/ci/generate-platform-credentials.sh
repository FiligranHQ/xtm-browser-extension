#!/usr/bin/env bash
# The platforms under test are torn down with the CI job, so their admin
# credentials are generated per run (masked in logs) rather than committed.
set -euo pipefail

TOKEN="$(cat /proc/sys/kernel/random/uuid)"
KEY="$(openssl rand -base64 32)"
echo "::add-mask::$TOKEN"
echo "::add-mask::$KEY"
echo "TEST_ADMIN_TOKEN=$TOKEN" >> "$GITHUB_ENV"
echo "TEST_ENCRYPTION_KEY=$KEY" >> "$GITHUB_ENV"
