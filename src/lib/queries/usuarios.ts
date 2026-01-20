/**
 * User-related Supabase queries
 * Centralized query layer for usuarios table operations
 */

import { getCache, setCache, CACHE_TTL } from '@/lib/cache';
import type { TipoUsuario } from '@/types/usuario';

import {
  supabase,
  withRetry,
  safeQuery,
  classifyError,
  buildCacheKey,
  type QueryResult,
} from './queryClient';

/**
 * Base usuario fields from database
 */
export interface UsuarioDB {
  id: string;
  email: string;
  nome: string;
  papel: TipoUsuario;
  telefone: string | null;
  avatar_url: string | null;
  ativo: boolean;
  primeiro_acesso: boolean;
  ultimo_acesso: string | null;
  criado_em: string;
}

/**
 * Usuario update data
 */
export interface UsuarioUpdate {
  nome?: string;
  email?: string;
  telefone?: string | null;
  avatar_url?: string | null;
  ativo?: boolean;
  primeiro_acesso?: boolean;
  ultimo_acesso?: string | null;
}

/**
 * User with unidade relations
 */
export interface UsuarioWithUnidades extends UsuarioDB {
  unidades?: {
    id: string;
    nome: string;
    cidade: string;
    ativa: boolean;
  } | null;
  usuario_unidades?: Array<{
    id: string;
    usuario_id: string;
    unidade_id: string;
    papel: TipoUsuario;
    is_principal: boolean;
    ativo: boolean;
    unidades: {
      id: string;
      nome: string;
      cidade: string;
      ativa: boolean;
    } | null;
  }>;
}

/**
 * Motorista (driver) list item
 */
export interface MotoristaListItem {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  ativo: boolean;
  ultimo_acesso: string | null;
}

/**
 * Fetch current user profile with all unidade relations
 */
export async function fetchCurrentUser(
  userId: string
): Promise<QueryResult<UsuarioWithUnidades>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        *,
        unidades(*),
        usuario_unidades(
          id, usuario_id, unidade_id, papel, is_principal, ativo,
          unidades(id, nome, cidade, ativa)
        )
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data as unknown as UsuarioWithUnidades;
  });
}

/**
 * Fetch current user with cache (SWR pattern)
 */
export async function fetchCurrentUserWithCache(
  userId: string,
  options?: { forceRefresh?: boolean }
): Promise<QueryResult<UsuarioWithUnidades>> {
  const cacheKey = buildCacheKey('user', userId);

  // Check cache first
  if (!options?.forceRefresh) {
    const cached = await getCache<UsuarioWithUnidades>(cacheKey);
    if (cached) {
      // Revalidate in background
      fetchCurrentUser(userId).then((result) => {
        if (result.success) {
          setCache(cacheKey, result.data, CACHE_TTL.USER_DATA);
        }
      });
      return { success: true, data: cached };
    }
  }

  // Fetch fresh data
  const result = await fetchCurrentUser(userId);
  if (result.success) {
    await setCache(cacheKey, result.data, CACHE_TTL.USER_DATA);
  }

  return result;
}

/**
 * Fetch motoristas (drivers) for a unidade
 */
export async function fetchMotoristasByUnidade(
  unidadeId: string
): Promise<QueryResult<MotoristaListItem[]>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id, nome, email, telefone, avatar_url, ativo, ultimo_acesso,
        usuario_unidades!inner(unidade_id, papel, ativo)
      `)
      .eq('usuario_unidades.unidade_id', unidadeId)
      .eq('usuario_unidades.papel', 'motorista')
      .eq('usuario_unidades.ativo', true)
      .order('nome');

    if (error) throw error;

    return (data || []).map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      telefone: u.telefone,
      avatar_url: u.avatar_url,
      ativo: u.ativo,
      ultimo_acesso: u.ultimo_acesso,
    }));
  });
}

/**
 * Fetch motoristas with cache
 */
export async function fetchMotoristasWithCache(
  unidadeId: string,
  options?: { forceRefresh?: boolean }
): Promise<QueryResult<MotoristaListItem[]>> {
  const cacheKey = buildCacheKey('motoristas', unidadeId);

  // Check cache first
  if (!options?.forceRefresh) {
    const cached = await getCache<MotoristaListItem[]>(cacheKey);
    if (cached) {
      // Revalidate in background
      fetchMotoristasByUnidade(unidadeId).then((result) => {
        if (result.success) {
          setCache(cacheKey, result.data, CACHE_TTL.MOTORISTAS);
        }
      });
      return { success: true, data: cached };
    }
  }

  // Fetch fresh data
  const result = await fetchMotoristasByUnidade(unidadeId);
  if (result.success) {
    await setCache(cacheKey, result.data, CACHE_TTL.MOTORISTAS);
  }

  return result;
}

/**
 * Fetch user by ID
 */
export async function fetchUsuarioById(
  userId: string
): Promise<QueryResult<UsuarioDB>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, papel, email, telefone, avatar_url, ativo, ultimo_acesso, criado_em, primeiro_acesso')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data as UsuarioDB;
  });
}

/**
 * Fetch users by role in a unidade
 */
export async function fetchUsuariosByPapel(
  unidadeId: string,
  papel: TipoUsuario
): Promise<QueryResult<UsuarioDB[]>> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id, nome, papel, email, telefone, avatar_url, ativo, ultimo_acesso, criado_em, primeiro_acesso,
        usuario_unidades!inner(unidade_id, papel, ativo)
      `)
      .eq('usuario_unidades.unidade_id', unidadeId)
      .eq('usuario_unidades.papel', papel)
      .eq('usuario_unidades.ativo', true)
      .order('nome');

    if (error) throw error;
    return (data || []) as unknown as UsuarioDB[];
  });
}

/**
 * Update user profile
 */
export async function updateUsuario(
  userId: string,
  data: UsuarioUpdate
): Promise<QueryResult<UsuarioDB>> {
  return withRetry(async () => {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return usuario as UsuarioDB;
  }).then(
    (data) => ({ success: true as const, data }),
    (error) => ({ success: false as const, error: classifyError(error) })
  );
}

/**
 * Update user last access timestamp
 */
export async function updateUltimoAcesso(
  userId: string
): Promise<QueryResult<void>> {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('usuarios')
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
  });
}

/**
 * Update user avatar URL
 */
export async function updateAvatarUrl(
  userId: string,
  avatarUrl: string | null
): Promise<QueryResult<UsuarioDB>> {
  return updateUsuario(userId, { avatar_url: avatarUrl });
}

/**
 * Check if email exists (for validation)
 */
export async function checkEmailExists(
  email: string,
  excludeUserId?: string
): Promise<QueryResult<boolean>> {
  return safeQuery(async () => {
    let query = supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data !== null;
  });
}

/**
 * Fetch user performance KPIs (for motorista)
 */
export async function fetchMotoristaKPIs(
  motoristaId: string,
  periodo: { inicio: string; fim: string }
): Promise<QueryResult<{
  rotasConcluidas: number;
  paradasConcluidas: number;
  tempoMedioMinutos: number;
  taxaConclusao: number;
}>> {
  return safeQuery(async () => {
    const { data: rotas, error } = await supabase
      .from('rotas')
      .select('id, status, duracao_total_minutos, iniciada_em, concluida_em')
      .eq('motorista_id', motoristaId)
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim);

    if (error) throw error;

    const concluidas = rotas?.filter((r) => r.status === 'concluida') || [];
    const total = rotas?.length || 0;

    let tempoTotal = 0;
    for (const rota of concluidas) {
      if (rota.duracao_total_minutos) {
        tempoTotal += rota.duracao_total_minutos;
      }
    }

    // Get paradas stats
    const rotaIds = rotas?.map((r) => r.id) || [];
    let paradasConcluidas = 0;

    if (rotaIds.length > 0) {
      const { data: paradas, error: paradasError } = await supabase
        .from('paradas')
        .select('id, status, is_checkpoint')
        .in('rota_id', rotaIds)
        .eq('is_checkpoint', true)
        .eq('status', 'concluida');

      if (paradasError) throw paradasError;
      paradasConcluidas = paradas?.length || 0;
    }

    return {
      rotasConcluidas: concluidas.length,
      paradasConcluidas,
      tempoMedioMinutos: concluidas.length > 0
        ? Math.round(tempoTotal / concluidas.length)
        : 0,
      taxaConclusao: total > 0
        ? Math.round((concluidas.length / total) * 100)
        : 0,
    };
  });
}
