/**
 * Ambiente jsdom para testes que, mesmo sob o preset nativo (jest-expo), precisam
 * de DOM — os mapas web (maplibre-gl) e o useDialogState.
 *
 * POR QUE EXISTE. O setup do preset do React Native
 * (`@react-native/jest-preset/jest/setup.js`) faz
 * `Object.defineProperties(global, { window: { value: global, ... } })`. No
 * jsdom do Jest 29 isso passava; no do Jest 30 (Expo SDK 58) `window` é
 * propriedade não configurável, como manda o WebIDL, e o setup quebra com
 * "Cannot redefine property: window" antes de qualquer teste rodar.
 *
 * No jsdom `window` já é o próprio global — exatamente o valor que o setup quer
 * atribuir —, então pular só essa chave não muda nada do ambiente. O desvio vale
 * uma única vez (a chamada do setup) e devolve o `defineProperties` original.
 *
 * O segundo ajuste é o mesmo do ambiente nativo do jest-expo 58
 * (`jest-expo/src/preset/nativeEnvironment.js`, que não o exporta): desde o
 * Jest 30.4 o teardown lê todo global enumerável para limpar mocks, e os globais
 * preguiçosos do Expo (TextEncoderStream, fetch, structuredClone...) são getters
 * que fazem `require` no primeiro acesso — fora do escopo do teste, erro.
 * Getters são pulados.
 *
 * Uso: docblock `@jest-environment ./jest.ambiente-jsdom.js` no arquivo de teste.
 */
const { TestEnvironment } = require('jest-environment-jsdom');

/** Limpa só mocks em propriedades de dado; getters (globais preguiçosos) ficam. */
function clearMocksOnScope(scope) {
  for (const key of Object.keys(scope)) {
    const descriptor = Object.getOwnPropertyDescriptor(scope, key);
    if (!descriptor || typeof descriptor.get === 'function') continue;
    const value = descriptor.value;
    if (
      value != null &&
      (typeof value === 'object' || typeof value === 'function') &&
      '_isMockFunction' in value &&
      this.isMockFunction(value) &&
      typeof value.mockClear === 'function'
    ) {
      value.mockClear();
    }
  }
}

class AmbienteJsdomComPresetRN extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.moduleMocker.clearMocksOnScope = clearMocksOnScope;
    const globalDoTeste = this.global;
    const definePropertiesOriginal = globalDoTeste.Object.defineProperties;

    globalDoTeste.Object.defineProperties = function definePropertiesSemWindow(
      alvo,
      descritores,
    ) {
      if (
        alvo === globalDoTeste &&
        descritores &&
        Object.prototype.hasOwnProperty.call(descritores, 'window')
      ) {
        globalDoTeste.Object.defineProperties = definePropertiesOriginal;
        const { window: _jaEhOGlobal, ...demais } = descritores;
        return definePropertiesOriginal.call(this, alvo, demais);
      }
      return definePropertiesOriginal.call(this, alvo, descritores);
    };
  }
}

module.exports = AmbienteJsdomComPresetRN;
