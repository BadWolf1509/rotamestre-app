// Guarda estática da Migration 60 (medidas da posição em numeric(8,2)). O
// banco único é produção e não há pgTAP: o comportamento se prova com a sonda
// transacional (`database/sondas/`). Esta guarda impede que uma edição troque
// a escala (que reescreveria a tabela e mudaria o arredondamento), acrescente
// um USING (que força a reescrita), tire o lock_timeout (que deixa o ALTER na
// fila do lock bloqueando os inserts de posição), deixe as duas cópias
// divergirem ou desalinhe o teto do tipo do teto que o app saneia
// (`TETO_MEDIDA_POSICAO`).

import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';
import { TETO_MEDIDA_POSICAO } from '../../src/lib/motorista/filaPosicoes';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const ARQUIVO = '20261025140000_medidas_da_posicao_numeric_8_2.sql';

const m = carregarMigration(ARQUIVO);
const { sql } = m;
const sonda = lerSonda('20261025140000_sonda_migration60.sql');
const { executavel } = m;
const rollback = (() => {
  const i = sql.indexOf('-- ROLLBACK:');
  return i < 0 ? '' : sql.slice(i);
})();

const COLUNAS = ['velocidade', 'precisao', 'heading'];

describe('Migration 60: medidas da posição em numeric(8,2)', () => {
  itExisteNasDuasPastas(m);

  it('alarga as três colunas para numeric(8,2), mantendo a escala', () => {
    expect(executavel).toMatch(/ALTER TABLE public\.motorista_locations\b/);
    for (const coluna of COLUNAS) {
      expect(executavel).toMatch(
        new RegExp(`ALTER COLUMN ${coluna} TYPE numeric\\(8,\\s*2\\)`),
      );
    }
    // Nenhuma outra coluna muda de tipo.
    expect(executavel.match(/ALTER COLUMN \w+ TYPE/g)).toHaveLength(3);
  });

  it('não força reescrita da tabela nem fica na fila do lock', () => {
    // USING transforma o ALTER em reescrita, mesmo com o tipo compatível.
    expect(executavel).not.toMatch(/\bUSING\b/i);
    expect(executavel).toMatch(/SET LOCAL lock_timeout\s*=\s*'\d+s'/);
    expect(executavel).toMatch(/^BEGIN;/m);
    expect(executavel).toMatch(/^COMMIT;/m);
  });

  it('o teto que o app saneia é o maior valor do tipo novo', () => {
    const [, precisao, escala] =
      executavel.match(/TYPE numeric\((\d+),\s*(\d+)\)/) ?? [];
    const teto =
      10 ** (Number(precisao) - Number(escala)) - 10 ** -Number(escala);
    expect(TETO_MEDIDA_POSICAO).toBeCloseTo(teto, 2);
  });

  it('documenta o rollback e o cuidado com valores acima do tipo antigo', () => {
    for (const coluna of COLUNAS) {
      expect(rollback).toMatch(
        new RegExp(`ALTER COLUMN ${coluna} TYPE numeric\\(5,\\s*2\\)`),
      );
    }
    expect(rollback).toMatch(/999\.99/);
  });

  it('a sonda insere a precisão medida no aparelho e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M60 \(desfeita\)/);
    expect(sonda).toMatch(/1500\.5/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(ultimoRaise).toBeGreaterThan(0);
    expect(sonda.slice(ultimoRaise)).toMatch(/^RAISE EXCEPTION 'SONDA M60/);
    expect(sonda).not.toMatch(/^\s*(DELETE|TRUNCATE|DROP)\b/im);
  });

  it('está no MIGRATIONS.md', () => {
    expect(ler(CAMINHO_DOC)).toContain(ARQUIVO);
  });
});
