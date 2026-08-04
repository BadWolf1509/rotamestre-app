// Stub de resolução para maplibre-gl v6 (ESM-only): o jest-resolve não acha o
// entry CommonJS que o v5 expunha. O bundler real (Metro) resolve o pacote
// normalmente; isto é só para o ambiente de teste (jsdom não roda WebGL de
// qualquer forma). Os testes que exercitam mapas fazem `jest.mock('maplibre-gl')`
// inline com seus próprios factories — este stub só precisa ser resolvível e
// oferecer os símbolos usados como fallback.
class Stub {}

module.exports = {
  Map: Stub,
  Marker: Stub,
  Popup: Stub,
  NavigationControl: Stub,
  LngLatBounds: Stub,
  LngLat: Stub,
  GeoJSONSource: Stub,
  setWorkerUrl: () => {},
};
