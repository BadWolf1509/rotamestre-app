/**
 * Tipos da tela Motoristas do gestor. Moram aqui (e não em
 * `useMotoristasGestor`) para que `useMotoristasOperations` e
 * `useMotoristasModals` não importem o hook que os compõe — o que fechava um
 * ciclo de importação.
 */

export interface MotoristaDetalhado {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  foto_url?: string;
  ativo: boolean;
  created_at: string;
  /**
   * Vínculo com a loja ativa. `false` só para quem atende outra loja e foi
   * desativado nesta: a RLS de usuarios o esconde, então perfil e edição não
   * abrem (só reativar). Ausente fora da lista de listar_motoristas_unidade.
   */
  vinculo_ativo?: boolean;
}
