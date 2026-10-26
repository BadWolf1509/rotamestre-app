import { destinoDaNotificacao } from '../destinoDaNotificacao';

/**
 * Cada tipo vai para um papel (send-push-notification + triggers do banco);
 * `rota_nao_executada` vai para os dois. O destino tem de ser uma tela que
 * EXISTE para quem recebe — o gestor não abre `_screens/` do motorista e o
 * motorista é expulso da área do gestor.
 */
describe('destinoDaNotificacao', () => {
  describe('motorista', () => {
    it.each([
      'nova_rota_atribuida',
      'lembrete_rota_pendente',
      'lembrete_rota_urgente',
    ])('%s vai para a Início', (tipo) => {
      expect(destinoDaNotificacao(tipo, 'r1', 'motorista')).toEqual({
        caminho: '/motorista',
        modo: 'navigate',
      });
    });

    it.each([
      'rota_parada_adicionada',
      'rota_parada_removida',
      'rota_parada_editada',
      'rota_reordenada',
    ])('%s vai para a aba Paradas, nunca para a área do gestor', (tipo) => {
      expect(destinoDaNotificacao(tipo, 'r1', 'motorista')).toEqual({
        caminho: '/motorista/paradas',
        modo: 'navigate',
      });
    });

    it('rota_nao_executada vai para o histórico', () => {
      expect(
        destinoDaNotificacao('rota_nao_executada', 'r1', 'motorista'),
      ).toEqual({
        caminho: '/motorista/historico',
        modo: 'navigate',
      });
    });
  });

  describe('gestor', () => {
    it.each([
      'rota_iniciada',
      'rota_concluida',
      'rota_atrasada',
      'rota_nao_executada',
      'parada_pulada',
      'parada_reaberta',
    ])('%s abre o mapa da rota', (tipo) => {
      expect(destinoDaNotificacao(tipo, 'r9', 'gestor')).toEqual({
        caminho: '/gestor/mapa-rota?id=r9',
        modo: 'push',
      });
    });

    it('sem rota_id cai na gestão de rotas', () => {
      expect(
        destinoDaNotificacao('parada_pulada', undefined, 'gestor'),
      ).toEqual({
        caminho: '/gestor/gestao-rotas',
        modo: 'push',
      });
    });

    it.each(['sos_acionado', 'incidente_reportado'])(
      '%s abre os incidentes',
      (tipo) => {
        expect(destinoDaNotificacao(tipo, 'r9', 'gestor')).toEqual({
          caminho: '/gestor/incidentes',
          modo: 'push',
        });
      },
    );
  });

  describe('papel desconhecido (perfil ainda não lido no aparelho)', () => {
    it('tipo exclusivo de gestor vai para o gestor', () => {
      expect(destinoDaNotificacao('parada_pulada', 'r1', null)?.caminho).toBe(
        '/gestor/mapa-rota?id=r1',
      );
    });

    it('tipo exclusivo de motorista vai para o motorista', () => {
      expect(destinoDaNotificacao('rota_reordenada', 'r1', null)?.caminho).toBe(
        '/motorista/paradas',
      );
    });

    it('tipo dos dois papéis vai para a raiz, que roteia pelo papel', () => {
      expect(destinoDaNotificacao('rota_nao_executada', 'r1', null)).toEqual({
        caminho: '/',
        modo: 'navigate',
      });
    });
  });

  it('tipo desconhecido não navega', () => {
    expect(destinoDaNotificacao('outro', 'r1', 'gestor')).toBeNull();
    expect(destinoDaNotificacao(undefined, 'r1', 'motorista')).toBeNull();
  });
});
