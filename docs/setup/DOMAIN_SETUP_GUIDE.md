# 🌐 Guia de Configuração de Domínios - RotaMestre

## 📊 Arquitetura de Domínios

```
rotamestre.tec.br           → Redirect 301 permanente
  └─ https://app.rotamestre.tec.br

app.rotamestre.tec.br       → Aplicação Web (PWA)
  ├─ /                      → Tela inicial
  ├─ /auth/login           → Login
  ├─ /auth/register        → Cadastro
  ├─ /gestor/dashboard     → Dashboard gestor
  ├─ /motorista/rota       → Rota motorista
  └─ ...
```

---

## ✅ Checklist de Implementação

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

### 2️⃣ Configurar Domínio Principal

O domínio `rotamestre.tec.br` já está configurado e irá redirecionar automaticamente para `app.rotamestre.tec.br` através do **vercel.json**.

**Redirect configurado:**
```json
{
  "source": "/",
  "has": [{ "type": "host", "value": "rotamestre.tec.br" }],
  "destination": "https://app.rotamestre.tec.br",
  "permanent": true
}
```

---

### 3️⃣ Fazer Deploy

```bash
# Via CLI Vercel
vercel --prod

# OU fazer push no Git (auto-deploy)
git add .
git commit -m "feat: configurar domínios separados"
git push origin main
```

---

### 4️⃣ Testar Configuração

#### DNS Propagado
```bash
# Verificar CNAME de app.rotamestre.tec.br
nslookup app.rotamestre.tec.br

# Ou usando dig
dig app.rotamestre.tec.br CNAME
```

**Resultado esperado:**
```
app.rotamestre.tec.br.    300    IN    CNAME    cname.vercel-dns.com.
```

#### Redirect Funcionando
```bash
# Testar redirect de rotamestre.tec.br
curl -I https://rotamestre.tec.br
```

**Resultado esperado:**
```
HTTP/2 301
location: https://app.rotamestre.tec.br
```

#### SSL Ativo
```bash
# Verificar certificado SSL
curl -I https://app.rotamestre.tec.br
```

**Resultado esperado:**
```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
```

#### Aplicação Carregando
```bash
# Testar página principal
curl https://app.rotamestre.tec.br | grep -i "RotaMestre"
```

---

## 🎯 Comportamento Final

### Acessos ao domínio principal:
```
https://rotamestre.tec.br
  └─ 301 Redirect → https://app.rotamestre.tec.br

http://rotamestre.tec.br
  └─ 301 Redirect → https://app.rotamestre.tec.br

https://www.rotamestre.tec.br
  └─ 301 Redirect → https://app.rotamestre.tec.br
```

### Acessos ao app:
```
https://app.rotamestre.tec.br
  └─ 200 OK → Aplicação carrega

https://app.rotamestre.tec.br/auth/login
  └─ 200 OK → Tela de login

https://app.rotamestre.tec.br/gestor/dashboard
  └─ 200 OK → Dashboard (se autenticado)
```

---

## 🔧 Troubleshooting

### Erro: "404: NOT_FOUND"
**Causa:** Domínio não adicionado no Vercel
**Solução:** Adicionar via Dashboard > Settings > Domains

### Erro: "Invalid Configuration"
**Causa:** CNAME incorreto ou não propagado
**Solução:**
```bash
# Verificar DNS
dig app.rotamestre.tec.br CNAME

# Aguardar propagação (até 48h, geralmente 5min)
```

### Redirect não funciona
**Causa:** Deploy antigo ainda ativo
**Solução:**
```bash
# Fazer novo deploy
vercel --prod --force
```

### SSL não ativa
**Causa:** Certificado ainda sendo provisionado
**Solução:** Aguardar 1-5 minutos após adicionar domínio

### App não carrega
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

---

## 📱 Teste Manual Completo

### 1. Testar Redirects
- [ ] Acessar https://rotamestre.tec.br → redireciona para app.rotamestre.tec.br
- [ ] Acessar http://rotamestre.tec.br → redireciona para https://app.rotamestre.tec.br
- [ ] Acessar https://www.rotamestre.tec.br → redireciona para app.rotamestre.tec.br

### 2. Testar App
- [ ] Acessar https://app.rotamestre.tec.br → app carrega
- [ ] Verificar logo e título "RotaMestre"
- [ ] Clicar em "Entrar" → /auth/login carrega
- [ ] Clicar em "Criar Conta" → /auth/register carrega
- [ ] Fazer login → redireciona para dashboard correto

### 3. Testar PWA
- [ ] Ícone de instalação aparece no navegador
- [ ] Manifest.json acessível: https://app.rotamestre.tec.br/manifest.json
- [ ] Service Worker registrado
- [ ] Favicon aparece na aba

### 4. Testar SEO
- [ ] Meta tags presentes no View Source
- [ ] Open Graph funcionando (preview ao compartilhar)
- [ ] Robots.txt acessível: https://app.rotamestre.tec.br/robots.txt
- [ ] Sitemap.xml acessível: https://app.rotamestre.tec.br/sitemap.xml

---

## 🚀 Próximos Passos (Futuro)

Quando quiser criar uma **landing page institucional** verdadeira em `rotamestre.tec.br`:

### Opção A: Projeto Vercel Separado
1. Criar novo repositório `rotamestre-landing`
2. Deploy HTML/CSS estático ou NextJS
3. Configurar rotamestre.tec.br neste novo projeto
4. Botão "Acessar Plataforma" → https://app.rotamestre.tec.br

### Opção B: Subpasta no Projeto Atual
1. Criar `landing/` na raiz do projeto
2. HTML/CSS estático com build separado
3. Configurar rewrite no vercel.json
4. Mais complexo, não recomendado

---

## 📊 Status dos Domínios

| Domínio | Tipo | Destino | Status | Uso |
|---------|------|---------|--------|-----|
| rotamestre.tec.br | A | 216.198.79.1 | ✅ Ativo | Redirect 301 |
| www.rotamestre.tec.br | CNAME | cname.vercel-dns.com | ✅ Ativo | Redirect 301 |
| **app.rotamestre.tec.br** | CNAME | cname.vercel-dns.com | ⏳ Configurar | **App PWA** |
| painel.rotamestre.tec.br | CNAME | cname.vercel-dns.com | 🟡 Futuro | Backoffice |
| docs.rotamestre.tec.br | CNAME | cname.vercel-dns.com | 🟡 Futuro | Docs |
| api.rotamestre.tec.br | CNAME | - | ✅ Ativo | Supabase |

---

## 🔗 Links Úteis

- **Vercel Dashboard:** https://vercel.com/wellintonribeiro-projects/rotamestre-app
- **Vercel Domains:** https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/domains
- **DNS Checker:** https://dnschecker.org/
- **SSL Labs:** https://www.ssllabs.com/ssltest/
- **PageSpeed Insights:** https://pagespeed.web.dev/

---

## ✅ Configuração Completa

Após seguir todos os passos:

1. ✅ `app.rotamestre.tec.br` adicionado no Vercel
2. ✅ DNS propagado e validado
3. ✅ SSL ativo (Let's Encrypt)
4. ✅ `rotamestre.tec.br` redireciona para app
5. ✅ Aplicação carregando corretamente
6. ✅ PWA instalável
7. ✅ Meta tags e SEO configurados

**Status:** 🟢 Produção

---

**Última atualização:** 2025-10-20
**Responsável:** Wellinton Ribeiro
**Projeto:** RotaMestre App
