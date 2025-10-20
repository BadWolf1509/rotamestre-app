import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  console.log('🔍 Testando conexão com Supabase...\n');

  // Listar unidades
  console.log('📍 Testando tabela UNIDADES:');
  const { data: unidades, error: unidadesError } = await supabase
    .from('unidades')
    .select('*');

  if (unidadesError) {
    console.error('❌ Erro ao buscar unidades:', unidadesError);
  } else {
    console.log('✅ Unidades encontradas:', unidades.length);
    console.log(JSON.stringify(unidades, null, 2));
  }

  // Listar usuários
  console.log('\n👥 Testando tabela USUARIOS:');
  const { data: usuarios, error: usuariosError } = await supabase
    .from('usuarios')
    .select('*');

  if (usuariosError) {
    console.error('❌ Erro ao buscar usuários:', usuariosError);
  } else {
    console.log('✅ Usuários encontrados:', usuarios.length);
  }

  // Listar rotas
  console.log('\n🗺️  Testando tabela ROTAS:');
  const { data: rotas, error: rotasError } = await supabase
    .from('rotas')
    .select('*');

  if (rotasError) {
    console.error('❌ Erro ao buscar rotas:', rotasError);
  } else {
    console.log('✅ Rotas encontradas:', rotas.length);
  }

  // Listar paradas
  console.log('\n📍 Testando tabela PARADAS:');
  const { data: paradas, error: paradasError } = await supabase
    .from('paradas')
    .select('*');

  if (paradasError) {
    console.error('❌ Erro ao buscar paradas:', paradasError);
  } else {
    console.log('✅ Paradas encontradas:', paradas.length);
  }

  // Listar logs
  console.log('\n📋 Testando tabela LOGS:');
  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('*');

  if (logsError) {
    console.error('❌ Erro ao buscar logs:', logsError);
  } else {
    console.log('✅ Logs encontrados:', logs.length);
  }

  // Testar view
  console.log('\n📊 Testando VIEW vw_rotas_resumo:');
  const { data: viewRotas, error: viewError } = await supabase
    .from('vw_rotas_resumo')
    .select('*');

  if (viewError) {
    console.error('❌ Erro ao buscar view:', viewError);
  } else {
    console.log('✅ View funcionando! Registros:', viewRotas.length);
  }

  console.log('\n✨ Teste concluído!\n');
}

testConnection().catch(console.error);
