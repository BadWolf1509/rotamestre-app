import { erroNaoFatalDoMapa } from '../maplibre';

describe('erroNaoFatalDoMapa', () => {
  it.each([
    ['tile', { sourceId: 'openmaptiles', tile: {}, error: new Error('404') }],
    ['fonte sem tile', { sourceId: 'openmaptiles', error: new Error('x') }],
    ['sprite', { error: new Error('Could not load sprite.json') }],
    ['glifo', { error: new Error('glyphs 0-255.pbf failed') }],
    ['imagem', { error: new Error('Could not load image') }],
  ])('erro de %s não é fatal', (_tipo, evento) => {
    expect(erroNaoFatalDoMapa(evento)).toBe(true);
  });

  it.each([
    ['estilo', { error: new Error('style') }],
    ['sem mensagem', { error: {} }],
    ['evento vazio', {}],
    ['null', null],
    ['undefined', undefined],
    ['string', 'falhou'],
  ])('erro de %s é fatal', (_tipo, evento) => {
    expect(erroNaoFatalDoMapa(evento)).toBe(false);
  });
});
