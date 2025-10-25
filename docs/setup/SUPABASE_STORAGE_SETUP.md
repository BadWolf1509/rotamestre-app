# 📸 Supabase Storage - Configuração para Upload de Fotos

Sprint 1.3 - Upload de Fotos de Comprovante de Entrega

---

## 🎯 Objetivo

Configurar bucket no Supabase Storage para armazenar fotos de comprovante de entrega enviadas pelos motoristas.

---

## 📁 Passo 1: Criar Bucket

### 1.1. Acessar Supabase Storage

https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/storage/buckets

### 1.2. Criar Novo Bucket

Clique em **"New bucket"**

**Configurações:**
```
Nome do bucket: fotos-entrega
Público: ✅ SIM (para gestor visualizar sem auth)
Tamanho máximo do arquivo: 5 MB
Tipos de arquivo permitidos: image/jpeg, image/png, image/webp
```

**⚠️ Importante:** Marcar como **público** para que gestores possam visualizar as fotos sem precisar de token de autenticação.

---

## 🔐 Passo 2: Configurar RLS (Row Level Security)

### 2.1. Criar Políticas de Acesso

Acesse: **Storage → Policies → fotos-entrega**

### 2.2. Política de Upload (Motoristas)

```sql
-- Política: Motoristas podem fazer upload de fotos
CREATE POLICY "Motoristas podem fazer upload de fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos-entrega'
  AND auth.uid() IN (
    SELECT id FROM usuarios WHERE papel = 'motorista'
  )
);
```

### 2.3. Política de Leitura (Público)

```sql
-- Política: Qualquer pessoa pode visualizar fotos (bucket público)
CREATE POLICY "Fotos públicas para visualização"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fotos-entrega');
```

### 2.4. Política de Exclusão (Apenas Gestor)

```sql
-- Política: Apenas gestores podem excluir fotos
CREATE POLICY "Gestores podem excluir fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fotos-entrega'
  AND auth.uid() IN (
    SELECT id FROM usuarios WHERE papel = 'gestor'
  )
);
```

---

## 📂 Passo 3: Estrutura de Pastas

Organizar fotos por **unidade_id** e **rota_id**:

```
fotos-entrega/
├── {unidade_id}/
│   ├── {rota_id}/
│   │   ├── {parada_id}_1.jpg
│   │   ├── {parada_id}_2.jpg
│   │   └── {parada_id}_3.jpg
```

**Exemplo:**
```
fotos-entrega/
├── a1b2c3d4-e5f6-7890-abcd-ef1234567890/  (unidade_id)
│   ├── r1t2a3b4-c5d6-7890-efgh-ij1234567890/  (rota_id)
│   │   ├── p1d2e3f4-g5h6-7890-ijkl-mn1234567890_1.jpg  (parada_id)
```

**Benefícios:**
- ✅ Organização por empresa
- ✅ Organização por rota
- ✅ Fácil limpeza (deletar pasta da rota)
- ✅ Fácil backup (copiar pasta da unidade)

---

## 🔧 Passo 4: Código para Upload

### 4.1. Função de Upload

```typescript
// src/lib/storage.ts
import { supabase } from './supabase';

export async function uploadFotoEntrega(
  unidadeId: string,
  rotaId: string,
  paradaId: string,
  fotoUri: string
): Promise<string | null> {
  try {
    // Gerar nome único
    const timestamp = Date.now();
    const fileName = `${paradaId}_${timestamp}.jpg`;
    const filePath = `${unidadeId}/${rotaId}/${fileName}`;

    // Converter URI para blob (web) ou file (mobile)
    const response = await fetch(fotoUri);
    const blob = await response.blob();

    // Upload para Supabase Storage
    const { data, error } = await supabase.storage
      .from('fotos-entrega')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('fotos-entrega')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return null;
  }
}
```

### 4.2. Atualizar Parada com URL da Foto

```typescript
export async function salvarFotoParada(
  paradaId: string,
  fotoUrl: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('paradas')
      .update({ foto_url: fotoUrl })
      .eq('id', paradaId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao salvar foto:', error);
    return false;
  }
}
```

---

## ✅ Checklist de Configuração

- [ ] Bucket `fotos-entrega` criado
- [ ] Bucket configurado como **público**
- [ ] Política de upload (motoristas) criada
- [ ] Política de leitura (público) criada
- [ ] Política de exclusão (gestores) criada
- [ ] Testar upload manual via Dashboard
- [ ] Verificar URL pública funciona

---

## 🧪 Teste Manual

### Upload via Dashboard

1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/storage/buckets/fotos-entrega
2. Clique em **"Upload file"**
3. Envie uma foto de teste
4. Clique na foto → **"Get URL"** → **"Public URL"**
5. Abra a URL no navegador
6. ✅ Foto deve carregar sem pedir autenticação

---

## 📊 Monitoramento

### Ver uso do Storage

**Dashboard:** https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/storage/usage

**Limites do plano Free:**
- 1 GB de storage
- 2 GB de transferência/mês
- 50 uploads/minuto

**⚠️ Otimizações:**
- Comprimir fotos para <500KB (reduz uso em 80%)
- Deletar fotos de rotas antigas (>90 dias)
- Usar cache-control para reduzir transferência

---

## 🚀 Próximos Passos

- [x] Migration foto_url aplicada
- [x] Bucket configurado ← **VOCÊ ESTÁ AQUI**
- [ ] Componente CameraUpload
- [ ] Compressão de imagem
- [ ] Integração no fluxo do motorista
- [ ] Visualização no histórico

---

**Desenvolvido por:** Wellington Ribeiro
**Sprint:** 1.3 - Upload de Fotos
**Data:** 25/10/2025
