#!/usr/bin/env node

/**
 * Script para verificar a lógica de checkpoint
 * Mostra a diferença entre contar todas as paradas vs apenas checkpoints
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

async function verifyCheckpointLogic() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Buscar rotas com contagem de paradas
    const rotasQuery = `
      SELECT
        r.id,
        r.data,
        r.status,
        u.nome as motorista,
        (SELECT COUNT(*) FROM paradas WHERE rota_id = r.id) as total_paradas_com_base,
        (SELECT COUNT(*) FROM paradas WHERE rota_id = r.id AND is_checkpoint = true) as total_entregas_reais,
        (SELECT COUNT(*) FROM paradas WHERE rota_id = r.id AND is_checkpoint = false) as pontos_base,
        (SELECT COUNT(*) FROM paradas WHERE rota_id = r.id AND status = 'concluida') as paradas_concluidas_com_base,
        (SELECT COUNT(*) FROM paradas WHERE rota_id = r.id AND status = 'concluida' AND is_checkpoint = true) as entregas_concluidas_reais
      FROM rotas r
      LEFT JOIN usuarios u ON r.motorista_id = u.id
      ORDER BY r.data DESC
      LIMIT 10;
    `;

    const result = await client.query(rotasQuery);

    if (result.rows.length === 0) {
      console.log('ℹ️  Nenhuma rota encontrada no banco de dados.');
      console.log('   Crie uma nova rota para testar a funcionalidade.\n');
    } else {
      console.log('📊 VERIFICAÇÃO DA LÓGICA DE CHECKPOINT\n');
      console.log('Comparação: Contagem COM base vs SEM base (apenas entregas)\n');

      result.rows.forEach((rota, index) => {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Rota #${index + 1}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`ID: ${rota.id}`);
        console.log(`Data: ${new Date(rota.data).toLocaleDateString('pt-BR')}`);
        console.log(`Motorista: ${rota.motorista || 'Sem motorista'}`);
        console.log(`Status: ${rota.status}`);
        console.log();
        console.log(`❌ ANTES (contando base):`);
        console.log(`   Total de paradas: ${rota.total_paradas_com_base}`);
        console.log(`   Paradas concluídas: ${rota.paradas_concluidas_com_base}`);
        if (rota.total_paradas_com_base > 0) {
          const progressoAntigo = ((rota.paradas_concluidas_com_base / rota.total_paradas_com_base) * 100).toFixed(0);
          console.log(`   Progresso: ${rota.paradas_concluidas_com_base}/${rota.total_paradas_com_base} = ${progressoAntigo}%`);
        }
        console.log();
        console.log(`✅ DEPOIS (apenas entregas):`);
        console.log(`   Pontos base (não contam): ${rota.pontos_base}`);
        console.log(`   Entregas reais: ${rota.total_entregas_reais}`);
        console.log(`   Entregas concluídas: ${rota.entregas_concluidas_reais}`);
        if (rota.total_entregas_reais > 0) {
          const progressoNovo = ((rota.entregas_concluidas_reais / rota.total_entregas_reais) * 100).toFixed(0);
          console.log(`   Progresso: ${rota.entregas_concluidas_reais}/${rota.total_entregas_reais} = ${progressoNovo}%`);
        }

        // Análise
        const diferenca = rota.total_paradas_com_base - rota.total_entregas_reais;
        if (diferenca > 0) {
          console.log();
          console.log(`💡 MELHORIA: Redução de ${diferenca} parada(s) na contagem (base removida)`);
        }
      });

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    // Estatísticas gerais
    const statsQuery = `
      SELECT
        COUNT(DISTINCT rota_id) as total_rotas,
        COUNT(*) FILTER (WHERE is_checkpoint = true) as total_entregas,
        COUNT(*) FILTER (WHERE is_checkpoint = false) as total_base_points,
        COUNT(*) as total_paradas
      FROM paradas;
    `;

    const stats = await client.query(statsQuery);
    const stat = stats.rows[0];

    console.log('📈 ESTATÍSTICAS GERAIS DO SISTEMA\n');
    console.log(`Total de rotas: ${stat.total_rotas}`);
    console.log(`Total de paradas (geral): ${stat.total_paradas}`);
    console.log(`  ├─ Entregas reais: ${stat.total_entregas} ✅`);
    console.log(`  └─ Pontos base: ${stat.total_base_points} 📍`);
    console.log();

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyCheckpointLogic();
