// Guarda dos helpers comuns das guardas de migration: se `ler`, `semComentarios`
// ou `rollbackDe` mudarem de semântica, todas as guardas que os usam mudam junto.
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  carregarMigration,
  ler,
  rollbackDe,
  semComentarios,
} from './_helpers/migration';

describe('helpers das guardas de migration', () => {
  let pasta: string;
  beforeAll(() => {
    pasta = mkdtempSync(join(tmpdir(), 'helpers-migration-'));
  });
  afterAll(() => {
    rmSync(pasta, { recursive: true, force: true });
  });

  it('ler normaliza CRLF', () => {
    const arquivo = join(pasta, 'crlf.sql');
    writeFileSync(arquivo, 'a\r\nb');
    expect(ler(arquivo)).toBe('a\nb');
  });

  it('ler de arquivo ausente devolve vazio', () => {
    expect(ler(join(pasta, 'nao-existe.sql'))).toBe('');
  });

  it('semComentarios corta do -- ao fim da linha', () => {
    expect(semComentarios('SELECT 1; -- x\nSELECT 2;')).toBe(
      'SELECT 1; \nSELECT 2;',
    );
  });

  it('rollbackDe tira o prefixo', () => {
    expect(rollbackDe('BEGIN;\n-- ROLLBACK:\n-- DROP x;')).toBe(
      'ROLLBACK:\nDROP x;',
    );
    expect(rollbackDe('BEGIN;\nCOMMIT;')).toBe('');
  });

  it('carregarMigration de uma migration real', () => {
    const m = carregarMigration('20261026125000_rota_encerrada_nao_volta.sql');
    expect(m.sql).toContain('rota_encerrada_nao_volta');
    expect(m.executavel).not.toContain('--');
    expect(m.executavel).toBe(semComentarios(m.sql));
    expect(m.rollback).toBe(rollbackDe(m.sql));
    expect(m.caminhoSupa).toContain('supabase');
  });
});
