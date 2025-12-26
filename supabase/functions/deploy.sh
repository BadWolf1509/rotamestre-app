#!/bin/bash

# Script de deploy das Edge Functions do RotaMestre
# Uso: ./deploy.sh [função] ou ./deploy.sh all

set -e

echo "🚀 Deploy de Edge Functions - RotaMestre"
echo "=========================================="

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

# Verificar se está logado
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Não autenticado no Supabase${NC}"
    echo "Execute: supabase login"
    exit 1
fi

# Função para deploy individual
deploy_function() {
    local func_name=$1
    local flags=$2

    echo -e "\n${BLUE}📦 Deploying ${func_name}...${NC}"

    if supabase functions deploy "$func_name" $flags; then
        echo -e "${GREEN}✅ ${func_name} deployed com sucesso!${NC}"
    else
        echo -e "${RED}❌ Erro ao fazer deploy de ${func_name}${NC}"
        exit 1
    fi
}

# Deploy baseado no argumento
case "${1:-all}" in
    google-directions)
        deploy_function "google-directions" "--no-verify-jwt"
        ;;

    google-distance-matrix)
        deploy_function "google-distance-matrix" "--no-verify-jwt"
        ;;

    criar-motorista)
        deploy_function "criar-motorista" ""
        ;;

    google-places-autocomplete)
        deploy_function "google-places-autocomplete" "--no-verify-jwt"
        ;;

    google-place-details)
        deploy_function "google-place-details" "--no-verify-jwt"
        ;;

    all)
        echo -e "${BLUE}📦 Deploying todas as funções...${NC}\n"
        deploy_function "google-directions" "--no-verify-jwt"
        deploy_function "google-distance-matrix" "--no-verify-jwt"
        deploy_function "google-places-autocomplete" "--no-verify-jwt"
        deploy_function "google-place-details" "--no-verify-jwt"
        deploy_function "criar-motorista" ""

        echo -e "\n${GREEN}✅ Todas as funções foram deployed com sucesso!${NC}"
        ;;

    *)
        echo -e "${RED}❌ Função desconhecida: $1${NC}"
        echo ""
        echo "Uso: ./deploy.sh [função]"
        echo ""
        echo "Funções disponíveis:"
        echo "  - google-directions"
        echo "  - google-distance-matrix"
        echo "  - google-places-autocomplete"
        echo "  - google-place-details"
        echo "  - criar-motorista"
        echo "  - all (default)"
        exit 1
        ;;
esac

# Listar funções deployed
echo -e "\n${BLUE}📋 Funções deployed:${NC}"
supabase functions list

echo -e "\n${GREEN}🎉 Deploy concluído!${NC}"
