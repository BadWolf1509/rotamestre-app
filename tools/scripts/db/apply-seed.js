#!/usr/bin/env node

/**
 * Script para aplicar seed data no Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', 'mcp-rotamestre', '.env');

dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// IDs fixos do seed
const UNIDADE_ID = '00000000-0000-0000-0000-000000000001';
const GESTOR_ID = '10000000-0000-0000-0000-000000000001';
const MOTORISTA_ID = '20000000-0000-0000-0000-000000000001';
const ROTA1_ID = '30000000-0000-0000-0000-000000000001';
const ROTA2_ID = '30000000-0000-0000-0000-000000000002';

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║       Aplicando Seed Data - RotaMestre        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // 1. Criar Unidade
    console.log('🏢 Criando unidade de teste...');
    const { data: unidade, error: unidadeError } = await supabase
      .from('unidades')
      .upsert({
        id: UNIDADE_ID,
        nome: 'Unidade Centro - Teste',
        cidade: 'Sao Paulo',
        cnpj: '12.345.678/0001-90',
        endereco: 'Av. Paulista, 1000 - São Paulo, SP',
        ativa: true
      }, { onConflict: 'id' })
      .select()
      .single();

    if (unidadeError) throw unidadeError;
    console.log('   ✅ Unidade criada:', unidade.nome);

    // 2. Criar Rotas (sem motorista por enquanto)
    console.log('\n🚗 Criando rotas de teste...');

    const { error: rota1Error } = await supabase
      .from('rotas')
      .upsert({
        id: ROTA1_ID,
        unidade_id: UNIDADE_ID,
        motorista_id: null, // Será atualizado depois
        data: new Date().toISOString().split('T')[0],
        status: 'em_andamento',
        distancia_total: 25.5,
        iniciada_em: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'id' });

    if (rota1Error) throw rota1Error;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { error: rota2Error } = await supabase
      .from('rotas')
      .upsert({
        id: ROTA2_ID,
        unidade_id: UNIDADE_ID,
        motorista_id: null, // Será atualizado depois
        data: tomorrow.toISOString().split('T')[0],
        status: 'pendente',
        distancia_total: 18.3
      }, { onConflict: 'id' });

    if (rota2Error) throw rota2Error;
    console.log('   ✅ 2 rotas criadas');

    // 3. Criar Paradas da Rota #1
    console.log('\n📍 Criando paradas da Rota #1...');

    const paradas1 = [
      {
        id: '40000000-0000-0000-0000-000000000001',
        rota_id: ROTA1_ID,
        tipo: 'entrega',
        endereco: 'Rua Augusta, 500 - Consolação, São Paulo - SP',
        latitude: -23.5505199,
        longitude: -46.6333094,
        ordem: 1,
        status: 'concluida',
        concluida_em: new Date(Date.now() - 90 * 60 * 1000).toISOString()
      },
      {
        id: '40000000-0000-0000-0000-000000000002',
        rota_id: ROTA1_ID,
        tipo: 'entrega',
        endereco: 'Av. Brigadeiro Faria Lima, 2000 - Jardim Paulistano, São Paulo - SP',
        latitude: -23.5816799,
        longitude: -46.6880499,
        ordem: 2,
        status: 'concluida',
        concluida_em: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      },
      {
        id: '40000000-0000-0000-0000-000000000003',
        rota_id: ROTA1_ID,
        tipo: 'entrega',
        endereco: 'Rua Oscar Freire, 800 - Jardins, São Paulo - SP',
        latitude: -23.5619,
        longitude: -46.6693,
        ordem: 3,
        status: 'pendente'
      },
      {
        id: '40000000-0000-0000-0000-000000000004',
        rota_id: ROTA1_ID,
        tipo: 'entrega',
        endereco: 'Av. Rebouças, 3000 - Pinheiros, São Paulo - SP',
        latitude: -23.5628,
        longitude: -46.6773,
        ordem: 4,
        status: 'pendente'
      },
      {
        id: '40000000-0000-0000-0000-000000000005',
        rota_id: ROTA1_ID,
        tipo: 'entrega',
        endereco: 'Rua Haddock Lobo, 1500 - Cerqueira César, São Paulo - SP',
        latitude: -23.5641,
        longitude: -46.6614,
        ordem: 5,
        status: 'pendente'
      }
    ];

    for (const parada of paradas1) {
      const { error } = await supabase
        .from('paradas')
        .upsert(parada, { onConflict: 'id' });

      if (error) throw error;
    }

    console.log('   ✅ 5 paradas criadas para Rota #1');

    // 4. Criar Paradas da Rota #2
    console.log('\n📍 Criando paradas da Rota #2...');

    const paradas2 = [
      {
        id: '40000000-0000-0000-0000-000000000006',
        rota_id: ROTA2_ID,
        tipo: 'entrega',
        endereco: 'Av. Ipiranga, 1000 - República, São Paulo - SP',
        latitude: -23.5434,
        longitude: -46.6435,
        ordem: 1,
        status: 'pendente'
      },
      {
        id: '40000000-0000-0000-0000-000000000007',
        rota_id: ROTA2_ID,
        tipo: 'entrega',
        endereco: 'Praça da República, 100 - República, São Paulo - SP',
        latitude: -23.5431,
        longitude: -46.6429,
        ordem: 2,
        status: 'pendente'
      },
      {
        id: '40000000-0000-0000-0000-000000000008',
        rota_id: ROTA2_ID,
        tipo: 'entrega',
        endereco: 'Rua 25 de Março, 500 - Centro, São Paulo - SP',
        latitude: -23.5445,
        longitude: -46.6352,
        ordem: 3,
        status: 'pendente'
      }
    ];

    for (const parada of paradas2) {
      const { error } = await supabase
        .from('paradas')
        .upsert(parada, { onConflict: 'id' });

      if (error) throw error;
    }

    console.log('   ✅ 3 paradas criadas para Rota #2');

    // Resumo
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║              SEED APLICADO COM SUCESSO         ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    console.log('✅ 1 Unidade criada');
    console.log('✅ 2 Rotas criadas');
    console.log('✅ 8 Paradas criadas\n');
    console.log('⚠️  Os usuários (gestor/motorista) ainda precisam ser criados');
    console.log('   Execute: npm run create-users\n');

  } catch (error) {
    console.error('\n❌ Erro ao aplicar seed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
