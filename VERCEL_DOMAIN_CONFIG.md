# 🌐 Configurar Domínio app.rotamestre.tec.br no Vercel

## ✅ Deploy Completo

**URL Atual:** https://rotamestre-jdrgpa3qi-wellintonribeiro-projects.vercel.app
**URL Desejada:** https://app.rotamestre.tec.br

---

## 📋 Como Configurar o Domínio Customizado

### Passo 1: Acessar Dashboard do Vercel

1. Abra: https://vercel.com/wellintonribeiro-projects/rotamestre-app
2. Faça login se necessário

### Passo 2: Adicionar Domínio

1. No dashboard do projeto, clique na aba **"Settings"**
2. No menu lateral, clique em **"Domains"**
3. No campo "Add Domain", digite: `app.rotamestre.tec.br`
4. Clique em **"Add"**

### Passo 3: Configurar DNS

O Vercel irá mostrar instruções para configurar o DNS. Você terá 2 opções:

#### Opção A: Nameservers da Vercel (Recomendado)

**Se estiver usando Vercel DNS:**
- Os nameservers já devem estar configurados:
  - `ns1.vercel-dns.com`
  - `ns2.vercel-dns.com`

**O que fazer:**
1. Apenas confirme que o domínio usa esses nameservers
2. A Vercel criará automaticamente o registro `app` CNAME

#### Opção B: DNS Externo (Registro CNAME Manual)

**Se estiver usando outro provedor de DNS:**
1. Acesse o painel do seu provedor DNS
2. Adicione um registro CNAME:
   ```
   Tipo: CNAME
   Nome: app
   Valor: cname.vercel-dns.com
   TTL: 3600 (ou automático)
   ```
3. Salve a configuração

### Passo 4: Aguardar Propagação

- **Tempo estimado:** 5 minutos a 48 horas
- **Verificar:** O Vercel mostrará status "Valid" quando estiver pronto
- **SSL:** O Vercel provisiona SSL automaticamente (Let's Encrypt)

### Passo 5: Testar

Após a propagação:
```bash
# Testar DNS
nslookup app.rotamestre.tec.br

# Testar HTTPS
curl -I https://app.rotamestre.tec.br
```

**Resultado esperado:**
- ✅ Favicon aparece na aba
- ✅ Título: "Rota Mestre - Gestão Inteligente de Entregas..."
- ✅ Meta tags SEO presentes
- ✅ PWA instalável

---

## 🔧 Configurações DNS Atuais

### Domínios Configurados

| Domínio | Tipo | Destino | Status |
|---------|------|---------|--------|
| rotamestre.tec.br | A | 216.198.79.1 | ✅ Ativo |
| www.rotamestre.tec.br | CNAME | cname.vercel-dns.com | 🟡 Institucional futuro |
| **app.rotamestre.tec.br** | CNAME | cname.vercel-dns.com | ⏳ **Adicionar** |
| painel.rotamestre.tec.br | CNAME | cname.vercel-dns.com | 🟡 Futuro |
| docs.rotamestre.tec.br | CNAME | cname.vercel-dns.com | 🟡 Futuro |
| api.rotamestre.tec.br | CNAME | cname.vercel-dns.com | ✅ Ativo (Supabase) |

### Nameservers

Se estiver usando Vercel DNS:
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

---

## 🎯 Após Configurar

### Configurar Redirect (Opcional)

Se quiser que `www.rotamestre.tec.br` redirecione para `app.rotamestre.tec.br`:

1. Na aba "Domains" do Vercel
2. Adicione `www.rotamestre.tec.br`
3. Configure como "Redirect to app.rotamestre.tec.br"

### Remover URLs Temporárias (Opcional)

Para segurança, você pode desabilitar URLs `*.vercel.app`:

1. Settings → Domains
2. Encontre as URLs `*.vercel.app`
3. Clique em "..." → "Remove"
4. Confirme

**Atenção:** Só faça isso APÓS o domínio customizado estar funcionando!

---

## 🧪 Checklist de Validação

Após configurar, testar:

- [ ] **DNS resolvendo:** `nslookup app.rotamestre.tec.br`
- [ ] **HTTPS ativo:** Certificado válido
- [ ] **Favicon aparece:** Na aba do navegador
- [ ] **Título correto:** "Rota Mestre - Gestão Inteligente de Entregas..."
- [ ] **Meta description:** Presente no View Source
- [ ] **PWA instalável:** Botão de instalação aparece
- [ ] **Open Graph:** Preview correto ao compartilhar
- [ ] **Manifest.json:** Acessível em /manifest.json
- [ ] **Robots.txt:** Acessível em /robots.txt
- [ ] **Sitemap.xml:** Acessível em /sitemap.xml

---

## 📊 Estrutura Final de Domínios

```
rotamestre.tec.br/           → Site institucional (futuro)
  └─ Botão: "Acessar Plataforma" → app.rotamestre.tec.br

app.rotamestre.tec.br/       → Aplicação web (PWA)
  ├─ /auth/login             → Login
  ├─ /gestor/dashboard       → Dashboard gestor
  └─ /motorista/rota         → Rota motorista

painel.rotamestre.tec.br/    → Backoffice admin (futuro)

docs.rotamestre.tec.br/      → Documentação (futuro)

api.rotamestre.tec.br/       → API pública (Supabase)
```

---

## 🔗 Links Úteis

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Domains:** https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/domains
- **DNS Checker:** https://dnschecker.org/
- **SSL Checker:** https://www.ssllabs.com/ssltest/

---

## 💡 Troubleshooting

### Erro: "Domain is not configured"

**Causa:** DNS ainda não propagou
**Solução:** Aguardar até 48h, verificar com `nslookup`

### Erro: "Invalid configuration"

**Causa:** CNAME incorreto
**Solução:** Verificar se o valor é exatamente `cname.vercel-dns.com`

### Favicon não aparece

**Causa:** Cache do navegador
**Solução:**
1. Hard refresh: `Ctrl+Shift+R`
2. Limpar cache: `Ctrl+Shift+Delete`
3. Testar em aba anônima: `Ctrl+Shift+N`

### PWA não instalável

**Causa:** Manifest.json não acessível ou HTTPS inativo
**Solução:**
1. Verificar: https://app.rotamestre.tec.br/manifest.json
2. Verificar certificado SSL válido
3. Abrir DevTools → Application → Manifest

---

**Data:** 2025-10-20
**Deploy:** https://rotamestre-jdrgpa3qi-wellintonribeiro-projects.vercel.app
**Status:** ⏳ Aguardando configuração de domínio customizado

