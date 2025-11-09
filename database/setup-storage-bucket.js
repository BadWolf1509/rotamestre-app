#!/usr/bin/env node

/**
 * Script para configurar bucket no Supabase Storage
 * Sprint 1.3 - Upload de Fotos
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'fotos-entrega';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupBucket() {
  console.log('🚀 Sprint 1.3 - Configurando Supabase Storage\n');

  try {
    // 1. Verificar se bucket já existe
    console.log(`🔍 Verificando se bucket "${BUCKET_NAME}" existe...\n`);

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Erro ao listar buckets:', listError.message);
      throw listError;
    }

    const bucketExists = buckets.some(b => b.name === BUCKET_NAME);

    if (bucketExists) {
      console.log(`✅ Bucket "${BUCKET_NAME}" já existe!`);
      console.log(`📊 Detalhes:`);
      const bucket = buckets.find(b => b.name === BUCKET_NAME);
      console.log(`   - Nome: ${bucket.name}`);
      console.log(`   - ID: ${bucket.id}`);
      console.log(`   - Público: ${bucket.public ? 'Sim' : 'Não'}`);
      console.log(`   - Criado em: ${new Date(bucket.created_at).toLocaleString('pt-BR')}`);
      return;
    }

    // 2. Criar bucket
    console.log(`📦 Criando bucket "${BUCKET_NAME}"...\n`);

    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true, // Bucket público para facilitar visualização
      fileSizeLimit: 5242880, // 5MB em bytes
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });

    if (createError) {
      console.error('❌ Erro ao criar bucket:', createError.message);
      throw createError;
    }

    console.log(`✅ Bucket "${BUCKET_NAME}" criado com sucesso!`);
    console.log(`📊 Configurações:`);
    console.log(`   - Nome: ${BUCKET_NAME}`);
    console.log(`   - Público: Sim`);
    console.log(`   - Tamanho máximo: 5 MB`);
    console.log(`   - Tipos permitidos: JPEG, PNG, WebP`);

    console.log('\n⚠️  IMPORTANTE: Configure as políticas RLS manualmente!');
    console.log('   Ver: docs/setup/SUPABASE_STORAGE_SETUP.md');

  } catch (error) {
    console.error('\n❌ Erro no setup:', error.message);

    if (error.message.includes('not authorized')) {
      console.log('\n💡 Solução: Configure o bucket manualmente no Dashboard');
      console.log('   1. Acesse: https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/storage/buckets');
      console.log('   2. Clique em "New bucket"');
      console.log('   3. Nome: fotos-entrega');
      console.log('   4. Público: ✅ SIM');
      console.log('   5. Tamanho máximo: 5 MB');
      console.log('   6. Clique em "Create bucket"');
    }

    process.exit(1);
  }
}

async function testUpload() {
  console.log('\n🧪 Testando upload de arquivo de teste...\n');

  try {
    // Criar blob de teste (1x1 pixel JPEG)
    const testBlob = new Blob(
      [
        Buffer.from(
          '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
          'base64'
        )
      ],
      { type: 'image/jpeg' }
    );

    const testPath = 'test/test.jpg';

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(testPath, testBlob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('❌ Erro no upload de teste:', error.message);
      return;
    }

    console.log('✅ Upload de teste bem-sucedido!');

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(testPath);

    console.log(`🔗 URL pública: ${publicUrl}`);
    console.log(`\n💡 Abra a URL no navegador para verificar se a foto carrega!`);

    // Deletar arquivo de teste
    await supabase.storage.from(BUCKET_NAME).remove([testPath]);
    console.log('🗑️  Arquivo de teste removido.');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

async function main() {
  await setupBucket();
  await testUpload();
  console.log('\n✅ Setup concluído!');
}

main();
