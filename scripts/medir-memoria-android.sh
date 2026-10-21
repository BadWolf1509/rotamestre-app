#!/usr/bin/env bash
# Série de memória do app Android via `dumpsys meminfo` (seção App Summary).
#
# Uso: bash scripts/medir-memoria-android.sh <rotulo> [duracao_s=1800] [intervalo_s=60]
#
# Imprime CSV em stdout e grava o mesmo em $TMPDIR/memoria-<rotulo>-<data>.csv.
# t_s conta a partir do disparo do script. Sai com código 2 se o pid do app
# mudar no meio da série (processo reiniciou: a série não vale) e com 1 se o
# app não estiver rodando.
#
# Roteiro de comparação e leitura: docs/superpowers/plans/2026-10-20-upgrade-expo-sdk-57.md
# (Tasks 1 e 5). ADB pode ser apontado por $ADB; padrão é o adb do PATH.

set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash: não reescrever caminhos do aparelho

PACOTE=br.tec.rotamestre.app
ROTULO=${1:?uso: medir-memoria-android.sh <rotulo> [duracao_s] [intervalo_s]}
DURACAO=${2:-1800}
INTERVALO=${3:-60}
ADB=${ADB:-adb}
SAIDA="${TMPDIR:-/tmp}/memoria-${ROTULO}-$(date +%Y%m%d-%H%M%S).csv"

pid_atual() { "$ADB" shell pidof "$PACOTE" | tr -d '\r'; }

# Lê o App Summary e imprime: pss rss java native graphics code swap
amostra() {
  "$ADB" shell dumpsys meminfo "$PACOTE" | tr -d '\r' | awk '
    /App Summary/ { dentro = 1 }
    !dentro { next }
    /Java Heap:/   { java = $3 }
    /Native Heap:/ { native = $3 }
    /Graphics:/    { graphics = $2 }
    /^ *Code:/     { code = $2 }
    /TOTAL PSS:/ {
      for (i = 1; i <= NF; i++) {
        if ($i == "PSS:" && $(i-1) == "TOTAL" && $(i-2) != "SWAP") pss = $(i+1)
        if ($i == "RSS:") rss = $(i+1)
        if ($i == "PSS:" && $(i-1) == "SWAP") swap = $(i+1)
      }
      print pss, rss, java, native, graphics, code, swap
      exit
    }'
}

PID0=$(pid_atual)
if [ -z "$PID0" ]; then
  echo "app $PACOTE não está rodando" >&2
  exit 1
fi

echo "t_s,pid,total_pss_kb,total_rss_kb,java_heap_pss_kb,native_heap_pss_kb,graphics_pss_kb,code_pss_kb,total_swap_pss_kb" | tee "$SAIDA"

INICIO=$(date +%s)
while :; do
  T=$(( $(date +%s) - INICIO ))
  PID=$(pid_atual)
  if [ "$PID" != "$PID0" ]; then
    echo "pid mudou ($PID0 -> ${PID:-nenhum}) em t=${T}s: série inválida" >&2
    exit 2
  fi
  read -r PSS RSS JAVA NATIVE GRAPHICS CODE SWAP <<< "$(amostra)"
  if [ -z "${PSS:-}" ] || [ "$PSS" = "0" ]; then
    echo "parser não leu TOTAL PSS em t=${T}s" >&2
    exit 3
  fi
  echo "$T,$PID,$PSS,$RSS,$JAVA,$NATIVE,$GRAPHICS,$CODE,$SWAP" | tee -a "$SAIDA"
  [ "$T" -ge "$DURACAO" ] && break
  sleep "$INTERVALO"
done

echo "gravado em $SAIDA" >&2
