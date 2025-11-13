require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Carregar credenciais do .env
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas!');
  console.log('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔧 Executando migration: Adicionar coluna CEP à tabela unidades\n');

  try {
    // Testar conexão primeiro
    console.log('📡 Testando conexão com o banco...');
    const { error: testError } = await supabase
      .from('unidades')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Erro ao conectar:', testError);
      return;
    }

    console.log('✅ Conexão estabelecida!\n');

    // Tentar adicionar a coluna CEP via SQL direto
    console.log('🔄 Executando SQL para adicionar coluna CEP...\n');

    const sql = `
      -- Adicionar coluna CEP se não existir
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'unidades' 
          AND column_name = 'cep'
        ) THEN
          ALTER TABLE public.unidades ADD COLUMN cep character varying(10);
          RAISE NOTICE 'Coluna CEP adicionada com sucesso!';
        ELSE
          RAISE NOTICE 'Coluna CEP já existe!';
        END IF;
      END $$;
      
      -- Adicionar índice se não existir
      CREATE INDEX IF NOT EXISTS idx_unidades_cep ON public.unidades(cep);
    `;

    // Como não podemos executar SQL direto via API, vamos verificar se a coluna existe
    console.log('🔍 Verificando se a coluna CEP já existe...\n');

    const { error: checkError } = await supabase
      .from('unidades')
      .select('cep')
      .limit(1);

    if (checkError) {
      if (checkError.message.includes('column "cep" does not exist')) {
        console.log('❌ Coluna CEP não existe no banco de dados.\n');
        console.log('📋 Execute este SQL manualmente no Supabase SQL Editor:\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(sql);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📍 Acesse: https://app.supabase.com/project/xezslsyxjivunmhhyxtd/sql\n');
      } else {
        console.error('❌ Erro ao verificar coluna:', checkError);
      }
    } else {
      console.log('✅ Coluna CEP já existe no banco de dados!\n');
      console.log('📊 Nenhuma ação necessária.');
    }

  } catch (err) {
    console.error('❌ Erro inesperado:', err);
  }
}

runMigration();
