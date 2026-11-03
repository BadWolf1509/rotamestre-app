/**
 * Fila em série das filas do aparelho (OFF-3): um passo de cada vez, na ordem
 * das chamadas, e uma série não espera a outra.
 */
import { criarSerie } from '../serie';

/** Promessa que o teste resolve ou rejeita quando quiser. */
function controlada<T = void>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

/** Deixa as microtarefas andarem. */
async function escoar() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('criarSerie', () => {
  it('executa os passos na ordem das chamadas, um de cada vez', async () => {
    const emSerie = criarSerie();
    const inicios: number[] = [];
    let emVoo = 0;
    let maxEmVoo = 0;
    const travas = [controlada(), controlada(), controlada()];

    const passos = travas.map((trava, i) =>
      emSerie(async () => {
        inicios.push(i + 1);
        emVoo++;
        maxEmVoo = Math.max(maxEmVoo, emVoo);
        await trava.promessa;
        emVoo--;
      }),
    );

    await escoar();
    expect(inicios).toEqual([1]);
    travas[0].resolver();
    await escoar();
    expect(inicios).toEqual([1, 2]);
    travas[1].resolver();
    travas[2].resolver();
    await Promise.all(passos);

    expect(inicios).toEqual([1, 2, 3]);
    expect(maxEmVoo).toBe(1);
  });

  it('passo que rejeita: quem chamou recebe a rejeição e o seguinte roda', async () => {
    const emSerie = criarSerie();
    const erro = new Error('falhou');

    const primeiro = emSerie(async () => {
      throw erro;
    });
    const segundo = emSerie(async () => 'ok');

    await expect(primeiro).rejects.toBe(erro);
    await expect(segundo).resolves.toBe('ok');
  });

  it('padrão: o passo não começa na mesma volta síncrona', async () => {
    const emSerie = criarSerie();
    let iniciou = false;

    const passo = emSerie(async () => {
      iniciou = true;
    });

    expect(iniciou).toBe(false);
    await passo;
    expect(iniciou).toBe(true);
  });

  it('imediato e livre: o passo começa na hora', async () => {
    const emSerie = criarSerie({ imediato: true });
    let iniciou = false;

    const passo = emSerie(async () => {
      iniciou = true;
    });

    expect(iniciou).toBe(true);
    await passo;
  });

  it('imediato e ocupado: espera o anterior terminar', async () => {
    const emSerie = criarSerie({ imediato: true });
    const trava = controlada();
    let segundoIniciou = false;

    const primeiro = emSerie(() => trava.promessa);
    const segundo = emSerie(async () => {
      segundoIniciou = true;
    });

    await escoar();
    expect(segundoIniciou).toBe(false);
    trava.resolver();
    await Promise.all([primeiro, segundo]);
    expect(segundoIniciou).toBe(true);
  });

  it('imediato: depois que a fila esvazia, o próximo volta a começar na hora', async () => {
    const emSerie = criarSerie({ imediato: true });

    await emSerie(async () => undefined);
    await escoar();

    let iniciou = false;
    const passo = emSerie(async () => {
      iniciou = true;
    });
    expect(iniciou).toBe(true);
    await passo;
  });

  it('séries criadas separadamente não se esperam', async () => {
    const serieA = criarSerie();
    const serieB = criarSerie();
    const trava = controlada();

    void serieA(() => trava.promessa);
    const resultadoB = await serieB(async () => 'B');

    expect(resultadoB).toBe('B');
    trava.resolver();
  });
});
