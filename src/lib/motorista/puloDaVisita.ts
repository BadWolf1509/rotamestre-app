/**
 * Pular os serviços de uma visita juntos (entrega + retirada no mesmo local).
 *
 * Os pulos são sequenciais e param na primeira falha: o motorista precisa
 * saber o que já foi pulado e o que não foi, porque um erro genérico depois
 * de um pulo parcial o deixa sem saber se refaz tudo ou só o que faltou.
 * Módulo puro: sem React; quem chama traduz o erro para o motivo.
 */

import type { ParadaData } from '@/context/route-status/types';

import { rotuloTipoParada } from './rotuloTipoParada';

export interface FalhaNoPulo {
  parada: ParadaData;
  erro: unknown;
  /** Serviços que vinham depois da falha e nem foram tentados. */
  naoTentadas: ParadaData[];
}

export interface ResultadoDoPulo {
  pulados: ParadaData[];
  falha: FalhaNoPulo | null;
  /** Algum pulo ficou guardado no aparelho, sem rede (fila de ações). */
  naFila?: true;
}

export async function pularEmSequencia(
  alvos: ParadaData[],
  pular: (parada: ParadaData) => Promise<unknown>,
): Promise<ResultadoDoPulo> {
  const pulados: ParadaData[] = [];
  let naFila = false;
  for (let i = 0; i < alvos.length; i++) {
    try {
      if ((await pular(alvos[i])) === 'na_fila') naFila = true;
      pulados.push(alvos[i]);
    } catch (erro: unknown) {
      return {
        pulados,
        falha: { parada: alvos[i], erro, naoTentadas: alvos.slice(i + 1) },
        ...(naFila ? { naFila: true as const } : {}),
      };
    }
  }
  return { pulados, falha: null, ...(naFila ? { naFila: true as const } : {}) };
}

function descrever(paradas: ParadaData[]): string {
  const nomes = paradas.map(
    (p) => `${rotuloTipoParada(p.tipo ?? '').titulo} (parada ${p.ordem})`,
  );
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** Aviso de erro do pulo conjunto; `motivo` é o erro já traduzido. */
export function avisoDeFalhaNoPulo(
  pulados: ParadaData[],
  falha: FalhaNoPulo,
  motivo: string,
): { title: string; message: string } {
  const linhas: string[] = [];
  if (pulados.length > 0) {
    linhas.push(
      `${pulados.length > 1 ? 'Puladas' : 'Pulada'}: ${descrever(pulados)}.`,
    );
  }
  linhas.push(`Não foi pulada: ${descrever([falha.parada])}. ${motivo}`);
  if (falha.naoTentadas.length > 0) {
    linhas.push(
      `${falha.naoTentadas.length > 1 ? 'Continuam pendentes' : 'Continua pendente'}: ${descrever(falha.naoTentadas)}.`,
    );
  }
  return {
    title: pulados.length > 0 ? 'Pulo incompleto' : 'Nenhum serviço pulado',
    message: linhas.join('\n'),
  };
}
