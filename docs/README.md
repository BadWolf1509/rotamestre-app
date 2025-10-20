# 📚 Documentação - RotaMestre

**Visão Geral da Documentação Técnica do Projeto**

---

## 📁 Estrutura da Documentação

```
docs/
├── setup/              # Guias de instalação e configuração
├── development/        # Documentação técnica e arquitetura
├── testing/            # Guias de teste e QA
└── operations/         # Documentos operacionais
```

---

## 🚀 Guias Principais

### Para Começar

1. **[Deployment](setup/deployment.md)** - Como fazer deploy do app (mobile + web)
2. **[Deploy Web](setup/deploy-web.md)** - Deploy específico para web (Vercel/Netlify)
3. **[DNS Config](setup/dns-config.md)** - Configuração de DNS e domínios

### Desenvolvimento

4. **[Project Analysis](development/project-analysis.md)** - Análise técnica do projeto
5. **[Ecosystem](development/ecosystem.md)** - Visão geral do ecossistema RotaMestre
6. **[Implementation Plan](development/implementation-plan.md)** - Plano de implementação

### Testes

7. **[Create Test Users](testing/create-test-users.md)** - Como criar usuários de teste
8. **[MCP Test Report](testing/mcp-test-report.md)** - Relatório de testes do MCP
9. **[MCP Test Execution](testing/mcp-test-execution.md)** - Execução dos testes MCP

### Operações

10. **[DNS Status](operations/dns-status.md)** - Status ao vivo dos domínios
11. **[Email Update Summary](operations/email-update-summary.md)** - Histórico de updates

---

## 🎯 Início Rápido

### Novo Desenvolvedor

1. Clone o repositório
2. Leia [Project Analysis](development/project-analysis.md)
3. Configure ambiente seguindo [Deployment](setup/deployment.md)
4. Crie usuários de teste: [Create Test Users](testing/create-test-users.md)

### Deploy em Produção

1. Configure DNS: [DNS Config](setup/dns-config.md)
2. Deploy web: [Deploy Web](setup/deploy-web.md)
3. Deploy mobile: [Deployment](setup/deployment.md)
4. Valide: [DNS Status](operations/dns-status.md)

### Testes e QA

1. Configure usuários: [Create Test Users](testing/create-test-users.md)
2. Teste MCP: [MCP Test Execution](testing/mcp-test-execution.md)
3. Valide features: [MCP Test Report](testing/mcp-test-report.md)

---

## 📚 Índice por Categoria

### 🛠️ Setup & Configuration

| Documento | Descrição | Tempo |
|-----------|-----------|-------|
| [deployment.md](setup/deployment.md) | Deploy mobile (iOS/Android via EAS) e web | 30 min |
| [deploy-web.md](setup/deploy-web.md) | Deploy web específico (Vercel/Netlify) | 15 min |
| [vercel-domain-setup.md](setup/vercel-domain-setup.md) | Configurar domínio no Vercel | 10 min |
| [vercel-env-setup.md](setup/vercel-env-setup.md) | Variáveis de ambiente no Vercel | 5 min |
| [dns-config.md](setup/dns-config.md) | Configuração completa de DNS | 20 min |

### 💻 Development

| Documento | Descrição | Público |
|-----------|-----------|---------|
| [project-analysis.md](development/project-analysis.md) | Análise técnica detalhada | Devs |
| [ecosystem.md](development/ecosystem.md) | Arquitetura e componentes | Arquitetos |
| [implementation-plan.md](development/implementation-plan.md) | Roadmap de implementação | PM/Devs |

### 🧪 Testing & QA

| Documento | Descrição | Tipo |
|-----------|-----------|------|
| [create-test-users.md](testing/create-test-users.md) | Criar usuários no Supabase | Manual |
| [mcp-test-report.md](testing/mcp-test-report.md) | Relatório de testes MCP | Automático |
| [mcp-test-execution.md](testing/mcp-test-execution.md) | Execução dos testes MCP | Manual |

### 📊 Operations

| Documento | Descrição | Atualização |
|-----------|-----------|-------------|
| [dns-status.md](operations/dns-status.md) | Status dos domínios | Em tempo real |
| [email-update-summary.md](operations/email-update-summary.md) | Histórico de mudanças | Sob demanda |

---

## 🔗 Links Úteis

### Ambientes

- **App Web:** https://app.rotamestre.tec.br
- **Site:** https://rotamestre.tec.br
- **Docs:** https://docs.rotamestre.tec.br (futuro)
- **Painel:** https://painel.rotamestre.tec.br (futuro)
- **API:** https://api.rotamestre.tec.br

### Ferramentas

- **Supabase Dashboard:** https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd
- **Vercel Dashboard:** https://vercel.com/wellintonribeiro-projects
- **Expo Dashboard:** https://expo.dev/

### Repositórios

- **App:** github.com/seu-usuario/rotamestre-app
- **Docs:** github.com/seu-usuario/rotamestre-docs (futuro)

---

## 📞 Suporte

### Dúvidas Técnicas

Consulte a documentação relevante acima ou o README principal na raiz do projeto.

### Problemas e Bugs

1. Verifique os logs no Vercel/Expo
2. Consulte troubleshooting nos guias de deploy
3. Abra uma issue no GitHub

### Atualizações

Esta documentação é atualizada regularmente. Última atualização: 2025-10-20

---

**Navegação:**
- [← Voltar para Raiz](../README.md)
- [Setup →](setup/)
- [Development →](development/)
- [Testing →](testing/)
- [Operations →](operations/)
