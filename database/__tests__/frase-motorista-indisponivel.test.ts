// Guarda do acoplamento entre o banco e o app: a RPC `criar_rota_com_paradas`
// levanta (P0001) a frase "Motorista indisponível para a unidade
// selecionada." e o app a compara literalmente
// (`FRASE_MOTORISTA_INDISPONIVEL` em src/hooks/nova-entrega/useRouteCreation.ts).
// Mudar o texto de um lado sem o outro derruba o aviso amigável sem erro
// visível. Esta guarda lê a constante do app e confere a última migration que
// define a função.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const raiz = join(__dirname, '..', '..');
const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';

const HOOK = 'src/hooks/nova-entrega/useRouteCreation.ts';
const hook = ler(join(raiz, HOOK));
const doc = ler(join(raiz, 'database', 'MIGRATIONS.md'));

const frase = (() => {
  const m = hook.match(
    /const FRASE_MOTORISTA_INDISPONIVEL\s*=\s*\n?\s*'([^']+)'/,
  );
  return m ? m[1] : '';
})();

const pastaMigrations = join(raiz, 'database', 'migrations');
const ultima = (() => {
  const arquivos = readdirSync(pastaMigrations)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .filter((n) =>
      /CREATE OR REPLACE FUNCTION public\.criar_rota_com_paradas\(/.test(
        ler(join(pastaMigrations, n)),
      ),
    );
  const nome = arquivos[arquivos.length - 1];
  return nome ? ler(join(pastaMigrations, nome)) : '';
})();

describe('frase do motorista indisponível (banco x app)', () => {
  it('o app declara a frase', () => {
    expect(frase).not.toBe('');
  });

  it('a última migration que define criar_rota_com_paradas levanta exatamente a frase que o app compara', () => {
    expect(ultima).not.toBe('');
    expect(ultima).toContain(`RAISE EXCEPTION '${frase}'`);
  });

  it('MIGRATIONS.md documenta o acoplamento com o arquivo do app', () => {
    expect(doc).toContain(frase);
    expect(doc).toContain(HOOK);
  });
});
