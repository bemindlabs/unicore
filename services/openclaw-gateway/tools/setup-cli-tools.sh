#!/bin/sh
# Setup AI Coding CLI tools inside the OpenClaw container.
# Creates wrapper scripts in /usr/local/bin that point to mounted host tools.

set -e

TOOLS_DIR=/host-tools

# Claude Code — standalone ELF binary
if [ -d "$TOOLS_DIR/claude" ]; then
  # Find the latest version binary
  CLAUDE_BIN=$(ls -t "$TOOLS_DIR/claude/"* 2>/dev/null | head -1)
  if [ -n "$CLAUDE_BIN" ] && [ -x "$CLAUDE_BIN" ]; then
    ln -sf "$CLAUDE_BIN" /usr/local/bin/claude
    echo "[cli-tools] claude → $CLAUDE_BIN"
  fi
fi

# Gemini CLI — Node.js module
if [ -d "$TOOLS_DIR/gemini-cli/dist" ]; then
  cat > /usr/local/bin/gemini <<'WRAPPER'
#!/bin/sh
exec node --no-warnings=DEP0040 /host-tools/gemini-cli/dist/index.js "$@"
WRAPPER
  chmod +x /usr/local/bin/gemini
  echo "[cli-tools] gemini → /host-tools/gemini-cli/dist/index.js"
fi

# Codex CLI — Node.js module
if [ -d "$TOOLS_DIR/codex/bin" ]; then
  cat > /usr/local/bin/codex <<'WRAPPER'
#!/bin/sh
exec node /host-tools/codex/bin/codex.js "$@"
WRAPPER
  chmod +x /usr/local/bin/codex
  echo "[cli-tools] codex → /host-tools/codex/bin/codex.js"
fi

echo "[cli-tools] setup complete"
