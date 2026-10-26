import { z } from 'zod';

/** Teto das observações do gestor num incidente (campo e validação). */
export const LIMITE_OBSERVACOES_INCIDENTE = 1000;

export const MENSAGEM_LIMITE_OBSERVACOES_INCIDENTE = `Observações devem ter no máximo ${LIMITE_OBSERVACOES_INCIDENTE} caracteres`;

/**
 * Observações da gestão ao mudar o status de um incidente. Vazio é válido.
 * O `maxLength` do campo impede digitar além; o schema cobre o texto que já
 * veio do banco acima do limite.
 */
export const observacoesIncidenteSchema = z
  .string()
  .max(LIMITE_OBSERVACOES_INCIDENTE, MENSAGEM_LIMITE_OBSERVACOES_INCIDENTE);
