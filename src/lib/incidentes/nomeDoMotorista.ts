// Nome do motorista de um incidente, para o gestor.
//
// Desde a Migration 56, excluir a conta do motorista não apaga o incidente:
// `incidentes.motorista_id` vira NULL (anonimizado) e o registro fica com a
// loja. `motorista_id` NULL é, portanto, "conta excluída" — diferente de
// "Desconhecido", que é a pessoa existir mas a linha de `usuarios` não vir (a
// RLS escondeu).

export const MOTORISTA_REMOVIDO = 'Motorista removido';

export function nomeDoMotorista(
  motoristaId: string | null,
  nome: string | null | undefined,
): string {
  if (motoristaId === null) return MOTORISTA_REMOVIDO;
  return nome || 'Desconhecido';
}
