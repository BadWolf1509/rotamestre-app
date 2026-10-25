import { sinalLinhaDoTempo } from '../sinalLinhaDoTempo';

const parada = (id: string, status: string, concluida_em?: string) => ({
  id,
  status,
  concluida_em,
});

describe('sinalLinhaDoTempo', () => {
  it('muda quando uma parada é concluída', () => {
    const antes = sinalLinhaDoTempo('em_andamento', [
      parada('p1', 'concluida', '2026-10-25T13:00:00Z'),
      parada('p2', 'em_andamento'),
    ]);
    const depois = sinalLinhaDoTempo('em_andamento', [
      parada('p1', 'concluida', '2026-10-25T13:00:00Z'),
      parada('p2', 'concluida', '2026-10-25T13:05:00Z'),
    ]);
    expect(depois).not.toBe(antes);
  });

  it('muda quando o status da rota muda (iniciar, cancelar, finalizar)', () => {
    const paradas = [parada('p1', 'pendente')];
    expect(sinalLinhaDoTempo('em_andamento', paradas)).not.toBe(
      sinalLinhaDoTempo('cancelada', paradas),
    );
  });

  it('não muda com objetos novos de conteúdo igual (recarga do realtime)', () => {
    const a = sinalLinhaDoTempo('pendente', [parada('p1', 'pendente')]);
    const b = sinalLinhaDoTempo('pendente', [parada('p1', 'pendente')]);
    expect(a).toBe(b);
  });
});
