# Checklist de Testes Manuais - Rota Mestre

## Como Usar Este Checklist

1. **Abra o app** (web ou mobile)
2. **Siga os passos** de cada seção
3. **Marque ✅** quando funcionar corretamente
4. **Marque ❌** quando encontrar problema
5. **Anote os detalhes** de qualquer erro encontrado

---

## 🔐 AUTENTICAÇÃO

### Teste 1: Login com Credenciais Válidas
**Plataformas:** Web, Android, iOS

**Passos:**
1. [ ] Abra a tela de login
2. [ ] Digite email válido: `seu-email@exemplo.com`
3. [ ] Digite senha válida
4. [ ] Clique em "Entrar"

**Resultado Esperado:**
- [ ] Usuário é redirecionado para dashboard
- [ ] Nome do usuário aparece no topo
- [ ] Sessão persiste ao recarregar

**Observações:**
```
Data do teste: ___/___/___
Plataforma: [ ] Web  [ ] Android  [ ] iOS
Status: [ ] ✅ Passou  [ ] ❌ Falhou
Notas: _________________________________
```

---

### Teste 2: Login com Credenciais Inválidas
**Plataformas:** Web, Android, iOS

**Passos:**
1. [ ] Abra a tela de login
2. [ ] Digite email: `invalido@teste.com`
3. [ ] Digite senha: `senhaerrada123`
4. [ ] Clique em "Entrar"

**Resultado Esperado:**
- [ ] Mensagem de erro clara é exibida
- [ ] Usuário permanece na tela de login
- [ ] Campos não são limpos automaticamente

**Observações:**
```
Data do teste: ___/___/___
Mensagem de erro recebida: _________________________________
Status: [ ] ✅ Passou  [ ] ❌ Falhou
```

---

### Teste 3: Recuperação de Senha
**Plataformas:** Web, Android, iOS

**Passos:**
1. [ ] Na tela de login, clique em "Esqueceu a senha?"
2. [ ] Verifique se abre a tela de recuperação
3. [ ] Digite email válido cadastrado
4. [ ] Clique em "Enviar Link"
5. [ ] Verifique a mensagem de sucesso

**Resultado Esperado:**
- [ ] Tela de recuperação abre corretamente
- [ ] Layout está correto (desktop: split-screen, mobile: logo-top)
- [ ] Mensagem de sucesso é exibida
- [ ] Email é recebido em até 5 minutos

**Email Recebido:**
- [ ] Email chegou na caixa de entrada
- [ ] Remetente é: `no-reply@rotamestre.tec.br`
- [ ] Design do email está profissional
- [ ] Link do email funciona

**Observações:**
```
Data do teste: ___/___/___
Tempo para receber email: _____ minutos
Status: [ ] ✅ Passou  [ ] ❌ Falhou
```

---

### Teste 4: Reset de Senha (após clicar no link do email)
**Plataformas:** Web, Android, iOS

**Passos:**
1. [ ] Clique no link recebido no email
2. [ ] Verifique se abre a tela de reset (não login!)
3. [ ] Digite nova senha: `NovaS3nh4!`
4. [ ] Digite confirmação: `NovaS3nh4!`
5. [ ] Clique em "Redefinir Senha"
6. [ ] Verifique se redireciona para login
7. [ ] Faça login com a nova senha

**Resultado Esperado:**
- [ ] Tela de reset abre corretamente
- [ ] Layout está correto (mesmo padrão das outras telas)
- [ ] Validação de senha mínima (8 caracteres) funciona
- [ ] Validação de senhas coincidentes funciona
- [ ] Mensagem de sucesso é exibida
- [ ] Login com nova senha funciona

**Teste de Validações:**
- [ ] Senha com menos de 8 caracteres é rejeitada
- [ ] Senhas diferentes são rejeitadas
- [ ] Campo vazio é rejeitado

**Observações:**
```
Data do teste: ___/___/___
Deep link funcionou? [ ] Sim  [ ] Não
Status: [ ] ✅ Passou  [ ] ❌ Falhou
```

---

### Teste 5: Logout
**Plataformas:** Web, Android, iOS

**Passos:**
1. [ ] Faça login normalmente
2. [ ] Localize botão de logout (sidebar/menu)
3. [ ] Clique em "Sair"
4. [ ] Verifique redirecionamento para login

**Resultado Esperado:**
- [ ] Usuário é deslogado
- [ ] Redireciona para tela de login
- [ ] Sessão é limpa (não faz login automático ao recarregar)
- [ ] AsyncStorage/cookies são limpos

**Observações:**
```
Data do teste: ___/___/___
Status: [ ] ✅ Passou  [ ] ❌ Falhou
```

---

## 📱 RESPONSIVIDADE E UI

### Teste 6: Layout Desktop (>1024px)
**Plataforma:** Web (Desktop)

**Telas para testar:**
- [ ] Login - Split screen (azul + branco)
- [ ] Forgot Password - Split screen
- [ ] Reset Password - Split screen
- [ ] Dashboard - Sidebar + conteúdo principal

**Resultado Esperado:**
- [ ] Layout split-screen funciona corretamente
- [ ] Painel azul ocupa 50% da tela
- [ ] Formulário está centralizado e não ultrapassa 480px
- [ ] Logo e branding visíveis no painel azul
- [ ] Sem scroll horizontal

---

### Teste 7: Layout Mobile (<768px)
**Plataforma:** Web (Mobile), Android, iOS

**Telas para testar:**
- [ ] Login - Logo horizontal no topo
- [ ] Forgot Password - Logo horizontal no topo
- [ ] Reset Password - Logo horizontal no topo
- [ ] Dashboard - Menu hamburguer

**Resultado Esperado:**
- [ ] Logo horizontal aparece no topo
- [ ] Formulário ocupa largura da tela (com padding 24px)
- [ ] Botões têm tamanho adequado para touch
- [ ] Texto legível sem zoom
- [ ] Sem elementos cortados

---

## 🗺️ FUNCIONALIDADES DO GESTOR

### Teste 8: Criar Nova Rota
**Acesso:** Gestor apenas

**Passos:**
1. [ ] Faça login como gestor
2. [ ] Navegue para "Rotas"
3. [ ] Clique em "Nova Rota"
4. [ ] Preencha título: "Rota Teste 1"
5. [ ] Adicione 3 paradas
6. [ ] Salve a rota

**Resultado Esperado:**
- [ ] Formulário abre corretamente
- [ ] Pode adicionar múltiplas paradas
- [ ] Rota é salva no banco
- [ ] Aparece na listagem

---

### Teste 9: Otimizar Rota
**Acesso:** Gestor apenas

**Passos:**
1. [ ] Selecione uma rota existente
2. [ ] Clique em "Otimizar"
3. [ ] Verifique o cálculo da rota otimizada

**Resultado Esperado:**
- [ ] Google Maps API é chamada
- [ ] Rota otimizada é exibida no mapa
- [ ] Tempo estimado aparece
- [ ] Distância total aparece

---

## 📍 FUNCIONALIDADES DO MOTORISTA

### Teste 10: Visualizar Rota Atribuída
**Acesso:** Motorista apenas

**Passos:**
1. [ ] Faça login como motorista
2. [ ] Verifique rota do dia
3. [ ] Abra detalhes da rota

**Resultado Esperado:**
- [ ] Dashboard mostra rota atribuída
- [ ] Paradas aparecem em ordem
- [ ] Mapa exibe rota completa

---

### Teste 11: Iniciar Rastreamento
**Acesso:** Motorista apenas
**Requer:** Permissões de localização

**Passos:**
1. [ ] Abra rota atribuída
2. [ ] Clique em "Iniciar Rota"
3. [ ] Aceite permissões de localização
4. [ ] Verifique se localização está sendo enviada

**Resultado Esperado:**
- [ ] App solicita permissão de localização
- [ ] Localização é capturada a cada X segundos
- [ ] Gestor vê motorista no mapa (teste em paralelo)
- [ ] Marcador do motorista se move no mapa

---

## 🔄 INTEGRAÇÃO E PERFORMANCE

### Teste 12: Persistência de Sessão
**Plataformas:** Web, Android, iOS

**Passos:**
1. [ ] Faça login normalmente
2. [ ] **Web:** Recarregue a página (F5)
3. [ ] **Mobile:** Feche e abra o app
4. [ ] Verifique se permanece logado

**Resultado Esperado:**
- [ ] Usuário permanece logado após reload/reopen
- [ ] Não precisa fazer login novamente
- [ ] Dados do usuário são mantidos

---

### Teste 13: Deep Links
**Plataformas:** Android, iOS

**Links para testar:**
```bash
# Teste 1: Reset password
rotamestre://reset-password

# Teste 2: Dashboard (futuro)
rotamestre://gestor/dashboard
```

**Passos:**
1. [ ] Envie o deep link via ADB/email
2. [ ] Clique no link
3. [ ] Verifique se o app abre na tela correta

**Resultado Esperado:**
- [ ] App abre automaticamente
- [ ] Navega para tela correta
- [ ] Mantém contexto de autenticação

---

### Teste 14: Performance - Tempo de Carregamento
**Plataformas:** Web, Android, iOS

**Métricas:**
- [ ] Login → Dashboard: _____ segundos (meta: <2s)
- [ ] Listagem de rotas: _____ segundos (meta: <1s)
- [ ] Abrir mapa: _____ segundos (meta: <3s)
- [ ] Otimizar rota: _____ segundos (meta: <5s)

**Observações:**
```
Conexão: [ ] Wi-Fi  [ ] 4G  [ ] 3G
Dispositivo: _________________________________
```

---

## 🐛 TESTES DE ERRO

### Teste 15: Conexão Perdida Durante Operação
**Passos:**
1. [ ] Inicie uma operação (ex: criar rota)
2. [ ] Desligue Wi-Fi/dados móveis
3. [ ] Tente salvar

**Resultado Esperado:**
- [ ] Mensagem de erro clara ("Sem conexão")
- [ ] Dados não são perdidos
- [ ] Pode tentar novamente quando conexão volta

---

### Teste 16: Token Expirado
**Passos:**
1. [ ] Faça login
2. [ ] Espere 1 hora (ou force expiração no banco)
3. [ ] Tente fazer uma operação

**Resultado Esperado:**
- [ ] App detecta token expirado
- [ ] Redireciona para login
- [ ] Mensagem clara de "Sessão expirada"

---

## 📝 TEMPLATE DE RELATÓRIO DE BUG

Quando encontrar um bug, anote:

```markdown
### Bug #___

**Título:** _______________________________

**Severidade:** [ ] Crítico  [ ] Alto  [ ] Médio  [ ] Baixo

**Plataforma:** [ ] Web  [ ] Android  [ ] iOS

**Passos para Reproduzir:**
1.
2.
3.

**Resultado Esperado:**


**Resultado Atual:**


**Screenshots/Logs:**
(anexar)

**Informações do Sistema:**
- Navegador/Dispositivo: _______
- Versão do App: _______
- Versão do SO: _______

**Data:** ___/___/___
```

---

## 📊 RESUMO DE TESTES

| Teste | Web | Android | iOS | Status |
|-------|-----|---------|-----|--------|
| Login válido | [ ] | [ ] | [ ] | |
| Login inválido | [ ] | [ ] | [ ] | |
| Recuperar senha | [ ] | [ ] | [ ] | |
| Reset senha | [ ] | [ ] | [ ] | |
| Logout | [ ] | [ ] | [ ] | |
| Layout Desktop | [ ] | N/A | N/A | |
| Layout Mobile | [ ] | [ ] | [ ] | |
| Criar rota | [ ] | [ ] | [ ] | |
| Otimizar rota | [ ] | [ ] | [ ] | |
| Rastreamento | [ ] | [ ] | [ ] | |
| Persistência | [ ] | [ ] | [ ] | |
| Deep links | N/A | [ ] | [ ] | |
| Performance | [ ] | [ ] | [ ] | |

---

## 🎯 PRÓXIMOS PASSOS

Após completar todos os testes:

1. **Consolidar bugs encontrados**
2. **Priorizar correções** (críticos primeiro)
3. **Criar issues no GitHub** (se aplicável)
4. **Documentar workarounds temporários**
5. **Planejar próximo ciclo de testes**

---

**Testado por:** _______________________________
**Data:** ___/___/___
**Versão do App:** _______________________________
