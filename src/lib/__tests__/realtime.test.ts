import { nomeDeCanalUnico } from '../realtime';

describe('nomeDeCanalUnico', () => {
  it('nunca devolve o mesmo nome duas vezes para o mesmo prefixo', () => {
    const nomes = new Set(
      Array.from({ length: 100 }, () =>
        nomeDeCanalUnico('motorista-location-1'),
      ),
    );
    expect(nomes.size).toBe(100);
  });

  it('preserva o prefixo, para o canal continuar legível em log', () => {
    // O sufixo existe para o SDK, o prefixo existe para quem depura.
    expect(nomeDeCanalUnico('route-timeline-abc')).toMatch(
      /^route-timeline-abc#\d+$/,
    );
  });

  it('não colide entre prefixos diferentes', () => {
    const a = nomeDeCanalUnico('rotas-unidade-1');
    const b = nomeDeCanalUnico('rotas-unidade-2');
    expect(a).not.toBe(b);
  });

  it('o contador é do processo, não do prefixo', () => {
    // Dois prefixos distintos nao podem receber o mesmo sufixo: se cada
    // prefixo tivesse contador proprio, uma remontagem rapida de DOIS canais
    // diferentes ainda poderia gerar dois nomes iguais no servidor caso os
    // prefixos coincidissem por outro caminho.
    const primeiro = Number(nomeDeCanalUnico('a').split('#')[1]);
    const segundo = Number(nomeDeCanalUnico('b').split('#')[1]);
    expect(segundo).toBe(primeiro + 1);
  });
});
