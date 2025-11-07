# Como Testar o Módulo do Motorista

## 📱 Testando com Expo Go

### 1. Servidor Expo Rodando
O servidor Expo está rodando na porta **8084**: `http://localhost:8084`

### 2. Instalar Expo Go
- **Android**: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS**: [App Store](https://apps.apple.com/app/expo-go/id982107779)

### 3. Conectar ao Servidor
Existem 3 formas de conectar:

#### Opção A: QR Code
1. Abra o Expo Go no seu celular
2. Toque em "Scan QR Code"
3. Escaneie o QR code que aparece no terminal ou no navegador em `http://localhost:8084`

#### Opção B: URL Manual
1. Abra o Expo Go
2. Digite a URL: `exp://SEU_IP_LOCAL:8084`
3. Substitua `SEU_IP_LOCAL` pelo IP da sua máquina na rede local

#### Opção C: Tunnel (se na mesma rede não funcionar)
```bash
npx expo start --tunnel --port 8084
```

### 4. Fazer Login como Motorista
Para testar o módulo do motorista, você precisa:

1. **Criar uma conta de motorista** ou **fazer login** com uma conta existente
2. Certifique-se de que o tipo de usuário é **"motorista"**

**Credenciais de teste sugeridas**:
- Email: `motorista@teste.com`
- Senha: `123456`
- Tipo: Motorista

---

## 🧪 Checklist de Testes - 10 Features

### ✅ Feature 1: Foto Obrigatória
**Onde**: Aba "Paradas" > Qualquer parada pendente

**Como testar**:
1. Acesse a aba "Paradas"
2. Tente concluir uma parada SEM enviar foto
3. ✅ **Esperado**: Deve mostrar mensagem "É obrigatório enviar uma foto..."
4. Tire uma foto usando o botão "📷 Tirar Foto"
5. Tente concluir novamente
6. ✅ **Esperado**: Agora deve permitir conclusão

---

### ✅ Feature 2: Confirmação de Finalização
**Onde**: Aba "Paradas" > Após concluir última parada

**Como testar**:
1. Conclua todas as paradas (ou todas menos a última)
2. Conclua a última parada
3. ✅ **Esperado**: Deve aparecer diálogo "🎉 Última Parada Concluída!"
4. Deve ter opções "Não, revisar depois" e "Sim, Finalizar Rota"
5. Teste ambas as opções em momentos diferentes

---

### ✅ Feature 3: Validação de Ordem
**Onde**: Aba "Paradas"

**Como testar**:
1. Tente concluir a parada #3 sem ter concluído #1 e #2
2. ✅ **Esperado**: Deve mostrar aviso "Você deve concluir as paradas anteriores primeiro: #1, #2"
3. Deve ter opção "Pular e Concluir Assim Mesmo" para casos excepcionais
4. Teste concluir na ordem correta (1→2→3)

---

### ✅ Feature 4: Modo Offline
**Onde**: Todas as telas

**Como testar**:
1. Ative o modo avião no celular
2. Tente concluir uma parada
3. ✅ **Esperado**: Deve ser adicionada à fila offline (sem erro visível)
4. Desative o modo avião
5. ✅ **Esperado**: Dados devem ser sincronizados automaticamente
6. Verifique no servidor se a parada foi realmente concluída

**Nota**: Fotos não funcionam offline (limitação conhecida)

---

### ✅ Feature 5: Botão SOS
**Onde**: Header de todas as telas do motorista (canto superior direito)

**Como testar**:
1. Procure o botão vermelho "🚨 SOS" no header
2. Toque no botão
3. ✅ **Esperado**: Deve mostrar diálogo com opções:
   - "Ligar para Central" (abre discador)
   - "Enviar Localização" (envia log ao servidor)
4. Teste ambas as opções

---

### ✅ Feature 6: Distância Próxima Parada
**Onde**: Aba "Rota Atual"

**Como testar**:
1. Acesse a aba "Rota Atual"
2. Role até a seção "📍 Próxima Parada"
3. ✅ **Esperado**: Deve mostrar:
   - "Parada #X está a Y km de você"
   - "~Z min de viagem"
4. Mova-se fisicamente e veja se a distância atualiza (pode demorar)

**Nota**: Requer permissão de localização concedida

---

### ✅ Feature 7: Reabrir Parada
**Onde**: Aba "Paradas" > Paradas concluídas

**Como testar**:
1. Conclua uma parada qualquer
2. Procure o botão "↩️ Reabrir" na parada concluída
3. Toque em "Reabrir"
4. ✅ **Esperado**: Deve mostrar confirmação
5. Confirme a reabertura
6. ✅ **Esperado**: Parada volta para status "pendente"

---

### ✅ Feature 8: Mapa Interativo
**Onde**: Nova aba "Mapa"

**Como testar**:
1. Acesse a aba "Mapa" (terceira aba)
2. ✅ **Esperado**: Deve mostrar:
   - Mapa com todas as paradas marcadas
   - Marcadores coloridos:
     - 🟢 Verde = Concluída
     - 🟡 Amarelo = Pulada
     - 🔴 Vermelho = Pendente
   - Linha tracejada conectando as paradas
   - Sua localização atual (ponto azul pulsando)
3. Teste os botões flutuantes:
   - 🎯 Centralizar nas paradas
   - 🧭 Seguir minha localização
4. Toque nos marcadores para ver detalhes

---

### ✅ Feature 9: Tempo Estimado
**Onde**: Aba "Rota Atual"

**Como testar**:
1. Acesse a aba "Rota Atual"
2. Procure a seção "⏱️ Tempo Estimado"
3. ✅ **Esperado**: Deve mostrar 3 informações:
   - "Total restante" (ex: 2h 30min)
   - "Previsão conclusão" (ex: 14:30)
   - "Distância" (ex: 45.3 km)
4. Conclua uma parada e volte para ver se os valores diminuem
5. Verifique se a previsão de horário faz sentido

**Nota**: Requer paradas pendentes e localização ativa

---

### ✅ Feature 10: Observações do Motorista
**Onde**: Aba "Paradas" > Botão "💬 Observações"

**Como testar**:
1. Acesse uma parada qualquer
2. Toque no botão "💬 Observações"
3. ✅ **Esperado**: Deve abrir modal com campo de texto
4. Digite algo como "Cliente ausente, deixei com vizinho"
5. Salve
6. ✅ **Esperado**: Observação deve ser salva e aparecer na parada
7. Reabra a observação para ver o texto salvo

---

## 🔍 Teste de Integração Completo

### Fluxo de Trabalho Completo
Execute este fluxo para testar todas as features juntas:

1. **Login**
   - Faça login como motorista

2. **Visualizar Rota** (Aba "Rota Atual")
   - ✅ Veja o progresso (0%)
   - ✅ Veja tempo estimado total
   - ✅ Veja distância até próxima parada
   - Toque em "🚚 Iniciar Rota"

3. **Ver Mapa** (Aba "Mapa")
   - ✅ Veja todas as paradas no mapa
   - ✅ Identifique onde você está
   - ✅ Planeje mentalmente a rota

4. **Executar Parada 1** (Aba "Paradas")
   - Toque em "🧭 Como Chegar" (abre navegação)
   - Navegue até o local (ou simule)
   - ✅ Adicione observação: "Cliente muito atencioso"
   - ✅ Tire foto do comprovante
   - ✅ Conclua a parada

5. **Testar Ordem** (Aba "Paradas")
   - ✅ Tente concluir parada #3 sem fazer #2
   - Deve bloquear com aviso
   - Opcionalmente force a conclusão

6. **Testar Offline** (Aba "Paradas")
   - ✅ Ative modo avião
   - Conclua parada #2
   - Desative modo avião
   - Verifique sincronização

7. **Emergência** (Qualquer tela)
   - ✅ Toque no botão SOS
   - Teste enviar localização

8. **Reabrir Parada** (Aba "Paradas")
   - ✅ Reabra a parada #1
   - Conclua novamente

9. **Finalizar Rota** (Aba "Paradas")
   - Conclua todas as paradas restantes
   - ✅ Confirme na última: "Sim, Finalizar Rota"

10. **Resumo Final** (Aba "Resumo")
    - Veja estatísticas da rota concluída
    - Veja tempo total gasto

---

## 🐛 Problemas Conhecidos

### Permissões
- **Localização**: Precisa conceder permissão de localização para features 6 e 9
- **Câmera**: Precisa conceder permissão de câmera para feature 1
- **Localização em Background**: Pode não funcionar se app estiver em background

### Limitações do Expo Go
- **Mapas**: Pode ter desempenho reduzido em dispositivos mais antigos
- **Offline**: Upload de fotos não funciona offline (limitação técnica)
- **GPS**: Pode ter latência de ~30s para atualizar localização

### Workarounds
- Se mapa não aparecer: verifique se `react-native-maps` está instalado
- Se localização não funcionar: reinicie o app e conceda permissão novamente
- Se foto não carregar: reduza resolução nas configurações do dispositivo

---

## 📊 Métricas para Coletar

Durante o teste, anote:

1. **Tempo para completar cada parada**: _____
2. **Número de vezes que usou SOS**: _____
3. **Precisão do tempo estimado** (compare previsto vs real): _____
4. **Número de paradas reabertas**: _____
5. **Frequência de uso do mapa**: _____
6. **Observações adicionadas**: _____
7. **Erros encontrados**: _____
8. **Sugestões de melhoria**: _____

---

## 🎯 Critérios de Sucesso

O teste é considerado **bem-sucedido** se:

- [ ] Todas as 10 features funcionam conforme esperado
- [ ] Hot reload funciona (mudanças no código refletem imediatamente)
- [ ] Não há crashes ou erros fatais
- [ ] Performance é aceitável (sem travamentos)
- [ ] UX é intuitiva (não precisa consultar manual constantemente)

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique logs no terminal onde o Expo está rodando
2. Verifique logs no Expo Go (menu de desenvolvedor)
3. Reinicie o servidor Expo
4. Limpe o cache: `npx expo start -c`

---

**Bom teste! 🚀**
