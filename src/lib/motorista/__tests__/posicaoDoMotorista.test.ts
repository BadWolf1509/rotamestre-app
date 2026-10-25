import {
  formatarIdadeDaPosicao,
  posicaoMaisRecente,
} from '../posicaoDoMotorista';

function posicao(timestamp: string, latitude = -7.1) {
  return { timestamp, latitude, longitude: -34.8 };
}

describe('posicaoMaisRecente', () => {
  it('sem posição atual, aceita a nova', () => {
    const nova = posicao('2026-10-24T10:00:00Z');
    expect(posicaoMaisRecente(null, nova)).toBe(nova);
  });

  it('posição mais nova pelo timestamp do GPS substitui a atual', () => {
    const atual = posicao('2026-10-24T10:00:00Z');
    const nova = posicao('2026-10-24T10:01:00Z', -7.2);
    expect(posicaoMaisRecente(atual, nova)).toBe(nova);
  });

  it('posição antiga reenviada pela fila offline não volta o marcador', () => {
    const atual = posicao('2026-10-24T10:05:00Z');
    const velha = posicao('2026-10-24T09:40:00Z', -7.9);
    expect(posicaoMaisRecente(atual, velha)).toBe(atual);
  });

  it('mesmo timestamp mantém a atual (sem render à toa)', () => {
    const atual = posicao('2026-10-24T10:05:00Z');
    expect(posicaoMaisRecente(atual, posicao('2026-10-24T10:05:00Z'))).toBe(
      atual,
    );
  });

  it('compara o instante, não o texto (fusos diferentes)', () => {
    const atual = posicao('2026-10-24T10:05:00Z');
    // 07:10 em UTC-3 = 10:10Z, mais nova apesar de "menor" como texto
    const nova = posicao('2026-10-24T07:10:00-03:00');
    expect(posicaoMaisRecente(atual, nova)).toBe(nova);
  });

  it('nova sem timestamp válido não substitui uma posição válida', () => {
    const atual = posicao('2026-10-24T10:05:00Z');
    expect(posicaoMaisRecente(atual, posicao('lixo'))).toBe(atual);
  });

  it('atual sem timestamp válido cede a uma nova válida', () => {
    const nova = posicao('2026-10-24T10:05:00Z');
    expect(posicaoMaisRecente(posicao(''), nova)).toBe(nova);
  });
});

describe('formatarIdadeDaPosicao', () => {
  const agora = Date.parse('2026-10-24T10:30:00Z');

  it.each([
    ['2026-10-24T10:29:40Z', 'agora'],
    ['2026-10-24T10:29:00Z', 'há 1 min'],
    ['2026-10-24T10:18:00Z', 'há 12 min'],
    ['2026-10-24T09:31:00Z', 'há 59 min'],
    ['2026-10-24T09:30:00Z', 'há 1 h'],
    ['2026-10-24T07:00:00Z', 'há 3 h'],
    // relógio do aparelho adiantado: não mostra idade negativa
    ['2026-10-24T10:32:00Z', 'agora'],
  ])('%s → %s', (timestamp, esperado) => {
    expect(formatarIdadeDaPosicao(timestamp, agora)).toBe(esperado);
  });

  it('timestamp inválido não mostra idade', () => {
    expect(formatarIdadeDaPosicao('lixo', agora)).toBe('');
  });
});
