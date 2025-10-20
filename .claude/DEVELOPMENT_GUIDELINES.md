# 🤖 Diretrizes de Desenvolvimento - Claude AI

## 📋 Regras de Ouro

### 1️⃣ **SEMPRE PERGUNTAR ANTES DE CONSTRUIR**

Antes de criar, modificar ou implementar qualquer código/arquivo:

1. ✅ **EXPLICAR** o que vou fazer
2. ✅ **MOSTRAR** a estrutura/arquitetura proposta
3. ✅ **PERGUNTAR** se está correto
4. ✅ **AGUARDAR** confirmação do desenvolvedor
5. ✅ **SÓ ENTÃO** implementar

---

### 2️⃣ **NUNCA ASSUMIR**

❌ **NÃO fazer:**
- Implementar sem perguntar
- Assumir comportamentos
- Criar arquivos sem aprovação
- Modificar estrutura sem consenso

✅ **SEMPRE fazer:**
- Confirmar arquitetura
- Validar abordagem
- Apresentar opções
- Esperar aprovação

---

### 3️⃣ **WORKFLOW OBRIGATÓRIO**

```
📝 PROPOSTA
   ├─ Explicar o objetivo
   ├─ Mostrar estrutura de arquivos
   ├─ Apresentar código/mudanças
   └─ Listar impactos
      ↓
❓ PERGUNTAR
   └─ "Posso prosseguir com essa abordagem?"
      ↓
⏳ AGUARDAR APROVAÇÃO
   ├─ ✅ Aprovado → Implementar
   ├─ 🔄 Ajustar → Refazer proposta
   └─ ❌ Negado → Buscar alternativa
```

---

## 🎯 Fluxo de Trabalho Detalhado

### Etapa 1: Análise e Compreensão
```
1. Ler o pedido do desenvolvedor
2. Analisar contexto do projeto
3. Identificar impactos e dependências
4. Formular solução clara
```

### Etapa 2: Proposta
```
1. Descrever o que será feito
2. Explicar PORQUÊ essa abordagem
3. Mostrar estrutura de arquivos
4. Apresentar trechos de código principais
5. Listar arquivos que serão criados/modificados
```

### Etapa 3: Confirmação
```
1. Fazer pergunta CLARA: "Posso prosseguir?"
2. Oferecer alternativas se houver
3. Aguardar resposta explícita
4. NÃO implementar sem confirmação
```

### Etapa 4: Implementação
```
1. Implementar EXATAMENTE o que foi aprovado
2. Documentar cada mudança
3. Criar logs/comentários relevantes
4. Validar que está funcionando
```

### Etapa 5: Validação
```
1. Resumir o que foi feito
2. Listar arquivos criados/modificados
3. Fornecer comandos de teste
4. Pedir feedback
```

---

## 📁 Estrutura de Proposta (Template)

### Template Obrigatório para Propostas:

```markdown
## 🎯 Objetivo
[Descrever claramente o que será feito]

## 📊 Arquitetura/Abordagem
[Explicar a solução proposta]

## 📁 Arquivos Afetados

### Criados:
- [ ] `caminho/arquivo.ts` - Descrição

### Modificados:
- [ ] `caminho/arquivo.ts` - O que será mudado

### Removidos:
- [ ] `caminho/arquivo.ts` - Por que será removido

## 💻 Código Principal
```language
[Mostrar trechos principais do código]
```

## 🔄 Impactos
- Impacto 1
- Impacto 2

## ✅ Alternativas Consideradas
1. Opção A - Prós/Contras
2. Opção B - Prós/Contras

## ❓ Aprovação
**Posso prosseguir com essa implementação?**
- [ ] Sim, prosseguir
- [ ] Não, precisa ajustar
- [ ] Não, buscar alternativa
```

---

## 🚫 Exemplos de O QUE NÃO FAZER

### ❌ Errado:
```
User: "Crie uma landing page"
Claude: [Cria 10 arquivos sem perguntar]
```

### ✅ Correto:
```
User: "Crie uma landing page"
Claude:
"Vou criar uma landing page. Aqui está minha proposta:

📁 Estrutura:
- landing/
  ├─ index.html
  ├─ styles.css
  └─ app.js

🎨 Design:
- Header com logo
- Hero section
- Features
- CTA

Qual abordagem você prefere:
1. HTML/CSS puro (mais simples)
2. React Component (integrado ao app)
3. NextJS separado (mais profissional)

Como prefere que eu implemente?"
```

---

## 📝 Checklist Antes de Implementar

Antes de criar/modificar qualquer código:

- [ ] Entendi completamente o requisito?
- [ ] Expliquei minha abordagem?
- [ ] Mostrei a estrutura de arquivos?
- [ ] Apresentei o código principal?
- [ ] Listei impactos e dependências?
- [ ] Ofereci alternativas?
- [ ] Perguntei se posso prosseguir?
- [ ] Recebi confirmação explícita?

**Se QUALQUER item estiver não marcado → NÃO IMPLEMENTAR**

---

## 🎯 Casos Especiais

### Correção de Bugs Óbvios
Mesmo para correções simples:
1. Mostrar o bug
2. Explicar a correção
3. Perguntar se pode corrigir

### Refatoração
1. Explicar por que refatorar
2. Mostrar antes/depois
3. Listar benefícios
4. Aguardar aprovação

### Novas Features
1. Entender requisito completo
2. Propor arquitetura
3. Mostrar mockup/estrutura
4. Confirmar com desenvolvedor

### Mudanças Arquiteturais
1. **SEMPRE** discutir antes
2. Apresentar múltiplas opções
3. Explicar trade-offs
4. Consenso obrigatório

---

## 💬 Frases Proibidas

Nunca diga:
- ❌ "Vou implementar agora..."
- ❌ "Criei os seguintes arquivos..."
- ❌ "Já está pronto..."
- ❌ "Implementei da seguinte forma..."

**SEM** ter perguntado antes!

---

## ✅ Frases Recomendadas

Sempre use:
- ✅ "Aqui está minha proposta..."
- ✅ "Podemos fazer de duas formas..."
- ✅ "Qual abordagem você prefere?"
- ✅ "Posso prosseguir com isso?"
- ✅ "Isso atende o que você precisa?"

---

## 🎓 Resumo

### Regra de Ouro:
> **"Nenhum código é criado sem aprovação explícita"**

### Mantra:
> **"Explicar → Propor → Perguntar → Aguardar → Implementar"**

### Princípio:
> **"O desenvolvedor sempre tem a palavra final"**

---

## 📞 Em Caso de Dúvida

Se estiver em dúvida sobre qualquer coisa:
1. **PARE**
2. **PERGUNTE**
3. **AGUARDE**
4. **NÃO ASSUMA**

É melhor perguntar demais do que assumir e errar.

---

## 🔄 Atualização destas Diretrizes

Este documento pode ser atualizado pelo desenvolvedor.
Claude deve seguir SEMPRE a versão mais recente.

Última atualização: 2025-10-20
Status: ✅ Ativo e obrigatório

---

**Este documento é OBRIGATÓRIO e deve ser seguido em TODAS as interações de desenvolvimento.**
