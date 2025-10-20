# 📐 Arquitetura de Domínios - RotaMestre

**Última atualização:** 2025-10-20

---

## 🎯 Visão Geral

O RotaMestre opera em **DOIS projetos separados**:

### 1. Site Institucional
- **Domínio:** `rotamestre.tec.br`
- **Tipo:** Landing page / Site institucional
- **Tecnologia:** (A definir - HTML/CSS, React, NextJS, etc.)
- **Objetivo:** Marketing, informação, captação de leads

### 2. Aplicação Web (PWA)
- **Domínio:** `app.rotamestre.tec.br`
- **Tipo:** Progressive Web App
- **Tecnologia:** React Native Web (Expo)
- **Objetivo:** Sistema de gestão de rotas e entregas

---

## 🏗️ Arquitetura Definitiva

```
┌──────────────────────────────────┐
│  rotamestre.tec.br               │
│  (Site Institucional)            │
│                                  │
│  ✓ Landing page                  │
│  ✓ Sobre nós                     │
│  ✓ Funcionalidades               │
│  ✓ Preços                        │
│  ✓ Contato                       │
│  ✓ Blog                          │
│                                  │
│  [Botão: "Acessar Plataforma"]  │
│         ↓                        │
└─────────┼────────────────────────┘
          │
          │ Link para
          ↓
┌──────────────────────────────────┐
│  app.rotamestre.tec.br           │
│  (Aplicação Web - PWA)           │
│                                  │
│  ✓ /auth/login                   │
│  ✓ /auth/register                │
│  ✓ /gestor/dashboard             │
│  ✓ /gestor/nova-entrega          │
│  ✓ /motorista/rota               │
│  ✓ /motorista/checkpoints        │
│                                  │
└──────────────────────────────────┘
```

---

## 🚫 O QUE NÃO FAZER

❌ **NÃO criar redirect** de `rotamestre.tec.br` para `app.rotamestre.tec.br`
❌ **NÃO usar** o mesmo projeto para ambos os sites
❌ **NÃO misturar** landing page com aplicação

---

## ✅ O QUE FAZER

✅ **Manter** projetos separados
✅ **Criar** site institucional próprio em `rotamestre.tec.br`
✅ **Usar** `app.rotamestre.tec.br` exclusivamente para a aplicação
✅ **Adicionar** botão/link do institucional para a aplicação

---

## 📦 Estrutura de Projetos

### Projeto 1: rotamestre-landing (A CRIAR)
```
Repositório: rotamestre-landing
Deploy: Vercel (ou outro)
Domínio: rotamestre.tec.br
Tecnologia: (A definir pelo desenvolvedor)
```

### Projeto 2: rotamestre-app (EXISTENTE)
```
Repositório: rotamestre-app (atual)
Deploy: Vercel
Domínio: app.rotamestre.tec.br
Tecnologia: React Native Web (Expo)
```

---

## 🔧 Configuração DNS

```
Domínio                     Tipo    Destino
─────────────────────────────────────────────────────
rotamestre.tec.br          A/CNAME  [Landing Page Project]
app.rotamestre.tec.br      CNAME    [rotamestre-app Project]
```

---

## 🎨 Fluxo do Usuário

### Visitante Novo
```
1. Acessa rotamestre.tec.br
2. Lê sobre o produto
3. Clica em "Acessar Plataforma"
4. É direcionado para app.rotamestre.tec.br/auth/login
5. Cria conta ou faz login
```

### Usuário Existente
```
1. Acessa diretamente app.rotamestre.tec.br
2. Faz login
3. Usa a aplicação
```

---

## 📱 Domínios Completos

| Domínio | Propósito | Status | Projeto |
|---------|-----------|--------|---------|
| `rotamestre.tec.br` | Site institucional | 🟡 A criar | rotamestre-landing |
| `app.rotamestre.tec.br` | Aplicação PWA | ✅ Ativo | rotamestre-app |
| `painel.rotamestre.tec.br` | Backoffice (futuro) | 🔵 Planejado | - |
| `docs.rotamestre.tec.br` | Documentação (futuro) | 🔵 Planejado | - |
| `api.rotamestre.tec.br` | API pública | ✅ Ativo | Supabase |

---

## 💡 Decisões Importantes

### Por que projetos separados?

1. **Separação de responsabilidades**
   - Landing page tem objetivos diferentes da aplicação
   - Tecnologias podem ser diferentes

2. **Performance**
   - Landing page pode ser otimizada para SEO
   - Aplicação otimizada para funcionalidade

3. **Manutenção**
   - Equipes diferentes podem trabalhar em paralelo
   - Deploy independente

4. **Segurança**
   - Site público vs. aplicação autenticada
   - Menor superfície de ataque

---

## 🚀 Próximos Passos

1. [ ] Decidir tecnologia do site institucional
2. [ ] Criar projeto rotamestre-landing
3. [ ] Desenvolver landing page
4. [ ] Configurar domínio rotamestre.tec.br
5. [ ] Adicionar links para app.rotamestre.tec.br

---

## ⚠️ IMPORTANTE

**Esta é a arquitetura definitiva do projeto.**

Qualquer Claude AI trabalhando neste projeto deve:
1. LER este documento primeiro
2. SEGUIR esta arquitetura
3. NUNCA assumir comportamentos diferentes
4. SEMPRE confirmar antes de implementar

---

**Documento aprovado pelo desenvolvedor: Wellinton Ribeiro**
**Data: 2025-10-20**
