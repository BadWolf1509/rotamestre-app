#!/bin/bash

# =====================================================
# Script de Teste SMTP para Servidor VPS
# Rota Mestre - Configuração de Email
# =====================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir com cor
print_status() {
    echo -e "${2}${1}${NC}"
}

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

# =====================================================
# CONFIGURAÇÕES - PREENCHA COM SEUS DADOS
# =====================================================

SMTP_HOST="mail.rotamestre.tec.br"  # ou IP da VPS
SMTP_PORT="587"                      # 587 (TLS) ou 465 (SSL)
SMTP_USER="no-reply@rotamestre.tec.br"
SMTP_PASS="SUA_SENHA_AQUI"          # ⚠️ PREENCHER!
TEST_EMAIL="seu@email.com"           # Email para receber teste

# =====================================================
# TESTES
# =====================================================

print_header "🚀 INICIANDO TESTES DO SERVIDOR SMTP"

# Teste 1: Verificar conectividade
print_status "📡 Teste 1: Conectividade SMTP..." "$BLUE"

if nc -zv $SMTP_HOST $SMTP_PORT 2>&1 | grep -q "succeeded"; then
    print_status "✅ Porta $SMTP_PORT está acessível" "$GREEN"
else
    print_status "❌ Não foi possível conectar na porta $SMTP_PORT" "$RED"
    echo "   Verifique firewall e se o servidor SMTP está rodando"
    exit 1
fi

# Teste 2: Verificar DNS
print_header "🌐 Teste 2: Configuração DNS"

# MX Record
print_status "Verificando registro MX..." "$BLUE"
MX_RECORD=$(nslookup -type=mx rotamestre.tec.br 2>/dev/null | grep "mail exchanger" | head -1)
if [ ! -z "$MX_RECORD" ]; then
    print_status "✅ MX: $MX_RECORD" "$GREEN"
else
    print_status "⚠️  Registro MX não encontrado" "$YELLOW"
fi

# SPF Record
print_status "Verificando registro SPF..." "$BLUE"
SPF_RECORD=$(nslookup -type=txt rotamestre.tec.br 2>/dev/null | grep "spf1" | head -1)
if [ ! -z "$SPF_RECORD" ]; then
    print_status "✅ SPF configurado" "$GREEN"
else
    print_status "⚠️  Registro SPF não encontrado" "$YELLOW"
fi

# DKIM Record
print_status "Verificando registro DKIM..." "$BLUE"
DKIM_RECORD=$(nslookup -type=txt mail._domainkey.rotamestre.tec.br 2>/dev/null | grep "p=" | head -1)
if [ ! -z "$DKIM_RECORD" ]; then
    print_status "✅ DKIM configurado" "$GREEN"
else
    print_status "⚠️  Registro DKIM não encontrado" "$YELLOW"
fi

# DMARC Record
print_status "Verificando registro DMARC..." "$BLUE"
DMARC_RECORD=$(nslookup -type=txt _dmarc.rotamestre.tec.br 2>/dev/null | grep "DMARC" | head -1)
if [ ! -z "$DMARC_RECORD" ]; then
    print_status "✅ DMARC configurado" "$GREEN"
else
    print_status "⚠️  Registro DMARC não encontrado" "$YELLOW"
fi

# Teste 3: Enviar email de teste
print_header "📧 Teste 3: Envio de Email"

if command -v swaks &> /dev/null; then
    print_status "Enviando email de teste para $TEST_EMAIL..." "$BLUE"

    swaks --to "$TEST_EMAIL" \
          --from "$SMTP_USER" \
          --server "$SMTP_HOST:$SMTP_PORT" \
          --auth LOGIN \
          --auth-user "$SMTP_USER" \
          --auth-password "$SMTP_PASS" \
          --tls \
          --header "Subject: Teste SMTP - Rota Mestre" \
          --body "Este é um email de teste do servidor SMTP.\n\nSe você recebeu este email, a configuração está funcionando corretamente!\n\n---\nRota Mestre\nSistema de Gestão de Entregas" \
          2>&1 | tee /tmp/smtp_test.log

    if grep -q "250 OK" /tmp/smtp_test.log; then
        print_status "✅ Email enviado com sucesso!" "$GREEN"
        print_status "   Verifique a caixa de entrada de $TEST_EMAIL" "$GREEN"
    else
        print_status "❌ Falha ao enviar email" "$RED"
        echo "   Verifique os logs acima para detalhes"
    fi
else
    print_status "⚠️  swaks não instalado" "$YELLOW"
    echo "   Instale com: apt-get install swaks -y"

    # Tentar com mail
    if command -v mail &> /dev/null; then
        print_status "Tentando com comando 'mail'..." "$BLUE"
        echo "Teste de email do servidor SMTP" | mail -s "Teste SMTP - Rota Mestre" "$TEST_EMAIL"
        print_status "✅ Email enviado via comando 'mail'" "$GREEN"
    else
        print_status "❌ Nenhuma ferramenta de email disponível" "$RED"
    fi
fi

# Teste 4: Verificar logs do servidor (se tiver acesso SSH)
print_header "📝 Teste 4: Logs do Servidor"

print_status "Para verificar logs no servidor VPS, execute:" "$BLUE"
echo ""
echo "  # Postfix:"
echo "  tail -f /var/log/mail.log"
echo ""
echo "  # Exim:"
echo "  tail -f /var/log/exim4/mainlog"
echo ""

# Teste 5: Verificar blacklist
print_header "🛡️  Teste 5: Verificação de Blacklist"

print_status "Verificando se o IP está em blacklist..." "$BLUE"
echo ""
echo "  Acesse manualmente:"
echo "  https://multirbl.valli.org/lookup/$SMTP_HOST.html"
echo ""

# Resumo Final
print_header "📊 RESUMO DOS TESTES"

echo ""
echo "Configurações utilizadas:"
echo "  SMTP Host: $SMTP_HOST"
echo "  SMTP Port: $SMTP_PORT"
echo "  SMTP User: $SMTP_USER"
echo "  Email Teste: $TEST_EMAIL"
echo ""

print_status "🔧 Próximos passos:" "$BLUE"
echo ""
echo "1. Se os testes passaram:"
echo "   ✅ Configure no Supabase (docs/supabase-email-vps.md)"
echo "   ✅ Adicione os templates HTML"
echo "   ✅ Teste na aplicação"
echo ""
echo "2. Se algum teste falhou:"
echo "   ❌ Verifique firewall da VPS"
echo "   ❌ Confirme que SMTP está rodando"
echo "   ❌ Valide credenciais"
echo "   ❌ Configure DNS (SPF, DKIM, DMARC)"
echo ""

print_status "📖 Documentação completa: docs/supabase-email-vps.md" "$GREEN"
echo ""
