import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { logger } from './logger';

import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * O SecureStore avisa (e pode recusar) valor acima de 2048 bytes, e a sessão
 * do Supabase passa disso: ela é gravada em blocos.
 */
const CHUNK_SIZE = 1800;

/**
 * Onde moram os blocos da sessão vigente. O metadado é a única chave que diz
 * qual geração vale, e a troca dele é uma gravação só: é isso que torna a
 * escrita atômica.
 *
 * - `antigo`: formato até esta versão — metadado "N", blocos `<chave>.secure.<i>`.
 *   Continua legível para não deslogar quem atualizar o app.
 * - `a`/`b`: metadado "a:N"/"b:N", blocos `<chave>.secure.a.<i>`/`.b.<i>`.
 *   A gravação nova vai sempre para a geração que o metadado não aponta.
 */
type Geracao = 'antigo' | 'a' | 'b';

interface Ponteiro {
  geracao: Geracao;
  blocos: number;
}

const GERACOES: Geracao[] = ['antigo', 'a', 'b'];

function metadataKey(key: string) {
  return `${key}.secure.meta`;
}

function chunkKey(key: string, geracao: Geracao, index: number) {
  return geracao === 'antigo'
    ? `${key}.secure.${index}`
    : `${key}.secure.${geracao}.${index}`;
}

function lerPonteiro(raw: string | null): Ponteiro | null {
  if (raw === null) return null;
  const casado = /^(?:([ab]):)?(\d+)$/.exec(raw);
  if (!casado) return null;
  const blocos = Number(casado[2]);
  if (!Number.isInteger(blocos) || blocos <= 0) return null;
  return { geracao: (casado[1] as 'a' | 'b' | undefined) ?? 'antigo', blocos };
}

function escreverPonteiro({ geracao, blocos }: Ponteiro): string {
  return geracao === 'antigo' ? String(blocos) : `${geracao}:${blocos}`;
}

async function readPointer(key: string): Promise<Ponteiro | null> {
  return lerPonteiro(await SecureStore.getItemAsync(metadataKey(key)));
}

/**
 * Apaga os blocos de uma geração, inclusive os órfãos de uma gravação que
 * falhou antes de trocar o ponteiro (o cofre não lista chaves, então a
 * extensão é sondada). Os blocos são gravados em sequência, sempre do 0 em
 * diante, e apagados do último para o primeiro: o que sobra de uma operação
 * interrompida é sempre um prefixo contíguo, que a sonda encontra.
 */
async function apagarGeracao(
  key: string,
  geracao: Geracao,
  conhecidos = 0,
): Promise<void> {
  let total = conhecidos;
  while (
    (await SecureStore.getItemAsync(chunkKey(key, geracao, total))) !== null
  ) {
    total += 1;
  }
  for (let index = total - 1; index >= 0; index -= 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, geracao, index));
  }
}

async function removeSecureValue(key: string): Promise<void> {
  const ponteiro = await readPointer(key);
  // O ponteiro sai primeiro: a partir daqui a leitura já devolve null, e
  // uma falha no meio da limpeza não deixa sessão meio apagada legível.
  await SecureStore.deleteItemAsync(metadataKey(key));
  for (const geracao of GERACOES) {
    await apagarGeracao(
      key,
      geracao,
      ponteiro?.geracao === geracao ? ponteiro.blocos : 0,
    );
  }
}

async function writeSecureValue(key: string, value: string): Promise<void> {
  const atual = await readPointer(key);
  const destino: 'a' | 'b' = atual?.geracao === 'a' ? 'b' : 'a';

  const chunks = Array.from(
    { length: Math.ceil(value.length / CHUNK_SIZE) },
    (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );

  // A geração de destino não é a vigente: pode ter sobra de uma gravação que
  // falhou, e mexer nela não afeta o que a leitura devolve.
  await apagarGeracao(key, destino);
  for (const [index, chunk] of chunks.entries()) {
    await SecureStore.setItemAsync(chunkKey(key, destino, index), chunk);
  }

  // Ponto de confirmação: até aqui, a leitura devolve a sessão anterior.
  await SecureStore.setItemAsync(
    metadataKey(key),
    escreverPonteiro({ geracao: destino, blocos: chunks.length }),
  );

  // A nova já vale; o resto é limpeza. Falha aqui deixa só blocos que o
  // ponteiro não referencia, apagados na próxima gravação ou no logout.
  try {
    for (const geracao of GERACOES) {
      if (geracao !== destino) {
        await apagarGeracao(
          key,
          geracao,
          atual?.geracao === geracao ? atual.blocos : 0,
        );
      }
    }
  } catch (error) {
    logger.warn('[secureAuthStorage] Limpeza da sessão anterior falhou', error);
  }
}

async function readSecureValue(key: string): Promise<string | null> {
  const ponteiro = await readPointer(key);
  if (ponteiro) {
    const chunks = await Promise.all(
      Array.from({ length: ponteiro.blocos }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, ponteiro.geracao, index)),
      ),
    );
    return chunks.every((chunk): chunk is string => chunk !== null)
      ? chunks.join('')
      : null;
  }

  const legacyValue = await AsyncStorage.getItem(key);
  if (legacyValue) {
    await writeSecureValue(key, legacyValue);
    await AsyncStorage.removeItem(key);
  }
  return legacyValue;
}

/**
 * Uma operação por vez: duas gravações intercaladas escolheriam a mesma
 * geração de destino e misturariam blocos. A leitura entra na fila porque
 * pode migrar o legado (e grava).
 */
let fila: Promise<unknown> = Promise.resolve();

function emFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = fila.then(operacao, operacao);
  fila = resultado.catch(() => undefined);
  return resultado;
}

/**
 * Armazena somente a sessão de autenticação no cofre criptografado do sistema.
 * Na primeira leitura após a atualização, migra silenciosamente a sessão que
 * versões anteriores mantinham no AsyncStorage.
 */
export const secureAuthStorage: SupportedStorage = {
  getItem(key) {
    return emFila(() => readSecureValue(key));
  },

  setItem(key, value) {
    return emFila(async () => {
      await writeSecureValue(key, value);
      await AsyncStorage.removeItem(key);
    });
  },

  removeItem(key) {
    return emFila(() =>
      Promise.all([removeSecureValue(key), AsyncStorage.removeItem(key)]).then(
        () => undefined,
      ),
    );
  },
};
