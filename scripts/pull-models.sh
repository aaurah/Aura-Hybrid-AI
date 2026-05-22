#!/usr/bin/env bash
set -euo pipefail

MODELS=(
  "moondream"
  "mxbai-embed-large"
  "mistral"
  "codellama"
  "starcoder2"
  "gemma2:9b"
  "llava"
)

echo "=== AuraAI Model Downloader ==="
echo "Waiting for Ollama server..."
until curl -sf http://localhost:11434/ > /dev/null 2>&1; do sleep 2; done
echo "Ollama is ready."
echo ""

TOTAL=${#MODELS[@]}
DONE=0

for MODEL in "${MODELS[@]}"; do
  echo "[$((DONE+1))/$TOTAL] Pulling $MODEL ..."
  if ollama pull "$MODEL"; then
    echo "  ✓ $MODEL done"
  else
    echo "  ✗ $MODEL failed — continuing"
  fi
  DONE=$((DONE+1))
  echo ""
done

echo "=== All done. Models available: ==="
ollama list
