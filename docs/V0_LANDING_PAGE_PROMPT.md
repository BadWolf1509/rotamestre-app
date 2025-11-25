# 🚀 RotaMestre - Prompts para V0 (Claude Opus 4.5)

## 📝 Prompt 1: Landing Page Completa

```
Crie uma landing page moderna e profissional para o Rota Mestre, um sistema B2B SaaS de otimização e gestão de rotas. Use Next.js 15, React 19, TypeScript, Tailwind CSS 4 e shadcn/ui.

## IDENTIDADE VISUAL
- Cores primárias: #284093 (azul escuro), #FF8C42 (laranja vibrante)
- Fonte: Inter para textos, Poppins para títulos
- Logo: Texto "Rota Mestre" com ícone de rota/mapa estilizado
- Estilo: Clean, profissional, moderno com gradientes suaves

## ESTRUTURA DA PÁGINA

### 1. HERO SECTION
Título: "Economize até 30% em combustível com rotas inteligentes"
Subtítulo: "O RotaMestre otimiza automaticamente suas rotas de entrega, reduzindo custos e aumentando a eficiência da sua operação logística"
CTA Principal: "Teste Grátis por 7 Dias"
CTA Secundário: "Assistir Demonstração"
Imagem/Animação: Dashboard do app mostrando mapa com rotas otimizadas

### 2. BARRA DE CONFIANÇA
Logos/menções: "Usado por mais de 50 empresas" | "97% de satisfação" | "3h economizadas por dia"

### 3. PROBLEMA & SOLUÇÃO
Título: "Você ainda planeja rotas manualmente?"
Problemas (com ícones):
- ❌ Gasta horas planejando rotas diariamente
- ❌ Combustível desperdiçado com trajetos ineficientes
- ❌ Sem visibilidade do status das entregas
- ❌ Dificuldade para gerenciar múltiplos motoristas

Solução: "Com Rota Mestre, tudo isso é resolvido automaticamente"

### 4. FUNCIONALIDADES (Cards com ícones)
- **Otimização Automática**: Algoritmo inteligente que define a melhor sequência de paradas
- **Rastreamento em Tempo Real**: Acompanhe cada entrega no mapa ao vivo
- **App para Motoristas**: Navegação turn-by-turn integrada com Waze/Google Maps
- **Fotos de Comprovação**: Registre entregas com fotos georreferenciadas
- **Gestão de Equipe**: Atribua rotas e monitore performance dos motoristas
- **Relatórios Detalhados**: Analytics completo com métricas de eficiência

### 5. COMO FUNCIONA (Timeline visual)
1. **Cadastre suas entregas**: Adicione endereços manualmente ou importe planilha
2. **Sistema otimiza a rota**: IA calcula melhor sequência economizando até 30% combustível
3. **Motorista recebe no app**: Rota aparece instantaneamente no celular do motorista
4. **Acompanhe em tempo real**: Veja progresso e receba notificações de conclusão

### 6. PLANOS E PREÇOS (Tabela comparativa)
**BÁSICO** R$ 149/mês
- Até 5 motoristas
- 100 rotas/mês
- Suporte por email

**PROFISSIONAL** R$ 299/mês (mais popular)
- Até 20 motoristas
- Rotas ilimitadas
- Integração com ERP
- Suporte prioritário

**ENTERPRISE** Personalizado
- Motoristas ilimitados
- API completa
- Treinamento incluído
- Suporte dedicado

### 7. DEPOIMENTOS (Carousel)
"Reduzi 35% dos custos com combustível no primeiro mês!" - João Silva, WJX Locações
"Interface intuitiva, motoristas aprenderam em minutos" - Maria Santos, Distribuidora ABC
"ROI em menos de 2 meses. Ferramenta indispensável!" - Pedro Costa, LogTech Solutions

### 8. FAQ
- Como funciona o período de teste?
- Preciso instalar algo no computador?
- Funciona em qualquer celular?
- Posso importar rotas do Excel?
- Tem limite de paradas por rota?
- Como faço integração com meu sistema?

### 9. CTA FINAL
Box destacado: "Comece a economizar hoje mesmo"
Botão: "Iniciar Teste Grátis"
Texto: "Não precisa cartão de crédito • Configuração em 5 minutos"

### 10. FOOTER
- Links: Sobre | Blog | Ajuda | API Docs | Status
- Contato: contato@rotamestre.tec.br | WhatsApp
- Legal: Termos de Uso | Política de Privacidade | LGPD
- Social: LinkedIn | Instagram | YouTube
- Selo: "Desenvolvido no Brasil 🇧🇷"

## ELEMENTOS TÉCNICOS
- Animações suaves com Framer Motion
- Otimizado para SEO com meta tags
- Responsive design (mobile-first)
- Loading lazy para imagens
- Forms com react-hook-form + zod
- Analytics com Google Analytics 4
- Chat widget para suporte (Crisp ou similar)
- Schema.org markup para rich snippets

## COPY ADICIONAL PARA DIFERENTES SEÇÕES
Use linguagem direta, benefícios claros, números específicos. Tom profissional mas acessível. Evite jargões técnicos desnecessários. Foque em resultados e economia.
```

---

## 📝 Prompt 2: Página de Política de Privacidade

```
Crie uma página de Política de Privacidade completa e em conformidade com a LGPD para o Rota Mestre. Use o mesmo stack tecnológico da landing page (Next.js, React, TypeScript, Tailwind CSS).

## INFORMAÇÕES DA EMPRESA
Nome: Rota Mestre Tecnologia Ltda
CNPJ: [A ser definido]
Endereço: [A ser definido]
Email DPO: privacidade@rotamestre.tec.br
Site: https://rotamestre.tec.br

## ESTRUTURA DO DOCUMENTO

### 1. INTRODUÇÃO
Data de vigência e última atualização
Compromisso com privacidade e LGPD
Como entrar em contato sobre privacidade

### 2. DADOS COLETADOS
Categorize por tipo de usuário:

**Gestores/Administradores:**
- Nome completo, CPF, email, telefone
- Nome da empresa, CNPJ
- Dados de acesso (login, senha criptografada)
- Logs de atividade no sistema
- IP e informações do dispositivo

**Motoristas:**
- Nome, telefone, email
- Localização GPS (apenas durante execução de rotas)
- Fotos de comprovação de entrega
- Horários de início/fim de rotas
- Histórico de rotas realizadas

**Dados de Rotas:**
- Endereços de entrega/coleta
- Nomes e telefones de destinatários
- Observações sobre entregas
- Coordenadas geográficas
- Timestamps de todas ações

### 3. COMO COLETAMOS
- Formulários de cadastro
- Aplicativo móvel (GPS, câmera com permissão)
- Cookies e tecnologias similares
- Integrações com APIs de terceiros (Google Maps)
- Logs automáticos do sistema

### 4. FINALIDADE DO USO
- Prestação do serviço de otimização de rotas
- Rastreamento e comprovação de entregas
- Comunicação sobre o serviço
- Melhorias no produto baseadas em uso
- Suporte técnico e atendimento
- Cumprimento de obrigações legais
- Prevenção de fraudes e segurança

### 5. COMPARTILHAMENTO
Deixar claro que dados NÃO são vendidos. Compartilhamos apenas com:
- Supabase (banco de dados - USA)
- Google Maps API (geolocalização - USA)
- Vercel (hospedagem - USA)
- Autoridades quando requerido por lei
- Processadores de pagamento (quando aplicável)

### 6. ARMAZENAMENTO E SEGURANÇA
- Dados armazenados em servidores Supabase (PostgreSQL)
- Criptografia em trânsito (HTTPS/TLS)
- Criptografia em repouso para dados sensíveis
- Controle de acesso baseado em roles
- Backups automáticos diários
- Monitoramento de segurança 24/7

### 7. RETENÇÃO DE DADOS
- Dados de conta: mantidos enquanto conta ativa
- Logs de rotas: 2 anos para fins fiscais
- Fotos de entrega: 6 meses
- Dados de localização: 90 dias
- Após exclusão: anonimização em 30 dias

### 8. DIREITOS DOS TITULARES (LGPD)
Explicar cada direito e como exercer:
- Confirmação e acesso aos dados
- Correção de dados incompletos
- Anonimização ou bloqueio
- Portabilidade
- Eliminação
- Revogação do consentimento
- Informação sobre compartilhamento
- Revisão de decisões automatizadas

### 9. COOKIES E RASTREAMENTO
- Cookies essenciais (sessão, autenticação)
- Cookies de análise (Google Analytics)
- Como desabilitar cookies
- Pixel de rastreamento para marketing

### 10. MENORES DE IDADE
Declarar que serviço é para maiores de 18 anos

### 11. TRANSFERÊNCIA INTERNACIONAL
Explicar que usamos serviços dos EUA com adequações de segurança

### 12. ALTERAÇÕES NA POLÍTICA
Como usuários são notificados de mudanças

### 13. CONSENTIMENTO
Como consentimento é obtido e pode ser revogado

### 14. CONTATO E DPO
Email: privacidade@rotamestre.tec.br
Formulário de solicitação LGPD
Prazo de resposta: 15 dias úteis

### 15. BASE LEGAL
- Lei 13.709/2018 (LGPD)
- Marco Civil da Internet
- Código de Defesa do Consumidor

## DESIGN DA PÁGINA
- Layout clean e legível
- Índice lateral fixo para navegação
- Botão "Aceitar" flutuante para primeiro acesso
- Versão para impressão/PDF
- Histórico de versões
- Última atualização destacada
- Busca dentro do documento
- Modo escuro opcional

## ELEMENTOS ADICIONAIS
- FAQ sobre privacidade
- Glossário de termos
- Links para configurações de privacidade
- Badge de conformidade LGPD
```

---

## 🎨 Instruções Adicionais para o V0

### Configuração Inicial
1. Use o template mais recente do Next.js com App Router
2. Configure Tailwind CSS com as cores customizadas acima
3. Instale e configure shadcn/ui
4. Use componentes server-side quando possível

### Responsividade
- Mobile-first approach
- Breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Menu hamburguer no mobile
- Cards empilhados em telas pequenas

### Performance
- Imagens otimizadas com next/image
- Fonts com next/font
- Lazy loading para seções below the fold
- Prefetch de links internos

### SEO
```jsx
// Meta tags essenciais
<title>RotaMestre - Otimização Inteligente de Rotas de Entrega</title>
<meta name="description" content="Economize até 30% em combustível com rotas otimizadas. Sistema de gestão de entregas com rastreamento em tempo real. Teste grátis por 7 dias."/>
<meta property="og:image" content="/og-image.jpg"/>
```

### Formulário de Contato/Trial
Campos:
- Nome completo*
- Email corporativo*
- Telefone/WhatsApp*
- Nome da empresa*
- Número de motoristas
- Volume mensal de entregas
- Como conheceu o RotaMestre?

### Integrações
- Google Analytics 4 (gtag)
- Google Tag Manager
- Meta Pixel (Facebook)
- Hotjar ou Clarity para heatmaps
- Webhook para Slack/Discord em novos leads

### Páginas Adicionais Sugeridas
1. `/sobre` - História e missão
2. `/blog` - Conteúdo sobre logística
3. `/recursos` - Tutoriais e guias
4. `/api-docs` - Documentação técnica
5. `/status` - Status page do sistema
6. `/parceiros` - Programa de parceria
7. `/casos-de-sucesso` - Case studies

### Deploy
- Vercel com preview deployments
- Domínio: rotamestre.tec.br
- SSL configurado
- CDN automático do Vercel

---

## 📱 Versão Mobile da Landing

Adapte para mobile com:
- Hero mais compacto
- Swiper para depoimentos
- Accordion para FAQ
- Tabs para planos
- Botão WhatsApp flutuante
- Menu drawer lateral