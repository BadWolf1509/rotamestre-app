import { agruparEventosPorDia } from '../timeline';

// Meio-dia local: não atravessa a virada do dia em nenhum fuso razoável.
const evento = (id: string, ano: number, mes: number, dia: number, h = 12) => ({
  id,
  timestamp: new Date(ano, mes - 1, dia, h, 0, 0).toISOString(),
});

const AGORA = new Date(2025, 10, 20, 15, 0, 0); // 20/11/2025 local

describe('agruparEventosPorDia', () => {
  it('ordena dias de meses diferentes do mais novo para o mais antigo', () => {
    const grupos = agruparEventosPorDia(
      [
        evento('a', 2025, 9, 28),
        evento('b', 2025, 11, 2),
        evento('c', 2025, 10, 30),
        evento('d', 2024, 12, 31),
      ],
      AGORA,
    );

    expect(grupos.map((g) => g.events[0].id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('Hoje e Ontem vêm primeiro, com rótulo próprio', () => {
    const grupos = agruparEventosPorDia(
      [
        evento('antigo', 2025, 11, 1),
        evento('ontem', 2025, 11, 19),
        evento('hoje', 2025, 11, 20),
      ],
      AGORA,
    );

    expect(grupos.map((g) => g.date)).toEqual(['Hoje', 'Ontem', '01/11/2025']);
  });

  it('junta os eventos do mesmo dia local num grupo só', () => {
    const grupos = agruparEventosPorDia(
      [
        evento('manha', 2025, 11, 20, 8),
        evento('tarde', 2025, 11, 20, 14),
        evento('outro', 2025, 11, 10),
      ],
      AGORA,
    );

    expect(grupos).toHaveLength(2);
    expect(grupos[0].events.map((e) => e.id)).toEqual(['manha', 'tarde']);
  });

  // Hermes sem dados de locale devolve o texto em en-US (mês/dia/ano): a
  // ordem não pode depender de reler o rótulo.
  it('a ordem não depende do texto do rótulo (locale sem pt-BR)', () => {
    const original = Date.prototype.toLocaleDateString;
    jest
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockImplementation(function (this: Date) {
        return `${this.getMonth() + 1}/${this.getDate()}/${this.getFullYear()}`;
      });

    try {
      const grupos = agruparEventosPorDia(
        [
          evento('a', 2025, 10, 5),
          evento('b', 2025, 11, 3),
          evento('c', 2025, 9, 25),
        ],
        AGORA,
      );

      expect(grupos.map((g) => g.events[0].id)).toEqual(['b', 'a', 'c']);
    } finally {
      jest.restoreAllMocks();
      expect(Date.prototype.toLocaleDateString).toBe(original);
    }
  });

  it('lista vazia devolve nenhum grupo', () => {
    expect(agruparEventosPorDia([], AGORA)).toEqual([]);
  });
});
