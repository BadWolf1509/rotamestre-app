/**
 * Filtro do `typecheck:tests`: o `tsconfig.json` exclui os testes, então nome
 * removido de um módulo que só um teste importa passa no `tsc` do projeto — e
 * no jest também, se o teste só roda condicionalmente (`emSP ? it : it.skip`).
 * O `tsc` com os testes acusa ~430 erros de tipagem de mock que não são isso;
 * o filtro separa só os de import/membro inexistente.
 */
const { errosDeImport, rodouDeVerdade } =
  require('../typecheck-testes.cjs') as {
    errosDeImport: (saida: string) => string[];
    rodouDeVerdade: (status: number | null, saida: string) => boolean;
  };

const SAIDA = [
  "src/a.test.ts(3,10): error TS2305: Module '\"../a\"' has no exported member 'sumiu'.",
  "src/b.test.ts(9,3): error TS2339: Property 'mockResolvedValue' does not exist on type 'X'.",
  "src/c.test.ts(1,21): error TS2307: Cannot find module '../c' or its corresponding type declarations.",
  "src/d.test.ts(2,10): error TS2724: '\"../d\"' has no exported member named 'velho'. Did you mean 'novo'?",
  "src/e.test.ts(4,1): error TS2614: Module '\"../e\"' has no exported member 'X'. Did you mean to use 'import X from \"../e\"' instead?",
  "src/f.test.ts(5,7): error TS2694: Namespace '\"../f\"' has no exported member 'T'.",
  "src/g.test.ts(6,2): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.",
].join('\n');

describe('errosDeImport', () => {
  it('fica só com membro ou módulo inexistente', () => {
    expect(errosDeImport(SAIDA).map((l) => l.match(/TS\d+/)?.[0])).toEqual([
      'TS2305',
      'TS2307',
      'TS2724',
      'TS2614',
      'TS2694',
    ]);
  });

  it('não acusa nada quando só há erro de tipagem de mock', () => {
    expect(
      errosDeImport(
        "src/b.test.ts(9,3): error TS2339: Property 'mockResolvedValue' does not exist on type 'X'.",
      ),
    ).toEqual([]);
  });

  it('aceita saída com CRLF', () => {
    expect(
      errosDeImport(
        "src/a.test.ts(3,10): error TS2305: Module 'x' has no exported member 'y'.\r\n",
      ),
    ).toHaveLength(1);
  });
});

describe('rodouDeVerdade', () => {
  it('exit 0 é execução real', () => {
    expect(rodouDeVerdade(0, '')).toBe(true);
  });

  it('exit 2 com erros TS listados é execução real (o tsc achou erros)', () => {
    expect(rodouDeVerdade(2, SAIDA)).toBe(true);
  });

  it('exit diferente de 0 sem nenhum erro TS é falha da ferramenta, não projeto limpo', () => {
    expect(
      rodouDeVerdade(
        1,
        "error TS5058: The specified path does not exist: 'x'.",
      ),
    ).toBe(false);
    expect(rodouDeVerdade(null, '')).toBe(false);
  });
});
