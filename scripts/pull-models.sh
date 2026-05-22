#!/usr/bin/env bash
# Parallel Ollama model downloader
# Downloads up to MAX_PARALLEL models at the same time, smallest first.
# Already-present models are skipped instantly.

set -uo pipefail

MAX_PARALLEL=4   # simultaneous pulls (tune down if bandwidth is limited)

# ── Model list — ordered smallest→largest so useful models land first ─────────
MODELS=(
  # Embeddings (tiny — always useful)
  "nomic-embed-text"          # 274 MB  — RAG embeddings
  "mxbai-embed-large"         # 670 MB  — higher-quality embeddings

  # Tiny chat / code
  "smollm2:360m"              # 360 MB  — ultra-fast chat
  "qwen2.5:1.5b"              # 994 MB  — strong small model
  "tinyllama"                 # 637 MB  — fallback tiny
  "llama3.2:1b"               # 1.3 GB  — primary chat
  "gemma:2b"                  # 1.7 GB  — Google small model

  # Vision
  "moondream"                 # 1.8 GB  — lightweight vision

  # Medium (need ~5 GB RAM to run, fine to store)
  "phi3:mini"                 # 2.2 GB  — code / reasoning
  "phi3.5"                    # 2.2 GB  — phi-3.5
  "llama3.2:3b"               # 2.0 GB  — llama 3.2 medium

  # Full 7B models (need ~8 GB RAM, stored for later)
  "mistral"                   # 4.1 GB  — general purpose
  "codellama"                 # 3.8 GB  — code
  "llama3:8b"                 # 4.7 GB  — llama 3 8B
  "llava"                     # 4.7 GB  — full vision
  "gemma2:9b"                 # 5.4 GB  — Google large
  "starcoder2"                # 3.9 GB  — code
)

# ── Helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
LOG_DIR="/tmp/ollama-pull-logs"; mkdir -p "$LOG_DIR"

already_pulled() {
  ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$1"
}

pull_model() {
  local model="$1"
  local log="$LOG_DIR/${model//[:\/]/_}.log"
  local start=$SECONDS

  if already_pulled "$model"; then
    echo -e "  ${CYAN}SKIP${NC}  $model (already downloaded)"
    return 0
  fi

  echo -e "  ${YELLOW}START${NC} $model"
  if ollama pull "$model" > "$log" 2>&1; then
    local elapsed=$(( SECONDS - start ))
    echo -e "  ${GREEN}DONE${NC}  $model  (${elapsed}s)"
  else
    echo -e "  ${RED}FAIL${NC}  $model — see $log"
    return 1
  fi
}

export -f pull_model already_pulled
export RED GREEN YELLOW CYAN NC LOG_DIR

# ── Wait for Ollama ───────────────────────────────────────────────────────────
echo -e "${CYAN}=== AuraAI Parallel Model Downloader ===${NC}"
echo "Waiting for Ollama server…"
until curl -sf http://localhost:11434/ > /dev/null 2>&1; do sleep 1; done
echo -e "${GREEN}Ollama ready.${NC}"
echo ""

TOTAL=${#MODELS[@]}
echo "Models to ensure: $TOTAL  |  Parallel workers: $MAX_PARALLEL"
echo "─────────────────────────────────────────────"

# ── Parallel pull using a job-slot semaphore ──────────────────────────────────
declare -a PIDS=()
SLOT=0

for MODEL in "${MODELS[@]}"; do
  # Wait if we've hit the concurrency limit
  if (( ${#PIDS[@]} >= MAX_PARALLEL )); then
    wait "${PIDS[0]}" 2>/dev/null || true
    PIDS=("${PIDS[@]:1}")
  fi

  pull_model "$MODEL" &
  PIDS+=($!)
  (( SLOT++ )) || true
done

# Wait for remaining jobs
for PID in "${PIDS[@]}"; do
  wait "$PID" 2>/dev/null || true
done

echo ""
echo "─────────────────────────────────────────────"
echo -e "${GREEN}=== All pulls finished. Installed models: ===${NC}"
ollama list
