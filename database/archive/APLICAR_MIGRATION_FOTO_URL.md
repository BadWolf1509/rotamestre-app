# 📸 Migration Sprint 1.3 - Upload de Fotos

## Como Aplicar a Migration

### Opção 1: Supabase Dashboard (Recomendado)

1. **Acesse:** https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/sql

2. **Cole o SQL abaixo:**

```sql
-- Migration: Adicionar coluna foto_url na tabela paradas
-- Sprint 1.3 - Upload de Fotos
-- Data: 25/10/2025

-- Adicionar coluna foto_url para armazenar URL da foto de comprovante de entrega
ALTER TABLE paradas
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN paradas.foto_url IS 'URL da foto do comprovante de entrega (Supabase Storage)';

-- Index para buscar paradas com foto (útil para relatórios)
CREATE INDEX IF NOT EXISTS idx_paradas_foto_url
ON paradas(foto_url)
WHERE foto_url IS NOT NULL;

-- Log da migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251025000000: Coluna foto_url adicionada à tabela paradas';
END $$;
```

3. **Clique em "Run"**

4. **Verifique:** Vá em `Database → Tables → paradas` e confirme que a coluna `foto_url` aparece

---

### Opção 2: Supabase CLI (Se instalado)

```bash
npx supabase db push
```

---

### Opção 3: Script Node.js (Fallback)

```bash
cd C:\Users\welli\rotamestre-app
node database/apply-migration-foto-url.js
```

**Nota:** Pode não funcionar se Supabase não permitir DDL via API.

---

## ✅ Verificação

Após aplicar, rode:

```bash
node database/apply-migration-foto-url.js
```

Deve exibir: `✅ Coluna foto_url JÁ EXISTE na tabela paradas!`

---

## 🗄️ Estrutura Atualizada

Tabela `paradas` agora tem:

```sql
CREATE TABLE paradas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  tipo VARCHAR(20) CHECK (tipo IN ('entrega', 'retirada')),
  endereco TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  ordem INT NOT NULL,
  destinatario VARCHAR(255),
  telefone VARCHAR(20),
  observacoes TEXT,
  status VARCHAR(20) DEFAULT 'pendente',
  concluida_em TIMESTAMP,
  foto_url TEXT,  -- ⬅️ NOVA COLUNA
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Próximos Passos (Sprint 1.3)

- [x] Migration criada
- [ ] Aplicar migration no Supabase ← **VOCÊ ESTÁ AQUI**
- [ ] Configurar Supabase Storage bucket
- [ ] Criar componente CameraUpload
- [ ] Implementar compressão de imagem
- [ ] Integrar no fluxo do motorista
- [ ] Visualização no histórico do gestor
