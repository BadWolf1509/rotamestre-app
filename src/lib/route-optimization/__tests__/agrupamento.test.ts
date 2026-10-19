/**
 * Agrupamento de paradas em visitas antes do TSP.
 *
 * Paradas no MESMO ponto (ex.: entrega + retirada para o mesmo cliente, numa
 * operação de locação) têm de sair consecutivas e com a entrega antes da
 * retirada. O TSP não garante isso — com dois pontos idênticos, a força bruta
 * e o 2-opt podem separá-los —, então o agrupamento acontece antes dele.
 */

import type { Parada } from '@/components/gestor/nova-entrega/types';
import { validarOrdemDependencias } from '@/hooks/useNovaEntrega.helpers';

import {
  agruparParadasEmVisitas,
  expandirOrdemDasVisitas,
} from '../agrupamento';

import type { ParadaParaOtimizar } from '../types';

const BASE = { latitude: -7.115, longitude: -34.863 };

/** Desloca `metros` para o norte (1° de latitude ≈ 111.195 m). */
function aoNorte(metros: number) {
  return {
    latitude: BASE.latitude + metros / 111195,
    longitude: BASE.longitude,
  };
}

/** Ponto distante, um por índice, para paradas que não se repetem. */
function longe(i: number) {
  return {
    latitude: BASE.latitude + 0.01 * (i + 1),
    longitude: BASE.longitude + 0.007 * ((i * 3) % 5),
  };
}

function parada(
  id: string,
  tipo: 'entrega' | 'retirada',
  coords: { latitude: number; longitude: number },
  vinculo_parada_id?: string,
): ParadaParaOtimizar {
  return {
    id,
    tipo,
    endereco: `Rua ${id}`,
    ordem: 0,
    ...coords,
    vinculo_parada_id,
  };
}

const ids = (grupos: ParadaParaOtimizar[][]) =>
  grupos.map((g) => g.map((p) => p.id));

describe('agruparParadasEmVisitas', () => {
  it('junta entrega e retirada no mesmo ponto, com a entrega primeiro', () => {
    const paradas = [
      parada('e1', 'entrega', BASE),
      parada('r1', 'retirada', BASE),
    ];

    expect(ids(agruparParadasEmVisitas(paradas))).toEqual([['e1', 'r1']]);
  });

  it('põe a entrega antes mesmo quando a retirada foi cadastrada antes', () => {
    const paradas = [
      parada('a', 'entrega', longe(0)),
      parada('r1', 'retirada', BASE),
      parada('b', 'entrega', longe(1)),
      parada('e1', 'entrega', BASE),
    ];

    expect(ids(agruparParadasEmVisitas(paradas))).toEqual([
      ['a'],
      ['e1', 'r1'],
      ['b'],
    ]);
  });

  it('agrupa pontos a 25 m e não agrupa a 40 m', () => {
    const perto = [
      parada('r1', 'retirada', BASE),
      parada('e1', 'entrega', aoNorte(25)),
    ];
    const distante = [
      parada('r1', 'retirada', BASE),
      parada('e1', 'entrega', aoNorte(40)),
    ];

    expect(ids(agruparParadasEmVisitas(perto))).toEqual([['e1', 'r1']]);
    expect(ids(agruparParadasEmVisitas(distante))).toEqual([['r1'], ['e1']]);
  });

  it('mede o raio a partir da primeira parada do local, sem encadear', () => {
    // 0 m, 25 m e 50 m: a do meio cabe no raio da primeira, a última não —
    // encadear de vizinho em vizinho juntaria uma rua inteira.
    const paradas = [
      parada('p0', 'entrega', BASE),
      parada('p25', 'entrega', aoNorte(25)),
      parada('p50', 'entrega', aoNorte(50)),
    ];

    expect(ids(agruparParadasEmVisitas(paradas))).toEqual([
      ['p0', 'p25'],
      ['p50'],
    ]);
  });

  it('mantém 3 paradas no mesmo ponto: entregas primeiro, em ordem estável', () => {
    const paradas = [
      parada('r1', 'retirada', BASE),
      parada('e1', 'entrega', BASE),
      parada('r2', 'retirada', BASE),
      parada('e2', 'entrega', BASE),
    ];

    expect(ids(agruparParadasEmVisitas(paradas))).toEqual([
      ['e1', 'e2', 'r1', 'r2'],
    ]);
  });

  it('vínculo sobreposto a um local: Y … entrega → X', () => {
    // Y é a retirada vinculada (outro endereço); a entrega divide o ponto com
    // a retirada X, que não tem vínculo nenhum.
    const paradas = [
      parada('x', 'retirada', BASE),
      parada('e', 'entrega', BASE, 'y'),
      parada('y', 'retirada', longe(0)),
    ];

    const grupos = agruparParadasEmVisitas(paradas);

    expect(ids(grupos)).toEqual([['y', 'e', 'x']]);
  });

  it('vínculo dentro do mesmo ponto: a retirada vinculada vem antes da entrega', () => {
    const paradas = [
      parada('x', 'retirada', BASE),
      parada('e', 'entrega', BASE, 'y'),
      parada('y', 'retirada', BASE),
    ];

    expect(ids(agruparParadasEmVisitas(paradas))).toEqual([['y', 'e', 'x']]);
  });

  it('sem nenhum ponto repetido, reproduz o agrupamento antigo por dependência', () => {
    const paradas = [
      parada('ind1', 'entrega', longe(0)),
      parada('r1', 'retirada', longe(1)),
      parada('e1', 'entrega', longe(2), 'r1'),
      parada('ind2', 'retirada', longe(3)),
      parada('e2', 'entrega', longe(4), 'r1'),
    ];

    // Antes: grupos de dependência primeiro ([retirada, ...entregas]),
    // depois as independentes na ordem de entrada.
    expect(ids(agruparParadasEmVisitas(paradas))).toEqual([
      ['r1', 'e1', 'e2'],
      ['ind1'],
      ['ind2'],
    ]);
  });

  it('sem ponto repetido e sem vínculo, cada parada é sua própria visita', () => {
    const paradas = Array.from({ length: 12 }, (_, i) =>
      parada(`p${i}`, i % 2 ? 'retirada' : 'entrega', longe(i)),
    );

    expect(ids(agruparParadasEmVisitas(paradas))).toEqual(
      paradas.map((p) => [p.id]),
    );
  });

  it('a ordem expandida respeita a validação de dependências do cadastro', () => {
    const paradas = [
      parada('x', 'retirada', BASE),
      parada('e', 'entrega', BASE, 'y'),
      parada('a', 'entrega', longe(1)),
      parada('y', 'retirada', longe(0)),
      parada('r', 'retirada', aoNorte(10)),
    ];

    const grupos = agruparParadasEmVisitas(paradas);
    const ordem = expandirOrdemDasVisitas(
      grupos,
      paradas,
      grupos.map((_, i) => grupos.length - 1 - i),
    );
    const ordenadas = ordem.map((i) => paradas[i]);

    // validarOrdemDependencias é a mesma regra da RPC criar_rota_com_paradas:
    // a retirada vinculada tem ordem menor que a da entrega.
    const comoParada = ordenadas.map(
      (p) => ({ ...p, destinatario: p.id }) as unknown as Parada,
    );
    expect(validarOrdemDependencias(comoParada)).toEqual([]);
    expect(ordenadas.map((p) => p.id)).toEqual(['a', 'y', 'e', 'x', 'r']);
  });
});

describe('expandirOrdemDasVisitas', () => {
  it('devolve os índices originais das paradas, visita por visita', () => {
    const paradas = [
      parada('r1', 'retirada', BASE),
      parada('a', 'entrega', longe(0)),
      parada('e1', 'entrega', BASE),
    ];
    const grupos = agruparParadasEmVisitas(paradas);

    // grupos = [[e1, r1], [a]] → TSP manda a visita 1 primeiro.
    expect(expandirOrdemDasVisitas(grupos, paradas, [1, 0])).toEqual([1, 2, 0]);
  });

  it('cai na ordem natural das visitas quando o TSP não devolve uma ordem completa', () => {
    const paradas = [
      parada('r1', 'retirada', BASE),
      parada('e1', 'entrega', BASE),
    ];
    const grupos = agruparParadasEmVisitas(paradas);

    expect(expandirOrdemDasVisitas(grupos, paradas, [])).toEqual([1, 0]);
  });
});

/**
 * Cópia do `agruparPorDependencia` que o otimizador usava até 19/10/2026,
 * mantida só como referência: sem ponto repetido, o agrupamento novo tem de
 * devolver exatamente os mesmos grupos, na mesma ordem.
 */
function agruparPorDependenciaAntigo(paradas: ParadaParaOtimizar[]) {
  const grupos: ParadaParaOtimizar[][] = [];
  const independentes: ParadaParaOtimizar[] = [];
  const processados = new Set<string>();
  const retiradasComVinculos = new Map<string, ParadaParaOtimizar[]>();

  paradas.forEach((p) => {
    if (p.vinculo_parada_id) {
      const vinculadas = retiradasComVinculos.get(p.vinculo_parada_id) || [];
      vinculadas.push(p);
      retiradasComVinculos.set(p.vinculo_parada_id, vinculadas);
    }
  });
  paradas.forEach((p) => {
    if (processados.has(p.id)) return;
    if (p.tipo === 'retirada' && retiradasComVinculos.has(p.id)) {
      const grupo = [p, ...retiradasComVinculos.get(p.id)!];
      grupos.push(grupo);
      grupo.forEach((g) => processados.add(g.id));
    } else if (!p.vinculo_parada_id) {
      independentes.push(p);
      processados.add(p.id);
    }
  });
  return [...grupos, ...independentes.map((p) => [p])];
}

describe('regressão: rota sem ponto repetido', () => {
  /** Gerador determinístico (LCG) para não depender de Math.random. */
  function gerador(semente: number) {
    let s = semente;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it.each(Array.from({ length: 40 }, (_, i) => i + 1))(
    'semente %i: mesmos grupos e mesma ordem do agrupamento antigo',
    (semente) => {
      const aleatorio = gerador(semente);
      const n = 2 + Math.floor(aleatorio() * 20);
      const paradas: ParadaParaOtimizar[] = Array.from({ length: n }, (_, i) =>
        parada(`p${i}`, aleatorio() < 0.5 ? 'retirada' : 'entrega', longe(i)),
      );
      // Vínculos válidos: entrega → retirada qualquer da rota.
      const retiradas = paradas.filter((p) => p.tipo === 'retirada');
      paradas.forEach((p) => {
        if (p.tipo === 'entrega' && retiradas.length > 0 && aleatorio() < 0.4) {
          p.vinculo_parada_id =
            retiradas[Math.floor(aleatorio() * retiradas.length)].id;
        }
      });

      expect(ids(agruparParadasEmVisitas(paradas))).toEqual(
        ids(agruparPorDependenciaAntigo(paradas)),
      );
    },
  );
});
