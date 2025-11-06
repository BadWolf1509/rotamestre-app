# Configuração de Email Profissional no Supabase

## Objetivo
Configurar o Supabase para enviar emails de recuperação de senha e autenticação usando o domínio profissional `no-reply@rotamestre.tec.br`.

## Pré-requisitos
- Acesso ao painel do Supabase (https://app.supabase.com)
- Acesso ao DNS do domínio `rotamestre.tec.br`
- Conta configurada em um provedor SMTP (Resend, SendGrid, AWS SES, etc.)

---

## Opção 1: Usar Resend (Recomendado - Mais Simples)

### Passo 1: Criar Conta no Resend
1. Acesse https://resend.com
2. Crie uma conta gratuita (100 emails/dia grátis)
3. Verifique seu email

### Passo 2: Adicionar Domínio no Resend
1. No painel Resend, vá em **Settings** → **Domains**
2. Clique em **Add Domain**
3. Digite: `rotamestre.tec.br`
4. Copie os registros DNS fornecidos:

```
Tipo: TXT
Nome: @
Valor: resend-verify=XXXXXXXX

Tipo: MX
Nome: @
Prioridade: 10
Valor: feedback-smtp.us-east-1.amazonses.com

Tipo: TXT
Nome: _dmarc
Valor: v=DMARC1; p=none;

Tipo: TXT
Nome: resend._domainkey
Valor: (chave DKIM fornecida)
```

### Passo 3: Configurar DNS
1. Acesse o painel DNS do seu provedor (Hostinger, Cloudflare, etc.)
2. Adicione todos os registros DNS fornecidos pelo Resend
3. Aguarde a propagação (pode levar até 48h, geralmente 15-30min)

### Passo 4: Verificar Domínio
1. Volte ao Resend
2. Clique em **Verify Domain**
3. Aguarde confirmação (status: ✓ Verified)

### Passo 5: Criar API Key no Resend
1. No Resend, vá em **API Keys**
2. Clique em **Create API Key**
3. Nome: `Supabase Auth`
4. Permissão: **Sending access**
5. Copie a API Key: `re_XXXXXXXXXXXXXXXXX`

### Passo 6: Configurar Supabase
1. Acesse https://app.supabase.com
2. Selecione seu projeto **Rota Mestre**
3. Vá em **Authentication** → **Email Templates**
4. Vá em **Settings** → **Auth** → **SMTP Settings**

**Configurações SMTP:**
```
Enable Custom SMTP: ON

SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP Username: resend
SMTP Password: (Cole a API Key do Resend aqui)
Sender Email: no-reply@rotamestre.tec.br
Sender Name: Rota Mestre
```

### Passo 7: Configurar Templates de Email
1. Ainda em **Authentication** → **Email Templates**
2. Customize os templates:

**Confirm Signup:**
```html
<h2>Confirme seu email</h2>
<p>Olá,</p>
<p>Clique no link abaixo para confirmar seu cadastro no Rota Mestre:</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar Email</a></p>
<p>Se você não se cadastrou, ignore este email.</p>
<p>Atenciosamente,<br>Equipe Rota Mestre</p>
```

**Reset Password (Recuperar Senha):**
```html
<h2>Recuperação de Senha</h2>
<p>Olá,</p>
<p>Você solicitou a recuperação de senha no Rota Mestre.</p>
<p>Clique no link abaixo para redefinir sua senha:</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir Senha</a></p>
<p>Este link expira em 1 hora.</p>
<p>Se você não solicitou esta recuperação, ignore este email.</p>
<p>Atenciosamente,<br>Equipe Rota Mestre</p>
```

**Magic Link:**
```html
<h2>Link de Acesso</h2>
<p>Olá,</p>
<p>Clique no link abaixo para acessar o Rota Mestre:</p>
<p><a href="{{ .ConfirmationURL }}">Acessar Plataforma</a></p>
<p>Este link expira em 1 hora.</p>
<p>Atenciosamente,<br>Equipe Rota Mestre</p>
```

### Passo 8: Testar Envio
1. Use a tela de recuperação de senha: http://localhost:8083/auth/forgot-password
2. Digite um email válido cadastrado
3. Verifique se o email chegou
4. Confira spam/lixo eletrônico caso não apareça na caixa de entrada

---

## Opção 2: Usar SendGrid

### Passo 1: Criar Conta SendGrid
1. Acesse https://sendgrid.com
2. Crie conta gratuita (100 emails/dia)

### Passo 2: Verificar Domínio
1. Settings → Sender Authentication → Authenticate Your Domain
2. Selecione provedor DNS
3. Digite: `rotamestre.tec.br`
4. Copie registros DNS (CNAME e TXT)
5. Adicione no seu provedor DNS
6. Aguarde verificação

### Passo 3: Criar API Key
1. Settings → API Keys → Create API Key
2. Nome: `Supabase Auth`
3. Permissão: **Full Access** ou **Mail Send**
4. Copie: `SG.XXXXXXXXXX`

### Passo 4: Configurar Supabase
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP Username: apikey
SMTP Password: (Cole API Key do SendGrid)
Sender Email: no-reply@rotamestre.tec.br
Sender Name: Rota Mestre
```

---

## Opção 3: Usar Gmail SMTP (Apenas Testes - Não Recomendado Produção)

⚠️ **Não recomendado para produção!** Limite de 500 emails/dia.

### Configuração:
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP Username: seu-email@gmail.com
SMTP Password: (Senha de app - não a senha normal!)
Sender Email: seu-email@gmail.com
Sender Name: Rota Mestre
```

### Como criar senha de app:
1. Acesse https://myaccount.google.com/security
2. Ative verificação em 2 etapas
3. Vá em "Senhas de app"
4. Gere senha para "Email"
5. Use essa senha de 16 caracteres no Supabase

---

## Configuração DNS Detalhada (Resend)

### Exemplo de Configuração Completa:

| Tipo | Nome/Host | Valor | TTL |
|------|-----------|-------|-----|
| TXT | @ | resend-verify=abc123xyz | 3600 |
| MX | @ | feedback-smtp.us-east-1.amazonses.com | 3600 |
| TXT | _dmarc | v=DMARC1; p=none; | 3600 |
| TXT | resend._domainkey | k=rsa; p=MIGfMA0GCS... | 3600 |

---

## Configuração do Redirect URL (Deep Link)

Para que o link do email funcione corretamente com o app mobile:

### No Supabase:
1. Authentication → URL Configuration
2. Site URL: `https://app.rotamestre.tec.br`
3. Redirect URLs:
   - `rotamestre://reset-password`
   - `rotamestre://confirm`
   - `exp://192.168.1.x:8081` (para dev)
   - `http://localhost:8083/auth/reset-password` (para web)

### No arquivo `src/lib/auth.ts`:
Já está configurado:
```typescript
async resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'rotamestre://reset-password',
  });
  if (error) throw error;
}
```

---

## Troubleshooting

### Email não chega:
1. ✓ Verifique spam/lixo eletrônico
2. ✓ Confirme que o domínio está verificado no Resend
3. ✓ Verifique logs no Resend (Logs → Recent emails)
4. ✓ Teste envio direto pelo Resend primeiro
5. ✓ Confirme configurações SMTP no Supabase

### Erro "Invalid SMTP credentials":
1. ✓ Verifique se copiou API Key completa
2. ✓ No Resend, username é sempre `resend`
3. ✓ Senha é a API Key (re_XXXXX)

### Email vai para spam:
1. ✓ Configure SPF, DKIM e DMARC corretamente
2. ✓ Aguarde reputação do domínio melhorar (alguns dias)
3. ✓ Evite palavras como "grátis", "urgente" no assunto
4. ✓ Use texto simples além do HTML

### DNS não propaga:
1. ✓ Aguarde até 48h (normalmente 15-30min)
2. ✓ Use ferramentas: https://dnschecker.org
3. ✓ Verifique se registros foram adicionados corretamente
4. ✓ Limpe cache DNS local: `ipconfig /flushdns` (Windows)

---

## Checklist Final

- [ ] Conta criada no Resend/SendGrid
- [ ] Domínio `rotamestre.tec.br` adicionado
- [ ] Registros DNS configurados (SPF, DKIM, DMARC)
- [ ] Domínio verificado (status: Verified)
- [ ] API Key criada
- [ ] SMTP configurado no Supabase
- [ ] Templates de email customizados
- [ ] Redirect URLs configuradas
- [ ] Teste de envio realizado
- [ ] Email recebido com sucesso

---

## Próximos Passos

1. Criar tela de reset password no app (`app/auth/reset-password.tsx`)
2. Configurar deep linking para abrir app quando clicar no email
3. Adicionar analytics para rastrear emails enviados
4. Configurar rate limiting para evitar spam

---

## Custos Estimados

### Resend:
- **Gratuito**: 100 emails/dia, 3.000/mês
- **Pro**: $20/mês - 50.000 emails/mês
- **Enterprise**: Custom pricing

### SendGrid:
- **Gratuito**: 100 emails/dia
- **Essentials**: $19.95/mês - 50.000 emails/mês
- **Pro**: $89.95/mês - 100.000 emails/mês

**Recomendação**: Comece com plano gratuito do Resend. É mais moderno, simples e tem melhor deliverability.

---

## Recursos Úteis

- [Documentação Resend](https://resend.com/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [DNS Checker](https://dnschecker.org)
- [Email Template Tester](https://www.mail-tester.com)
