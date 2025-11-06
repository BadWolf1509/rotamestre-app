# 🚀 Quick Start: Configurar Email Profissional

## Resumo Executivo
Configure emails profissionais `no-reply@rotamestre.tec.br` em **30 minutos** usando Resend (gratuito).

---

## ⚡ Passo a Passo Rápido

### 1️⃣ Criar Conta Resend (5 min)
```
1. Acesse: https://resend.com
2. Clique em "Sign Up"
3. Use seu email profissional
4. Confirme email de verificação
```

### 2️⃣ Adicionar Domínio (2 min)
```
1. Login no Resend
2. Settings → Domains → Add Domain
3. Digite: rotamestre.tec.br
4. Clique em "Add Domain"
```

### 3️⃣ Configurar DNS (10 min)
Resend vai mostrar 4 registros DNS. Copie e adicione no seu provedor:

**Exemplo de configuração:**
```
┌──────┬─────────────────────┬──────────────────────────────────────┐
│ Tipo │ Nome                │ Valor                                │
├──────┼─────────────────────┼──────────────────────────────────────┤
│ TXT  │ @                   │ resend-verify=abc123xyz              │
│ MX   │ @                   │ feedback-smtp.us-east-1.amazonses... │
│ TXT  │ _dmarc              │ v=DMARC1; p=none;                   │
│ TXT  │ resend._domainkey   │ k=rsa; p=MIGfMA0GCS...              │
└──────┴─────────────────────┴──────────────────────────────────────┘
```

**Como adicionar (exemplo Hostinger):**
1. Login no painel do domínio
2. Vá em DNS/Zona DNS
3. Clique em "Adicionar Registro"
4. Cole os valores de cada registro
5. Salve

**Verificar propagação:**
```bash
# Aguarde 5-15 minutos, depois teste:
nslookup -type=TXT rotamestre.tec.br
```

### 4️⃣ Verificar Domínio (5 min)
```
1. Volte ao Resend
2. Clique em "Verify Domain"
3. Aguarde status: ✅ Verified
4. Se não verificar, aguarde mais 10-20min
```

### 5️⃣ Criar API Key (2 min)
```
1. No Resend: API Keys → Create API Key
2. Nome: "Supabase Auth"
3. Permissão: "Sending access"
4. Copie a chave: re_XXXXXXXXXX
5. IMPORTANTE: Salve em local seguro!
```

### 6️⃣ Configurar Supabase (5 min)

**Passo 1: SMTP Settings**
```
1. https://app.supabase.com → Seu Projeto
2. Authentication → SMTP Settings
3. Enable Custom SMTP: ✅ ON
```

**Passo 2: Preencher dados:**
```
SMTP Host:     smtp.resend.com
SMTP Port:     587
SMTP Username: resend
SMTP Password: re_XXXXXXXXXX (API Key do Resend)
Sender Email:  no-reply@rotamestre.tec.br
Sender Name:   Rota Mestre
```

**Passo 3: Salvar**
```
Clique em "Save"
```

### 7️⃣ Configurar Templates (5 min)

**No Supabase:**
```
Authentication → Email Templates
```

**Template 1: Reset Password**
```html
Cole o template "TEMPLATE 1" do arquivo email-templates.html
```

**Template 2: Confirm Signup**
```html
Cole o template "TEMPLATE 2" do arquivo email-templates.html
```

**Template 3: Magic Link**
```html
Cole o template "TEMPLATE 3" do arquivo email-templates.html
```

### 8️⃣ Testar (3 min)

**Teste 1: Via Web**
```
1. Abra: http://localhost:8083/auth/forgot-password
2. Digite seu email
3. Clique em "Enviar"
4. Verifique email (inbox ou spam)
```

**Teste 2: Via Resend Dashboard**
```
1. Resend → Logs → Recent emails
2. Veja se o email aparece
3. Status deve ser: "Delivered"
```

---

## ✅ Checklist de Verificação

```
[✓] Conta Resend criada
[✓] Domínio rotamestre.tec.br adicionado
[✓] 4 registros DNS configurados
[✓] DNS propagado (aguardar 15min)
[✓] Domínio verificado no Resend
[✓] API Key criada e salva
[✓] SMTP configurado no Supabase
[✓] Templates customizados
[✓] Teste enviado
[✓] Email recebido com sucesso
```

---

## 🔧 Troubleshooting Rápido

### Email não chega?
```bash
1. Verifique spam/lixo eletrônico
2. Confirme DNS: https://dnschecker.org
3. Veja logs: Resend → Logs
4. Teste direto no Resend primeiro
```

### Erro "Invalid credentials"?
```bash
1. Username é SEMPRE "resend"
2. Password é a API Key completa
3. Recrie API Key se necessário
```

### DNS não verifica?
```bash
1. Aguarde até 48h (geralmente 15-30min)
2. Use: nslookup -type=TXT rotamestre.tec.br
3. Verifique se copiou valores corretamente
```

---

## 📊 Limites do Plano Gratuito

```
Resend Free:
✓ 100 emails/dia
✓ 3.000 emails/mês
✓ Domínio customizado
✓ Templates ilimitados
✓ Analytics básico

Suficiente para:
✓ Testes e desenvolvimento
✓ Pequenas empresas (até 30 usuários)
✓ MVP e validação
```

---

## 🎯 Próximos Passos (Opcional)

### 1. Criar página de Reset Password
```bash
# Arquivo: app/auth/reset-password.tsx
# Tela para usuário digitar nova senha
```

### 2. Configurar Deep Linking
```bash
# Para abrir app ao clicar no email
# Ver: docs/supabase-email-setup.md
```

### 3. Analytics de Email
```bash
# Monitorar:
- Taxa de abertura
- Cliques em links
- Bounces/erros
```

### 4. A/B Testing
```bash
# Testar diferentes:
- Assuntos
- Layouts
- CTAs
```

---

## 💡 Dicas Pro

1. **Use ambiente de testes primeiro**
   - Configure com email pessoal
   - Teste todos os cenários
   - Só depois use produção

2. **Monitore os logs**
   - Resend tem excelente dashboard
   - Veja bounces e erros
   - Ajuste templates conforme necessário

3. **Cuide da reputação do domínio**
   - Não envie spam
   - Use rate limiting
   - Valide emails antes de enviar

4. **Backup das configurações**
   - Salve API Keys
   - Documente DNS records
   - Guarde templates

---

## 📞 Suporte

- **Resend Docs**: https://resend.com/docs
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **DNS Help**: https://dnschecker.org

---

## 🎉 Pronto!

Seu sistema de emails profissionais está configurado!

Agora os usuários receberão emails de `no-reply@rotamestre.tec.br` com design profissional e alta entregabilidade.
