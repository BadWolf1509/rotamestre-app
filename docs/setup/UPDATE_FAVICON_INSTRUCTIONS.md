# 🎨 Atualizar Favicon - RotaMestre

## 📝 Instruções para Substituir o Ícone

### Passo 1: Salvar a Nova Imagem

1. **Salve a imagem do capacete laranja** que você enviou como:
   ```
   c:\Users\welli\rotamestre-app\assets\icon.png
   ```

2. **Requisitos da imagem:**
   - Formato: PNG
   - Tamanho: 1024x1024 pixels (recomendado)
   - Fundo: Transparente ou com cor sólida

### Passo 2: Copiar para Outras Variações

Execute os seguintes comandos para copiar o novo ícone:

```bash
cd c:\Users\welli\rotamestre-app

# Copiar para todas as variações de assets
cp assets/icon.png assets/favicon.png
cp assets/icon.png assets/adaptive-icon.png
cp assets/icon.png assets/splash-icon.png
```

### Passo 3: Rebuild para Gerar Favicons

```bash
# Limpar cache
npx expo export --platform web --clear

# O Expo vai gerar automaticamente:
# - favicon.ico
# - favicon-16x16.png
# - favicon-32x32.png
# - favicon-96x96.png
# - apple-touch-icon.png
# - icon-192.png
# - icon-512.png
```

### Passo 4: Deploy

```bash
# Fazer commit
git add assets/*.png dist/favicon* dist/icon* dist/apple-touch-icon.png
git commit -m "feat: Atualiza favicons com novo ícone do RotaMestre"
git push

# Deploy automático via Vercel (push já faz deploy)
```

### Passo 5: Validar

Após o deploy, teste:
```
https://app.rotamestre.tec.br/favicon.ico
https://app.rotamestre.tec.br/icon-192.png
https://app.rotamestre.tec.br/apple-touch-icon.png
```

---

## 🖼️ Alternativa: Usar Ferramenta Online

Se preferir, use uma ferramenta online para gerar todos os tamanhos:

### 1. Real Favicon Generator
```
https://realfavicongenerator.net/
```

**Passo a passo:**
1. Faça upload da imagem do capacete laranja
2. Ajuste as configurações (iOS, Android, etc)
3. Clique em "Generate your Favicons and HTML code"
4. Baixe o pacote ZIP
5. Extraia para a pasta `dist/`

### 2. Favicon.io
```
https://favicon.io/favicon-converter/
```

**Passo a passo:**
1. Faça upload da imagem
2. Clique em "Download"
3. Extraia os arquivos para `dist/`

---

## 📂 Arquivos que Serão Gerados

```
dist/
├── favicon.ico              # 16x16, 32x32, 48x48 (multi-size)
├── favicon-16x16.png        # 16x16
├── favicon-32x32.png        # 32x32
├── favicon-96x96.png        # 96x96
├── apple-touch-icon.png     # 180x180 (iOS)
├── icon-192.png             # 192x192 (Android PWA)
└── icon-512.png             # 512x512 (PWA splash)
```

---

## 🔧 Troubleshooting

### Favicon não aparece após deploy
**Solução:** Limpar cache do navegador
```
Chrome: Ctrl+Shift+Delete → Imagens em cache
```

### Ícone aparece pixelado
**Solução:** Usar imagem original maior (1024x1024 mínimo)

### iOS não mostra o ícone
**Solução:** Verificar `apple-touch-icon.png` tem 180x180px

---

## ✅ Checklist

- [ ] Salvar imagem do capacete como `assets/icon.png`
- [ ] Copiar para outras variações (favicon.png, adaptive-icon.png)
- [ ] Fazer rebuild: `npx expo export --platform web --clear`
- [ ] Verificar arquivos gerados em `dist/`
- [ ] Fazer commit e push
- [ ] Aguardar deploy automático (1-2 min)
- [ ] Limpar cache do navegador
- [ ] Testar em https://app.rotamestre.tec.br
- [ ] Validar ícone na tab do navegador
- [ ] Validar ícone ao adicionar à tela inicial (mobile)

---

**Tempo estimado:** 5-10 minutos
