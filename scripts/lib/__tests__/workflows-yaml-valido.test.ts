// Todo workflow e toda composite action precisam ser YAML válido. Um arquivo
// inválido não dá erro em PR nenhum: o GitHub só deixa de rodá-lo, e um cron
// que não roda é lembrete/expiração que não acontece, sem aviso. Ex.: um
// `run:` sem aspas com `": "` no meio é lido como mapeamento aninhado.
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { parseDocument } from 'yaml';

const raiz = join(__dirname, '..', '..', '..', '.github');
const pastaWorkflows = join(raiz, 'workflows');
const pastaAcoes = join(raiz, 'actions');

const workflows = readdirSync(pastaWorkflows)
  .filter((nome) => /\.ya?ml$/.test(nome))
  .map((nome) => join(pastaWorkflows, nome));

const acoes = readdirSync(pastaAcoes)
  .map((nome) => join(pastaAcoes, nome, 'action.yml'))
  .filter((caminho) => existsSync(caminho));

const relativo = (caminho: string) =>
  caminho.slice(raiz.length + 1).replace(/\\/g, '/');

describe('YAML dos workflows e das actions', () => {
  it('encontra os arquivos (a varredura não está cega)', () => {
    expect(workflows.length).toBeGreaterThanOrEqual(4);
    expect(acoes.length).toBeGreaterThanOrEqual(1);
  });

  it.each([...workflows, ...acoes].map((c) => [relativo(c), c]))(
    '%s faz parse sem erros nem warnings',
    (_nome, caminho) => {
      const doc = parseDocument(readFileSync(caminho, 'utf8'));
      expect(doc.errors.map((e) => e.message)).toEqual([]);
      expect(doc.warnings.map((e) => e.message)).toEqual([]);
    },
  );
});

// Schema do runner para passo `run` de composite action: só estas chaves.
// `timeout-minutes` vale em passo de job, NÃO em composite — lá o prazo é
// `timeout <duração> <comando>` dentro do próprio `run`.
const CHAVES_PASSO_RUN_COMPOSITE = [
  'name',
  'id',
  'if',
  'run',
  'env',
  'continue-on-error',
  'working-directory',
  'shell',
];

describe.each(acoes.map((c) => [relativo(c), c]))('%s', (_nome, caminho) => {
  it('passos `run` só usam chaves aceitas em composite action', () => {
    const acao = parseDocument(readFileSync(caminho, 'utf8')).toJS() as {
      runs?: { steps?: Record<string, unknown>[] };
    };
    const passos = acao.runs?.steps ?? [];
    expect(passos.length).toBeGreaterThan(0);
    const proibidas = passos
      .filter((p) => 'run' in p)
      .flatMap((p) =>
        Object.keys(p)
          .filter((chave) => !CHAVES_PASSO_RUN_COMPOSITE.includes(chave))
          .map((chave) => `${String(p.name ?? p.id ?? '?')}: ${chave}`),
      );
    expect(proibidas).toEqual([]);
  });
});
