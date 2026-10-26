/**
 * UUID v4. Usa `crypto.randomUUID` quando existe (web, Node) e cai para
 * `Math.random` no Hermes, que não garante a API. Serve para identificador de
 * requisição e de sessão, não para segredo.
 */
export function gerarUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}
