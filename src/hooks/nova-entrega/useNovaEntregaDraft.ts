import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type {
  Parada,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface NovaEntregaDraftPayload {
  paradas: Parada[];
  motoristaSelecionado: string;
  dataRota: string;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
}

interface UseNovaEntregaDraftOptions {
  userId: string | null;
  unidadeId: string | null;
  payload: NovaEntregaDraftPayload;
  onRestore: (payload: NovaEntregaDraftPayload | null) => void;
}

interface DraftRow {
  payload: unknown;
  atualizado_em: string;
  expira_em: string;
}

const SAVE_DEBOUNCE_MS = 800;
const EXPIRATION_DAYS = 7;
const SESSION_KEY_PREFIX = 'rotamestre:nova-entrega';

interface SessionDraft {
  payload: unknown;
  updatedAt: string;
  expiresAt: string;
}

function isParada(value: unknown): value is Parada {
  if (!value || typeof value !== 'object') return false;
  const parada = value as Partial<Parada>;
  return (
    typeof parada.id === 'string' &&
    (parada.tipo === 'entrega' || parada.tipo === 'retirada') &&
    typeof parada.endereco === 'string' &&
    typeof parada.destinatario === 'string' &&
    typeof parada.telefone === 'string' &&
    typeof parada.ordem === 'number'
  );
}

function parseDraftPayload(value: unknown): NovaEntregaDraftPayload | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Partial<NovaEntregaDraftPayload>;
  if (!Array.isArray(payload.paradas) || !payload.paradas.every(isParada))
    return null;
  if (typeof payload.motoristaSelecionado !== 'string') return null;
  if (typeof payload.dataRota !== 'string') return null;
  if (typeof payload.ordemManual !== 'boolean') return null;

  return {
    paradas: payload.paradas,
    motoristaSelecionado: payload.motoristaSelecionado,
    dataRota: payload.dataRota,
    rotaOtimizada: payload.rotaOtimizada ?? null,
    ordemManual: payload.ordemManual,
  };
}

function getSessionKey(userId: string, unidadeId: string): string {
  return `${SESSION_KEY_PREFIX}:${userId}:${unidadeId}`;
}

function readSessionDraft(
  userId: string,
  unidadeId: string,
): { payload: NovaEntregaDraftPayload; updatedAt: string } | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined')
    return null;

  try {
    const raw = sessionStorage.getItem(getSessionKey(userId, unidadeId));
    if (!raw) return null;
    const stored = JSON.parse(raw) as SessionDraft;
    const payload = parseDraftPayload(stored.payload);
    if (
      !payload ||
      typeof stored.updatedAt !== 'string' ||
      typeof stored.expiresAt !== 'string' ||
      new Date(stored.expiresAt).getTime() <= Date.now()
    ) {
      sessionStorage.removeItem(getSessionKey(userId, unidadeId));
      return null;
    }
    return { payload, updatedAt: stored.updatedAt };
  } catch {
    try {
      sessionStorage.removeItem(getSessionKey(userId, unidadeId));
    } catch {
      // Armazenamento de sessão pode estar bloqueado pelo navegador.
    }
    return null;
  }
}

function writeSessionDraft(
  userId: string,
  unidadeId: string,
  payload: NovaEntregaDraftPayload,
): void {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    const key = getSessionKey(userId, unidadeId);
    if (payload.paradas.length === 0) {
      sessionStorage.removeItem(key);
      return;
    }

    const now = new Date();
    sessionStorage.setItem(
      key,
      JSON.stringify({
        payload,
        updatedAt: now.toISOString(),
        expiresAt: new Date(
          now.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
      } satisfies SessionDraft),
    );
  } catch {
    // O rascunho no servidor continua sendo a fonte durável.
  }
}

function clearSessionDraft(userId: string, unidadeId: string): void {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(getSessionKey(userId, unidadeId));
  } catch {
    // Sem ação: o servidor ainda será limpo pela mesma operação.
  }
}

export function useNovaEntregaDraft({
  userId,
  unidadeId,
  payload,
  onRestore,
}: UseNovaEntregaDraftOptions) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const readyRef = useRef(false);
  const scopeKey = `${userId ?? 'anonymous'}:${unidadeId ?? 'no-unit'}`;
  const scopeRef = useRef(scopeKey);

  if (scopeRef.current !== scopeKey) {
    scopeRef.current = scopeKey;
    readyRef.current = false;
  }

  const serializedPayload = useMemo(() => JSON.stringify(payload), [payload]);

  // Escritas no servidor em FILA: um upsert só começa quando o anterior
  // terminou. Sem isso, dois salvamentos próximos podiam chegar fora de ordem
  // (o mais velho por último), e um upsert em voo podia ultrapassar o delete
  // de `clearDraft`, ressuscitando o rascunho de uma rota já criada.
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const enfileirar = useCallback((operacao: () => Promise<void>) => {
    const vez = filaRef.current.then(operacao, operacao);
    filaRef.current = vez.catch(() => undefined);
    return vez;
  }, []);
  // `clearDraft` sobe a época: salvamento agendado antes dela não grava mais.
  const epocaRef = useRef(0);
  // Payload do rascunho que acabou de ser restaurado: o pai o aplica e isso
  // mudaria o `serializedPayload` — regravá-lo renovaria `expira_em` sem
  // edição nenhuma (os 7 dias valeriam da última abertura, não da edição).
  const restauradoRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    setIsHydrating(true);
    setLastSavedAt(null);
    setSaveError(null);

    restauradoRef.current = null;
    const restaurar = (restaurado: NovaEntregaDraftPayload | null) => {
      restauradoRef.current = restaurado ? JSON.stringify(restaurado) : null;
      onRestore(restaurado);
    };

    async function restoreDraft() {
      if (!userId || !unidadeId) {
        if (!cancelled) {
          restaurar(null);
          readyRef.current = true;
          setIsHydrating(false);
        }
        return;
      }

      const sessionDraft = readSessionDraft(userId, unidadeId);
      try {
        const { data, error } = await supabase
          .from('rascunhos_rota')
          .select('payload, atualizado_em, expira_em')
          .eq('usuario_id', userId)
          .eq('unidade_id', unidadeId)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        const row = data as DraftRow | null;
        const expired = row && new Date(row.expira_em).getTime() <= Date.now();
        if (expired) {
          await supabase
            .from('rascunhos_rota')
            .delete()
            .eq('usuario_id', userId)
            .eq('unidade_id', unidadeId);
          if (sessionDraft) {
            restaurar(sessionDraft.payload);
            setLastSavedAt(sessionDraft.updatedAt);
          } else {
            restaurar(null);
          }
        } else {
          const serverPayload = row ? parseDraftPayload(row.payload) : null;
          const useSession =
            sessionDraft &&
            (!row ||
              new Date(sessionDraft.updatedAt).getTime() >
                new Date(row.atualizado_em).getTime());
          restaurar(
            useSession
              ? sessionDraft.payload
              : (serverPayload ?? sessionDraft?.payload ?? null),
          );
          setLastSavedAt(
            useSession
              ? sessionDraft.updatedAt
              : (row?.atualizado_em ?? sessionDraft?.updatedAt ?? null),
          );
        }
      } catch (error) {
        logger.error(
          '[NovaEntregaDraft] Não foi possível restaurar o rascunho',
          error,
        );
        if (!cancelled) {
          restaurar(sessionDraft?.payload ?? null);
          setLastSavedAt(sessionDraft?.updatedAt ?? null);
          setSaveError(
            'Rascunho restaurado apenas neste navegador; servidor indisponível.',
          );
        }
      } finally {
        if (!cancelled) {
          readyRef.current = true;
          setIsHydrating(false);
        }
      }
    }

    restoreDraft();
    return () => {
      cancelled = true;
    };
  }, [onRestore, scopeKey, unidadeId, userId]);

  useEffect(() => {
    if (!readyRef.current || !userId || !unidadeId) return;
    writeSessionDraft(
      userId,
      unidadeId,
      JSON.parse(serializedPayload) as NovaEntregaDraftPayload,
    );
  }, [serializedPayload, unidadeId, userId]);

  useEffect(() => {
    if (!readyRef.current || !userId || !unidadeId) return;

    // O que acabou de ser restaurado já está no servidor: nada a gravar até
    // uma edição de verdade (payload diferente do restaurado).
    if (restauradoRef.current !== null) {
      if (restauradoRef.current === serializedPayload) return;
      restauradoRef.current = null;
    }

    const epoca = epocaRef.current;
    const timer = setTimeout(() => {
      void enfileirar(async () => {
        // Rascunho limpo (rota criada) enquanto esperava a vez: não grava.
        if (epoca !== epocaRef.current) return;
        setIsSaving(true);
        try {
          if (payload.paradas.length === 0) {
            const { error } = await supabase
              .from('rascunhos_rota')
              .delete()
              .eq('usuario_id', userId)
              .eq('unidade_id', unidadeId);
            if (error) throw error;
            setLastSavedAt(null);
            setSaveError(null);
            return;
          }

          const expiresAt = new Date(
            Date.now() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString();
          const updatedAt = new Date().toISOString();
          const { error } = await supabase.from('rascunhos_rota').upsert(
            {
              usuario_id: userId,
              unidade_id: unidadeId,
              payload: JSON.parse(serializedPayload),
              atualizado_em: updatedAt,
              expira_em: expiresAt,
            },
            { onConflict: 'usuario_id,unidade_id' },
          );
          if (error) throw error;
          setLastSavedAt(updatedAt);
          setSaveError(null);
        } catch (error) {
          logger.error(
            '[NovaEntregaDraft] Não foi possível salvar o rascunho',
            error,
          );
          setSaveError(
            'Não foi possível sincronizar o rascunho com o servidor.',
          );
        } finally {
          setIsSaving(false);
        }
      });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    enfileirar,
    payload.paradas.length,
    serializedPayload,
    unidadeId,
    userId,
  ]);

  const clearDraft = useCallback(async () => {
    if (!userId || !unidadeId) return;
    clearSessionDraft(userId, unidadeId);
    // Invalida qualquer salvamento agendado ou na fila, e o delete entra DEPOIS
    // do que já estiver em voo.
    epocaRef.current += 1;
    await enfileirar(async () => {
      const { error } = await supabase
        .from('rascunhos_rota')
        .delete()
        .eq('usuario_id', userId)
        .eq('unidade_id', unidadeId);
      if (error) throw error;
      setLastSavedAt(null);
      setSaveError(null);
    });
  }, [enfileirar, unidadeId, userId]);

  return {
    isHydrating,
    isSaving,
    lastSavedAt,
    saveError,
    clearDraft,
  };
}
