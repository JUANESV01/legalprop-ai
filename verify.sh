#!/usr/bin/env bash
set -e

# Script wrapper de verificación automatizada LegalProp AI
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${SCRIPT_DIR}/verify_legalprop.py"
