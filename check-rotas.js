/**
 * Script para analisar rotas e otimização
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xezslsyxjivunmhhyxtd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlenNsc3l4aml2dW5taGh5eHRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDkwOTQ1NywiZXhwIjoyMDc2NDg1NDU3fQ.HRBlXp4cGD4sio2I7F4ZLBeGakHSYcGXrJevVoZQk_c';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeRotas() {
  try {
    console.log('\n🔍 Analisando rotas do sistema...\n');

    // Buscar rotas do motorista wellington
    const motorista = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .eq('email', 'wellington.ribeiro@fluxocerto.dev.br')
      .single();

    if (motorista.error) {
      console.error('❌ Erro ao buscar motorista:', motorista.error);
      return;
    }

    console.log('📊 Motorista:', motorista.data.nome);
    console.log('   ID:', motorista.data.id);
    console.log('');

    // Buscar todas as rotas (sem joins por enquanto)
    const { data: rotas, error: rotasError } = await supabase
      .from('rotas')
      .select('*')
      .order('created_at', { ascending: false });

    if (rotasError) {
      console.error('❌ Erro ao buscar rotas:', rotasError);
      return;
    }

    console.log(`📋 Total de rotas no sistema: ${rotas.length}\n`);

    // Mostrar todas as rotas
    for (const rota of rotas) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Rota ID: ${rota.id}`);
      console.log(`   Nome: ${rota.nome || 'Sem nome'}`);
      console.log(`   Status: ${rota.status}`);
      console.log(`   Data: ${rota.data_rota}`);
      console.log(`   Motorista ID: ${rota.motorista_id || 'Não atribuído'}`);
      console.log(`   Gestor ID: ${rota.gestor_id || 'N/A'}`);
      console.log(`   Unidade ID: ${rota.unidade_id || 'N/A'}`);
      console.log(`   Otimizada: ${rota.otimizada ? 'Sim' : 'Não'}`);
      console.log(`   Distância total: ${rota.distancia_total_metros ? (rota.distancia_total_metros / 1000).toFixed(2) + ' km' : 'N/A'}`);
      console.log(`   Tempo total: ${rota.duracao_total_segundos ? Math.round(rota.duracao_total_segundos / 60) + ' min' : 'N/A'}`);
      console.log(`   Criada em: ${new Date(rota.created_at).toLocaleString('pt-BR')}`);

      // Buscar paradas desta rota
      const { data: paradas, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', rota.id)
        .order('ordem', { ascending: true });

      if (!paradasError && paradas && paradas.length > 0) {
        console.log(`\n   🛑 Paradas (${paradas.length}):`);
        paradas.forEach((parada, idx) => {
          console.log(`      ${idx + 1}. Ordem: ${parada.ordem} | Status: ${parada.status}`);
          console.log(`         Endereço: ${parada.endereco_completo || 'N/A'}`);
          console.log(`         Lat/Lng: ${parada.latitude}, ${parada.longitude}`);
          if (parada.distancia_proxima_parada_metros) {
            console.log(`         Distância até próxima: ${(parada.distancia_proxima_parada_metros / 1000).toFixed(2)} km`);
          }
          if (parada.tempo_ate_proxima_parada_segundos) {
            console.log(`         Tempo até próxima: ${Math.round(parada.tempo_ate_proxima_parada_segundos / 60)} min`);
          }
        });
      } else {
        console.log('   ⚠️  Nenhuma parada cadastrada');
      }

      console.log('');
    }

    // Verificar rotas do motorista específico
    const rotasMotorista = rotas.filter(r => r.motorista_id === motorista.data.id);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Rotas do motorista ${motorista.data.nome}: ${rotasMotorista.length}`);
    if (rotasMotorista.length === 0) {
      console.log('⚠️  PROBLEMA: Motorista não tem nenhuma rota atribuída!');
      console.log('💡 SOLUÇÃO: Criar uma rota e atribuir ao motorista via painel gestor');
    } else {
      console.log('\n✅ Rotas encontradas:');
      rotasMotorista.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.nome || 'Sem nome'} (Status: ${r.status}) - ${r.data_rota}`);
      });
    }

  } catch (err) {
    console.error('\n❌ Erro geral:', err);
  }
}

analyzeRotas();
