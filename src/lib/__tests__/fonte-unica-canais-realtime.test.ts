/**
 * Guarda: todo canal Realtime tira o nome de `nomeDeCanalUnico`.
 *
 * POR QUE EXISTE. `supabase.removeChannel` é assíncrono. Uma remontagem rápida
 * — navegar e voltar, que no app do motorista é o normal — reusa um nome de
 * canal cuja remoção ainda não completou, e o SDK 56 lança
 * `cannot add postgres_changes callbacks after subscribe()`. A inscrição não
 * acontece e a tela para de receber atualização ao vivo **sem erro visível**.
 *
 * Seis call sites tinham a mesma forma. Um deles já carregava um contador
 * próprio, com o diagnóstico escrito no comentário — ou seja, alguém já tinha
 * pago esse preço e a lição ficou num arquivo só. É esse o buraco que a guarda
 * fecha: não o defeito de hoje, que está corrigido, mas o sétimo call site que
 * nascer copiando um dos cinco errados.
 *
 * O QUE ELA NÃO PEGA: se `nomeDeCanalUnico` quebrar por dentro, a guarda segue
 * verde — quem cobre isso é `realtime.test.ts`. E, como toda guarda por regex
 * aqui, ela lê texto: um nome montado por um caminho que ela não reconhece
 * (helper próprio, valor vindo de prop) passaria.
 */
import {
  arquivosDeProducao,
  lerFonte,
  semComentarios,
} from './helpers/varreduraDeFontes';

const FONTE_DOS_NOMES = 'src/lib/realtime.ts';

/**
 * Vazia, e é bom que esteja: todo canal deste app é criado em código que
 * remonta. Uma exceção aqui precisaria explicar por que aquele canal nunca
 * sofre remontagem rápida — o que não é uma propriedade que se possa afirmar
 * de um componente React.
 */
const EXCECOES: string[] = [];

/**
 * Verdadeiro quando o argumento de `.channel(...)` NÃO vem de
 * `nomeDeCanalUnico` — nem direto, nem por uma variável que o recebeu.
 */
function temCanalComNomeCru(fonte: string): boolean {
  const limpa = semComentarios(fonte);

  for (const m of limpa.matchAll(/\.channel\(\s*([^)]*)\)/g)) {
    const argumento = m[1].trim();
    if (argumento.includes('nomeDeCanalUnico')) continue;

    // Variável intermediária: `const x = nomeDeCanalUnico(...)` … `.channel(x)`
    const identificador = argumento.match(/^[A-Za-z_$][\w$]*$/)?.[0];
    if (
      identificador &&
      new RegExp(
        `(?:const|let)\\s+${identificador}\\s*=\\s*nomeDeCanalUnico\\(`,
      ).test(limpa)
    ) {
      continue;
    }

    return true;
  }
  return false;
}

describe('fonte única do nome de canal Realtime', () => {
  it('nenhum call site nomeia o canal por conta própria', () => {
    const infratores = arquivosDeProducao()
      .filter((caminho) => caminho !== FONTE_DOS_NOMES)
      .filter((caminho) => !EXCECOES.includes(caminho))
      .filter((caminho) => temCanalComNomeCru(lerFonte(caminho)));

    expect(infratores).toEqual([]);
  });

  it('o módulo dos nomes existe e expõe o helper', () => {
    // Sem isto a guarda passaria por ausência: se `realtime.ts` sumisse, todo
    // `.channel(nomeDeCanalUnico(...))` viraria erro de compilação, mas esta
    // suíte continuaria verde.
    expect(lerFonte(FONTE_DOS_NOMES)).toContain(
      'export function nomeDeCanalUnico',
    );
  });

  it('o detector reconhece a forma crua', () => {
    expect(temCanalComNomeCru('supabase.channel(`rotas-${id}`)')).toBe(true);
    expect(temCanalComNomeCru(".channel('notificacoes')")).toBe(true);
  });

  it('o detector aceita as duas formas corretas', () => {
    expect(
      temCanalComNomeCru('.channel(nomeDeCanalUnico(`rotas-${id}`))'),
    ).toBe(false);
    expect(
      temCanalComNomeCru(
        'const nome = nomeDeCanalUnico(`x`);\nsupabase.channel(nome)',
      ),
    ).toBe(false);
  });

  it('uma variável que NÃO veio do helper continua sendo violação', () => {
    // O ramo da variável intermediária existe para `useNotificationRealtime`;
    // se ele aceitasse qualquer identificador, bastaria mover o literal para
    // uma const para furar a guarda.
    expect(
      temCanalComNomeCru('const nome = `rotas-${id}`;\nsupabase.channel(nome)'),
    ).toBe(true);
  });
});
