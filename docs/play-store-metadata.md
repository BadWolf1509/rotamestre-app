# Play Store Metadata - Rota Mestre

> **Atualizado 2026-06-16:** o package correto é **`br.tec.rotamestre.app`** (o `br.tec.rotamestre` antigo ficou preso na conta perdida). Este doc é a **cópia da listagem** (textos / keywords / permissões); o **processo de publicação + estado do rollout** estão em [GOOGLE_PLAY_DEPLOYMENT.md](GOOGLE_PLAY_DEPLOYMENT.md) e [REBUILD_RELAUNCH_PLAN.md](REBUILD_RELAUNCH_PLAN.md).

## Informações Básicas

- **Nome do App:** Rota Mestre
- **Package Name:** br.tec.rotamestre.app
- **Categoria:** Empresas
- **Categoria Secundária:** Mapas e navegação
- **Tags:** logística, entregas, rotas, motorista, gestão, delivery

---

## Listagem da Loja

### Título (máx 30 caracteres)

```
Rota Mestre
```

### Descrição Breve (máx 80 caracteres)

```
Otimize rotas de entrega, economize combustível e acompanhe motoristas.
```

### Descrição Completa (máx 4000 caracteres)

```
Rota Mestre é a solução completa para gestão e otimização de rotas de entrega. Ideal para empresas de logística, locadoras de equipamentos e qualquer negócio que precise gerenciar entregas de forma eficiente.

🚛 PARA GESTORES:
• Crie rotas otimizadas com múltiplas paradas
• Sistema de autocompletar endereços inteligente
• Otimização automática da ordem das entregas
• Atribua rotas aos seus motoristas em segundos
• Acompanhe o progresso das entregas em tempo real
• Visualize histórico completo com fotos de comprovação
• Gerencie sua equipe de motoristas

🚗 PARA MOTORISTAS:
• Receba rotas já otimizadas no seu celular
• Navegação integrada com Waze e Google Maps
• Marque entregas como concluídas com um toque
• Tire fotos de comprovação de entrega
• Interface simples e intuitiva

💰 BENEFÍCIOS:
• Economize até 30% em combustível com rotas otimizadas
• Reduza em 3 horas o tempo diário de planejamento
• Tenha controle total sobre suas operações de entrega
• Comprove entregas com fotos armazenadas na nuvem

O Rota Mestre foi desenvolvido especialmente para empresas brasileiras, com interface em português e suporte local.

✅ Teste grátis por 7 dias. Sem compromisso.

Dúvidas? Entre em contato: contato@rotamestre.tec.br
```

---

## URLs Obrigatórias

| Campo                   | URL                                               |
| ----------------------- | ------------------------------------------------- |
| Website                 | https://rotamestre.tec.br                         |
| Política de Privacidade | https://rotamestre.tec.br/politica-de-privacidade |
| Email de Contato        | contato@rotamestre.tec.br                         |

---

## Assets Gráficos

### Obrigatórios

| Asset               | Tamanho       | Status           |
| ------------------- | ------------- | ---------------- |
| Ícone do App        | 512 x 512 px  | ✅ Usar icon.png |
| Feature Graphic     | 1024 x 500 px | ❌ CRIAR         |
| Screenshots (mín 2) | Variável      | ❌ CRIAR         |

### Feature Graphic (Banner)

- **Tamanho:** 1024 x 500 px
- **Formato:** PNG ou JPEG
- **Dicas:**
  - Usar cores da marca (Azul #284093, Laranja #f7a02a)
  - Incluir logo e tagline
  - Evitar texto pequeno (fica ilegível no celular)

**Sugestão de layout:**

```
[Logo Rota Mestre]     [Mockup do app]
"Otimize suas entregas"
```

### Screenshots

| Tamanho        | Dispositivo             |
| -------------- | ----------------------- |
| 1080 x 1920 px | Celulares (obrigatório) |
| 1200 x 1920 px | Tablets 7" (opcional)   |
| 1600 x 2560 px | Tablets 10" (opcional)  |

**Telas recomendadas (mínimo 4, máximo 8):**

1. Tela de Login
2. Dashboard do Gestor
3. Criar Rota (autocomplete)
4. Mapa com Rota Otimizada
5. Lista de Paradas (Motorista)
6. Navegação Integrada
7. Foto de Comprovação
8. Histórico de Entregas

---

## Classificação de Conteúdo

### Questionário IARC

| Pergunta                     | Resposta           |
| ---------------------------- | ------------------ |
| Violência                    | Não                |
| Referências sexuais          | Não                |
| Linguagem ofensiva           | Não                |
| Substâncias controladas      | Não                |
| Jogos de azar                | Não                |
| Compras no app               | Não (por enquanto) |
| Compartilha localização      | **Sim**            |
| Conteúdo gerado por usuários | Não                |

**Classificação esperada:** Livre para todas as idades

---

## Permissões (Justificativas)

### Localização (ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION)

**Justificativa:**
"O app usa localização para mostrar a posição do motorista no mapa durante entregas e permitir que gestores acompanhem o progresso em tempo real."

### Câmera (CAMERA)

**Justificativa:**
"Motoristas usam a câmera para tirar fotos de comprovação de entrega."

### Internet (INTERNET)

**Justificativa:**
"Necessário para sincronizar rotas, paradas e fotos com o servidor."

---

## Configuração do App

### Países

- [x] Brasil (principal)
- [ ] Portugal
- [ ] Outros países lusófonos

### Dispositivos

- [x] Celulares
- [x] Tablets
- [ ] Android TV
- [ ] Wear OS
- [ ] Chromebooks

### Preço

- **Tipo:** Gratuito (com planos de assinatura futuros)

---

## Release Notes (O que há de novo)

### Versão 1.9.0

```
• Novo sistema de checkpoints para motoristas
• Upload de fotos de comprovação melhorado
• Otimização de rotas mais rápida
• Correções de bugs e melhorias de performance
```

---

## Processo de Publicação

### 1. Criar conta Google Play Developer

- Acesse: https://play.google.com/console
- Taxa única: $25 USD
- Aprovação: Imediata

### 2. Criar o app no Console

1. Acesse Play Console → Criar app
2. Preencha nome, idioma, tipo (app), categoria
3. Aceite as declarações

### 3. Preencher Ficha da Loja

1. Dashboard do app → Ficha da loja principal
2. Adicione título, descrições, ícone, screenshots
3. Adicione Feature Graphic

### 4. Classificação de Conteúdo

1. Política e programas → Classificação de conteúdo
2. Responda o questionário IARC
3. Receba a classificação

### 5. Configurar Preços e Distribuição

1. Monetização → Preço do app
2. Selecione "Gratuito"
3. Selecione países

### 6. Criar Service Account Key (para EAS Submit)

1. Google Cloud Console → IAM e Admin → Contas de serviço
2. Crie conta de serviço com papel "Editor"
3. Gere chave JSON
4. Salve como `play-store-credentials.json` na raiz do projeto
5. **IMPORTANTE:** Adicione ao .gitignore!

### 7. Build e Submit

```bash
# Gerar AAB (App Bundle)
eas build --platform android --profile production

# Submeter para Play Store
eas submit --platform android --profile production
```

### 8. Revisão

- Primeira revisão: 1-3 dias úteis
- Atualizações: Geralmente em horas

---

## Checklist Final

- [ ] Conta Google Play Developer criada ($25)
- [ ] App criado no Play Console
- [ ] Feature Graphic 1024x500 criado
- [ ] Mínimo 4 screenshots
- [ ] Descrições preenchidas
- [ ] Classificação de conteúdo respondida
- [ ] Política de Privacidade linkada
- [ ] Service Account Key gerada
- [ ] `play-store-credentials.json` salvo (e no .gitignore!)
- [ ] Build AAB gerado
- [ ] App submetido para revisão

---

## Dicas Importantes

1. **Primeira submissão é mais demorada** - Google revisa manualmente
2. **Não mencione iOS** na descrição - Google rejeita
3. **Feature Graphic é obrigatório** - Sem ele, não publica
4. **Teste em dispositivos reais** antes de submeter
5. **Mantenha screenshots atualizados** - Melhora conversão
