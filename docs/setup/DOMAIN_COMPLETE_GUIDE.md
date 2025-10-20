# 🌐 Guia Completo de Configuração de Domínios - RotaMestre

**Última atualização:** 2025-10-20
**Status:** ✅ Implementado e funcionando

---

## 📊 Visão Geral da Arquitetura

### Estrutura de Domínios

```
rotamestre.tec.br           → Redirect 301 permanente
  └─ https://app.rotamestre.tec.br

app.rotamestre.tec.br       → Aplicação Web (PWA) ✅ PRINCIPAL
  ├─ /                      → Tela inicial
  ├─ /auth/login           → Login
  ├─ /auth/register        → Cadastro
  ├─ /gestor/dashboard     → Dashboard gestor
  ├─ /motorista/rota       → Rota motorista
  └─ ...

painel.rotamestre.tec.br    → Backoffice (futuro)
docs.rotamestre.tec.br      → Documentação (futuro)
api.rotamestre.tec.br       → Proxy para Supabase
```

### Status Atual dos Domínios

| Domínio | Tipo | Destino | Status | Uso |
|---------|------|---------|--------|-----|
| rotamestre.tec.br | A | 216.198.79.1 | ✅ Ativo | Redirect 301 |
| www.rotamestre.tec.br | CNAME | 3a288de4d433bd70.vercel-dns-017.com. | ✅ Ativo | Redirect 301 |
| **app.rotamestre.tec.br** | CNAME | cname.vercel-dns.com. | ✅ Ativo | **App PWA** |
| painel.rotamestre.tec.br | CNAME | cname.vercel-dns.com. | 🟡 Futuro | Backoffice |
| docs.rotamestre.tec.br | CNAME | cname.vercel-dns.com. | 🟡 Futuro | Docs |
| api.rotamestre.tec.br | CNAME | cname.vercel-dns.com. | ✅ Ativo | Supabase |

---

## 🚀 Guia de Implementação (Passo a Passo)

### 1️⃣ Adicionar app.rotamestre.tec.br no Vercel

**Dashboard Vercel:**
```
https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/domains
```

**Ações:**
1. Clique em **"Add Domain"**
2. Digite: `app.rotamestre.tec.br`
3. Clique em **"Add"**
4. Aguarde validação DNS (1-5 minutos)

**DNS Esperado:**
```dns
app.rotamestre.tec.br.    300    IN    CNAME    cname.vercel-dns.com.
```

---

### 2️⃣ Configurar Redirect do Domínio Principal

O domínio `rotamestre.tec.br` já está configurado no **vercel.json** para redirecionar automaticamente:

```json
{
  "redirects": [
    {
      "source": "/",
      "has": [{ "type": "host", "value": "rotamestre.tec.br" }],
      "destination": "https://app.rotamestre.tec.br",
      "permanent": true
    }
  ]
}
```

---

### 3️⃣ Fazer Deploy

```bash
# Opção 1: Via Git (auto-deploy)
git add .
git commit -m "feat: configurar domínios"
git push origin main

# Opção 2: Via CLI Vercel
vercel --prod

# Opção 3: Forçar rebuild
vercel --prod --force
```

---

### 4️⃣ Validar Configuração

#### ✅ DNS Propagado
```bash
# Verificar CNAME de app.rotamestre.tec.br
nslookup app.rotamestre.tec.br

# Ou usando dig (mais detalhado)
dig app.rotamestre.tec.br CNAME
```

**Resultado esperado:**
```
app.rotamestre.tec.br.    300    IN    CNAME    cname.vercel-dns.com.
```

#### ✅ Redirect Funcionando
```bash
# Testar redirect de rotamestre.tec.br
curl -I https://rotamestre.tec.br
```

**Resultado esperado:**
```
HTTP/2 301
location: https://app.rotamestre.tec.br
```

#### ✅ SSL Ativo
```bash
# Verificar certificado SSL
curl -I https://app.rotamestre.tec.br
```

**Resultado esperado:**
```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
```

#### ✅ Aplicação Carregando
```bash
# Testar página principal
curl https://app.rotamestre.tec.br | grep -i "RotaMestre"
```

---

## 🎯 Comportamento Final

### Acessos ao Domínio Principal
```
https://rotamestre.tec.br
  └─ 301 Redirect → https://app.rotamestre.tec.br

http://rotamestre.tec.br
  └─ 301 Redirect → https://app.rotamestre.tec.br

https://www.rotamestre.tec.br
  └─ 301 Redirect → https://app.rotamestre.tec.br
```

### Acessos ao App
```
https://app.rotamestre.tec.br
  └─ 200 OK → Aplicação carrega

https://app.rotamestre.tec.br/auth/login
  └─ 200 OK → Tela de login

https://app.rotamestre.tec.br/gestor/dashboard
  └─ 200 OK → Dashboard (se autenticado)
```

---

## 📋 Configuração DNS Completa

### Domínio Principal - rotamestre.tec.br

```dns
; A Record (IP Vercel)
rotamestre.tec.br.           300   IN   A      216.198.79.1

; CNAME para www (redirect específico)
www.rotamestre.tec.br.       300   IN   CNAME  3a288de4d433bd70.vercel-dns-017.com.
```

### App Web - app.rotamestre.tec.br

```dns
; CNAME para Vercel
app.rotamestre.tec.br.       300   IN   CNAME  cname.vercel-dns.com.
```

### Subdomínios Futuros

```dns
; Painel Admin
painel.rotamestre.tec.br.    300   IN   CNAME  cname.vercel-dns.com.

; Documentação
docs.rotamestre.tec.br.      300   IN   CNAME  cname.vercel-dns.com.

; API (proxy para Supabase)
api.rotamestre.tec.br.       300   IN   CNAME  cname.vercel-dns.com.
```

---

## 📧 Email (Opcional)

### Usando Zoho Mail

```dns
; MX Records
rotamestre.tec.br.           300   IN   MX     10  mx1.zoho.com.
rotamestre.tec.br.           300   IN   MX     20  mx2.zoho.com.

; SPF Record (anti-spam)
rotamestre.tec.br.           300   IN   TXT    "v=spf1 include:zoho.com ~all"

; DKIM Record (assinatura de email)
zmail._domainkey.rotamestre.tec.br. 300 IN TXT "v=DKIM1; k=rsa; p=..."

; DMARC Record (política de email)
_dmarc.rotamestre.tec.br.    300   IN   TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@rotamestre.tec.br"
```

### Usando Google Workspace

```dns
; MX Records
rotamestre.tec.br.           300   IN   MX     1   aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     5   alt1.aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     5   alt2.aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     10  alt3.aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     10  alt4.aspmx.l.google.com.

; SPF Record
rotamestre.tec.br.           300   IN   TXT    "v=spf1 include:_spf.google.com ~all"
```

---

## 🔐 Segurança (CAA Records)

```dns
; CAA Records - Autoriza apenas Let's Encrypt
rotamestre.tec.br.           300   IN   CAA    0 issue "letsencrypt.org"
rotamestre.tec.br.           300   IN   CAA    0 issuewild "letsencrypt.org"
rotamestre.tec.br.           300   IN   CAA    0 iodef "mailto:security@rotamestre.tec.br"
```

---

## 🔧 Troubleshooting

### ❌ Erro: "404: NOT_FOUND"
**Causa:** Domínio não adicionado no Vercel
**Solução:** Adicionar via Dashboard > Settings > Domains

### ❌ Erro: "Invalid Configuration"
**Causa:** CNAME incorreto ou não propagado
**Solução:**
```bash
# Verificar DNS
dig app.rotamestre.tec.br CNAME

# Aguardar propagação (até 48h, geralmente 5min)
```

### ❌ Redirect não funciona
**Causa:** Deploy antigo ainda ativo
**Solução:**
```bash
# Fazer novo deploy
vercel --prod --force
```

### ❌ SSL não ativa
**Causa:** Certificado ainda sendo provisionado
**Solução:** Aguardar 1-5 minutos após adicionar domínio

### ❌ App não carrega
**Causa:** Build pode ter falhado
**Solução:**
```bash
# Testar build localmente
npm run build:web

# Verificar dist/ foi gerado
ls -la dist/

# Fazer novo deploy
vercel --prod
```

### ❌ DNS não propagou
**Causa:** Propagação DNS lenta
**Solução:**
- Aguarde até 48h (geralmente < 4h)
- Limpe cache DNS:
  - Windows: `ipconfig /flushdns`
  - Mac: `sudo dscacheutil -flushcache`
- Verifique em: https://dnschecker.org

---

## 🛠️ Ferramentas de Teste

### DNS Lookup
```bash
# Verificar A record
dig rotamestre.tec.br A

# Verificar CNAME
dig app.rotamestre.tec.br CNAME

# Verificar MX (se configurado)
dig rotamestre.tec.br MX

# Verificar TXT (SPF)
dig rotamestre.tec.br TXT
```

### SSL/TLS Test
```bash
# Testar SSL com OpenSSL
openssl s_client -connect app.rotamestre.tec.br:443 -servername app.rotamestre.tec.br
```

### Online Tools
- **DNS Checker:** https://dnschecker.org/
- **SSL Labs:** https://www.ssllabs.com/ssltest/
- **MX Toolbox:** https://mxtoolbox.com
- **What's My DNS:** https://www.whatsmydns.net

---

## 📱 Checklist de Teste Manual

### 1. Redirects
- [ ] https://rotamestre.tec.br → redireciona para app.rotamestre.tec.br
- [ ] http://rotamestre.tec.br → redireciona para https://app.rotamestre.tec.br
- [ ] https://www.rotamestre.tec.br → redireciona para app.rotamestre.tec.br

### 2. Aplicação
- [ ] https://app.rotamestre.tec.br → app carrega
- [ ] Logo e título "RotaMestre" aparecem
- [ ] /auth/login acessível
- [ ] /auth/register acessível
- [ ] Login funciona → redireciona corretamente

### 3. PWA
- [ ] Ícone de instalação aparece no navegador
- [ ] Manifest.json acessível: /manifest.json
- [ ] Service Worker registrado (DevTools > Application)
- [ ] Favicon aparece na aba do navegador

### 4. SEO
- [ ] Meta tags presentes (View Source)
- [ ] Open Graph funcionando (preview ao compartilhar)
- [ ] /robots.txt acessível
- [ ] /sitemap.xml acessível

### 5. Segurança
- [ ] HTTPS funcionando
- [ ] SSL/TLS válido (cadeado verde)
- [ ] HSTS header presente
- [ ] SSL Labs score A+

---

## 🚀 Próximos Passos (Futuro)

### Opção A: Landing Page Separada (Recomendado)

Quando quiser criar uma **landing page institucional** verdadeira em `rotamestre.tec.br`:

1. Criar novo repositório `rotamestre-landing`
2. Deploy HTML/CSS estático ou NextJS
3. Configurar rotamestre.tec.br neste novo projeto
4. Botão "Acessar Plataforma" → https://app.rotamestre.tec.br

### Opção B: Subpasta no Projeto Atual (Não Recomendado)

1. Criar `landing/` na raiz do projeto
2. HTML/CSS estático com build separado
3. Configurar rewrite no vercel.json
4. ⚠️ Mais complexo e difícil de manter

---

## 🔗 Links Úteis

- **Vercel Dashboard:** https://vercel.com/wellintonribeiro-projects/rotamestre-app
- **Vercel Domains:** https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/domains
- **DNS Checker:** https://dnschecker.org/
- **SSL Labs:** https://www.ssllabs.com/ssltest/
- **PageSpeed Insights:** https://pagespeed.web.dev/

---

## ✅ Status Final

Após completar todos os passos:

- ✅ `app.rotamestre.tec.br` adicionado no Vercel
- ✅ DNS propagado e validado
- ✅ SSL ativo (Let's Encrypt)
- ✅ `rotamestre.tec.br` redireciona para app
- ✅ Aplicação carregando corretamente
- ✅ PWA instalável em todas as plataformas
- ✅ Meta tags e SEO configurados

**Status:** 🟢 Produção

---

**Responsável:** Wellinton Ribeiro
**Projeto:** RotaMestre App
**Data:** 2025-10-20
