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
