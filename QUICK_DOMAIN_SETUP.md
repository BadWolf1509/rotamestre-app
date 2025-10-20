# ⚡ Configuração Rápida de Domínios

## 🎯 Objetivo

Separar os domínios:
- `rotamestre.tec.br` → Redireciona para app
- `app.rotamestre.tec.br` → Aplicação web (PWA)

---

## ✅ Passo a Passo (5 minutos)

### 1. Adicionar Domínio no Vercel

**Dashboard:**
https://vercel.com/wellintonribeiro-projects/rotamestre-app/settings/domains

**Ação:**
- Clicar em **"Add Domain"**
- Digitar: `app.rotamestre.tec.br`
- Clicar em **"Add"**
- ✅ Aguardar validação (1-5 min)

---

### 2. Fazer Deploy

```bash
# Opção 1: Via Git (auto-deploy)
git add .
git commit -m "feat: configurar domínios separados"
git push origin main

# Opção 2: Via CLI Vercel
vercel --prod
```

---

### 3. Testar

```bash
# Verificar DNS
nslookup app.rotamestre.tec.br

# Testar redirect
curl -I https://rotamestre.tec.br
# Deve retornar: HTTP/2 301
# location: https://app.rotamestre.tec.br

# Testar app
curl -I https://app.rotamestre.tec.br
# Deve retornar: HTTP/2 200
```

---

## 🎉 Resultado Final

```
✅ rotamestre.tec.br           → 301 → app.rotamestre.tec.br
✅ www.rotamestre.tec.br       → 301 → app.rotamestre.tec.br
✅ app.rotamestre.tec.br       → 200 OK (App carrega)
✅ app.rotamestre.tec.br/auth/login → Tela de login
```

---

## 📚 Documentação Completa

Para detalhes, troubleshooting e testes completos:
👉 [DOMAIN_SETUP_GUIDE.md](DOMAIN_SETUP_GUIDE.md)

---

## 🆘 Problemas Comuns

**Erro: "404: NOT_FOUND"**
- Adicionar domínio no Dashboard Vercel (passo 1)

**Redirect não funciona**
- Fazer novo deploy: `vercel --prod --force`

**DNS não propaga**
- Aguardar até 5 minutos, verificar com `nslookup`

---

**Tempo estimado:** 5 minutos
**Última atualização:** 2025-10-20
