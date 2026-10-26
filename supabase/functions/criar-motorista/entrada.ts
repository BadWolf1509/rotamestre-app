// Entrada e permissão da criar-motorista (sem Deno/fetch), testáveis no Jest.
//
// `validarCorpo` confere o corpo da requisição e devolve 400 com o campo que
// não serve; `decidirPermissao` separa "quem chamou não pode" (403) de "não deu
// para conferir agora" (503), para que uma falha do banco não seja lida como
// recusa de permissão.

export interface DadosNovoMotorista {
  nome: string;
  email: string;
  senha: string;
  telefone: string | null;
  unidadeId: string | null;
}

export type ResultadoCorpo =
  | { ok: true; dados: DadosNovoMotorista }
  | { ok: false; status: 400; error: string };

export type Permissao = 'ok' | 'proibido' | 'indisponivel';

export const MSG_CORPO_INVALIDO = 'Corpo da requisição inválido.';
export const MSG_OBRIGATORIOS = 'Nome, email e senha são obrigatórios';
export const MSG_PERMISSAO_INDISPONIVEL =
  'Não foi possível conferir sua permissão. Tente de novo.';
export const msgCampoInvalido = (campo: string) => `Campo inválido: ${campo}.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const recusa = (error: string): ResultadoCorpo => ({
  ok: false,
  status: 400,
  error,
});

export function validarCorpo(corpo: unknown): ResultadoCorpo {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    return recusa(MSG_CORPO_INVALIDO);
  }
  const c = corpo as Record<string, unknown>;

  const obrigatorios: Record<'nome' | 'email' | 'senha', string> = {
    nome: '',
    email: '',
    senha: '',
  };
  for (const campo of ['nome', 'email', 'senha'] as const) {
    const valor = c[campo];
    if (valor === undefined || valor === null) return recusa(MSG_OBRIGATORIOS);
    if (typeof valor !== 'string') return recusa(msgCampoInvalido(campo));
    if (valor.trim() === '') return recusa(MSG_OBRIGATORIOS);
    obrigatorios[campo] = valor;
  }

  let telefone: string | null = null;
  if (c.telefone !== undefined && c.telefone !== null) {
    if (typeof c.telefone !== 'string') {
      return recusa(msgCampoInvalido('telefone'));
    }
    telefone = c.telefone.trim() || null;
  }

  let unidadeId: string | null = null;
  if (c.unidade_id !== undefined && c.unidade_id !== null) {
    if (typeof c.unidade_id !== 'string' || !UUID.test(c.unidade_id)) {
      return recusa(msgCampoInvalido('unidade_id'));
    }
    unidadeId = c.unidade_id;
  }

  return { ok: true, dados: { ...obrigatorios, telefone, unidadeId } };
}

export function decidirPermissao(e: {
  erroGestor: { code?: string } | null;
  gestor: { papel?: string | null; ativo?: boolean | null } | null;
  unidadeId: string | null;
  erroVinculo: { code?: string } | null;
  vinculo: unknown;
}): Permissao {
  // `.single()` sem linha devolve PGRST116: é "sem perfil", não falha.
  if (e.erroGestor && e.erroGestor.code !== 'PGRST116') return 'indisponivel';
  if (!e.gestor || e.gestor.papel !== 'gestor' || !e.gestor.ativo) {
    return 'proibido';
  }
  if (!e.unidadeId) return 'proibido';
  if (e.erroVinculo) return 'indisponivel';
  if (!e.vinculo) return 'proibido';
  return 'ok';
}
