# 🌐 Configuração de Domínios no Vercel

## ✅ Status Atual

### Domínio Principal
- **rotamestre.tec.br** → ✅ **FUNCIONANDO**
- Deploy: https://rotamestre.tec.br
- Status: App React Native Web carregando corretamente

### Subdomínio app.rotamestre.tec.br
- **app.rotamestre.tec.br** → ⚠️ **CONFIGURAÇÃO PENDENTE**
- Erro atual: 404: NOT_FOUND (DEPLOYMENT_NOT_FOUND)

---

## 🔧 Problema Identificado

O projeto `rotamestre-app` está usando **rotamestre.tec.br** como domínio de produção, mas o subdomínio **app.rotamestre.tec.br** não está vinculado ao projeto.

### Detalhes Técnicos

**ID do Erro:**
```
Code: DEPLOYMENT_NOT_FOUND
ID: gru1::fftj4-1760971526229-67454b131bc5
```

**Projeto Vercel:**
- ID: `prj_KMa2FJUEwdPXSoSHDQPw7KQ9pLmC`
- Nome: `rotamestre-app`
- Owner: `wellintonribeiro-projects`

**Último Deploy Ativo:**
- URL: https://rotamestre-i3hhxge41-wellintonribeiro-projects.vercel.app
- Status: Ready (Production)
- Age: 4 minutos

---

## 📋 Solução: Adicionar Domínio via Dashboard Vercel

### Passo 1: Acessar o Dashboard
1. Acesse: https://vercel.com/wellintonribeiro-projects/rotamestre-app
2. Faça login se necessário

### Passo 2: Adicionar Domínio Customizado
1. Clique em **Settings** (Configurações)
2. No menu lateral, clique em **Domains**
3. Clique em **Add Domain**
4. Digite: `app.rotamestre.tec.br`
5. Clique em **Add**

### Passo 3: Verificar DNS
O Vercel irá verificar automaticamente os registros DNS:

```dns
app.rotamestre.tec.br.    300    IN    CNAME    cname.vercel-dns.com.
```

**Status esperado:** ✅ Valid Configuration

### Passo 4: Configurar Redirect (Opcional)
Se você quiser que **www.app.rotamestre.tec.br** redirecione para **app.rotamestre.tec.br**:

1. Na mesma tela de Domains
2. Clique em **Add** novamente
3. Digite: `www.app.rotamestre.tec.br`
4. Selecione a opção: **Redirect to app.rotamestre.tec.br**
5. Marque **Permanent (301)**

---

## 🎯 Alternativa: Usar o Domínio Principal

Como **rotamestre.tec.br** já está funcionando, você tem 2 opções:

### Opção A: Usar rotamestre.tec.br para o App
✅ **Recomendado para começar**

```
https://rotamestre.tec.br → App Mobile Web (atual)
```

**Vantagem:** Já está funcionando!

### Opção B: Adicionar app.rotamestre.tec.br
🔧 **Requer configuração adicional**

```
https://rotamestre.tec.br → Landing page / Site institucional (futuro)
https://app.rotamestre.tec.br → App Mobile Web
https://painel.rotamestre.tec.br → Dashboard Admin (futuro)
https://docs.rotamestre.tec.br → Documentação (futuro)
```

**Vantagem:** Separação clara de responsabilidades

---

## 🚀 Depois de Adicionar o Domínio

### 1. Aguardar Propagação DNS
```bash
# Verificar DNS propagado
dig app.rotamestre.tec.br

# Deve retornar:
# app.rotamestre.tec.br.    300    IN    CNAME    cname.vercel-dns.com.
```

### 2. Testar o Domínio
```bash
curl -I https://app.rotamestre.tec.br
# Deve retornar: HTTP/2 200
```

### 3. Testar SSL
```bash
openssl s_client -connect app.rotamestre.tec.br:443 -servername app.rotamestre.tec.br < /dev/null 2>&1 | grep 'subject='
# Deve retornar certificado Let's Encrypt
```

---

## 📊 Status dos Domínios

| Domínio | Status | Deploy | DNS |
|---------|--------|--------|-----|
| rotamestre.tec.br | ✅ Ativo | Vercel | A: 216.198.79.1 |
| www.rotamestre.tec.br | ✅ Ativo | Vercel | CNAME: 3a288de4d433bd70.vercel-dns-017.com |
| app.rotamestre.tec.br | ⚠️ Pendente | - | CNAME: cname.vercel-dns.com |
| painel.rotamestre.tec.br | 🟡 Planejado | - | CNAME: cname.vercel-dns.com |
| docs.rotamestre.tec.br | 🟡 Planejado | - | CNAME: cname.vercel-dns.com |
| api.rotamestre.tec.br | 🟡 Planejado | - | CNAME: cname.vercel-dns.com |

---

## 🛠️ Troubleshooting

### Erro: "You don't have access to this domain"
**Solução:** Adicionar o domínio via Dashboard Vercel (não via CLI)

### Erro: "Invalid Configuration"
**Solução:** Verificar se o CNAME está correto:
```bash
dig app.rotamestre.tec.br CNAME
```

### Erro: "Deployment Protection"
**Solução:** Desabilitar proteção em Settings > Deployment Protection > Production

### SSL não ativa
**Solução:** Aguardar 1-5 minutos para provisionamento Let's Encrypt

---

## 📝 Comandos Úteis

```bash
# Listar todos os domínios configurados
vercel domains ls

# Listar deployments
vercel ls

# Inspecionar projeto
vercel project inspect rotamestre-app

# Ver logs do último deploy
vercel logs rotamestre-i3hhxge41-wellintonribeiro-projects.vercel.app
```

---

## ✅ Checklist de Configuração

- [x] Projeto criado no Vercel
- [x] Build funcionando (dist/ gerado)
- [x] Deploy de produção ativo
- [x] Domínio principal (rotamestre.tec.br) funcionando
- [ ] Subdomínio app.rotamestre.tec.br adicionado
- [ ] DNS propagado
- [ ] SSL ativo
- [ ] Testes de acesso ok

---

## 🎯 Próximo Passo

**Adicionar o domínio app.rotamestre.tec.br via Dashboard Vercel:**

👉 https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/domains

Depois de adicionar, aguarde 1-2 minutos para propagação DNS e provisionamento SSL.

---

**Criado em:** 2025-10-20
**Status:** 🟡 Aguardando configuração manual no Dashboard Vercel
