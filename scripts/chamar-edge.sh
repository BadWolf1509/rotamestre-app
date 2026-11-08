#!/usr/bin/env bash
# Chama uma Edge Function agendada (workflow expire-routes.yml) e falha se a
# resposta não for sucesso. Sucesso = HTTP 200 E `.success == true`.
#
# O repositório é público e o log de Actions é legível por qualquer pessoa: o
# corpo da resposta NÃO vai ao log. Só os contadores pedidos (jq) e, em erro,
# o HTTP e o campo `error`.
#
# Uso: CRON_SECRET=... scripts/chamar-edge.sh <funcao> <filtro-jq-dos-contadores> [corpo-json]
#   ex.: scripts/chamar-edge.sh remind-routes '{routes_found, reminders_sent}' '{"urgency":"final"}'
#
# Teste local sem rede: EDGE_BASE_URL aponta outro host (o padrão é o do Supabase).

set -u

funcao="${1:?uso: chamar-edge.sh <funcao> <filtro-jq> [corpo-json]}"
filtro="${2:?uso: chamar-edge.sh <funcao> <filtro-jq> [corpo-json]}"
corpo="${3:-}"
base="${EDGE_BASE_URL:-https://xezslsyxjivunmhhyxtd.supabase.co/functions/v1}"
: "${CRON_SECRET:?CRON_SECRET ausente}"

resposta="$(mktemp)"
trap 'rm -f "$resposta"' EXIT

args=(-sS --max-time 60 -o "$resposta" -w '%{http_code}' -X POST "$base/$funcao"
  -H "x-cron-secret: $CRON_SECRET" -H 'Content-Type: application/json')
if [ -n "$corpo" ]; then
  args+=(-d "$corpo")
fi

# Timeout ou falha de rede: o curl devolve erro e o código vira 000.
http_code="$(curl "${args[@]}")" || http_code="000"

# Falha se o HTTP não for 200 OU se o corpo não trouxer success == true.
if [ "$http_code" != "200" ] || ! jq -e '.success == true' "$resposta" > /dev/null 2>&1; then
  echo "Erro: a função $funcao respondeu HTTP $http_code"
  # `.error` vem de fora e o log é público: limita o tamanho.
  { jq -r '.error // "sem campo error"' "$resposta" 2>/dev/null || echo "sem campo error"; } | head -c 300
  echo
  exit 1
fi

# Filtro inválido ou resposta ilegível: não imprime "OK" por cima de um erro.
if ! jq -c "$filtro" "$resposta"; then
  echo "Erro: a função $funcao respondeu sucesso, mas o filtro dos contadores falhou"
  exit 1
fi
echo "OK: $funcao"
