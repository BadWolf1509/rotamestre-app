# Onboarding Self-Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que qualquer pessoa se cadastre, crie a própria unidade e passe a operar como gestor — destravando também as 5 contas hoje presas sem perfil.

**Architecture:** Uma RPC `SECURITY DEFINER` cria `unidades` + `usuarios` + `usuario_unidades` em transação única, chamada por uma tela de onboarding que o roteador exibe quando há sessão válida sem perfil. `authService.signUp` deixa de escrever em `usuarios` — o passo que hoje falha e deixa conta órfã.

**Tech Stack:** Postgres/Supabase (RPC + RLS), React Native + Expo Router, react-hook-form + Zod, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-06-onboarding-self-service-design.md`

## Global Constraints

- **O único banco é PRODUÇÃO.** Não existe staging. Nenhum subagente escreve no banco; a migration é aplicada pelo controlador da sessão com aval explícito do gestor, via `mcp__supabase__apply_migration`.
- **Nenhum teste toca o banco real.** Toda cobertura Jest usa o mock global de `@/lib/supabase` (`jest.setup.js`).
- **Sem `as any` em código de produção.**
- **Logger:** `logger.warn(mensagem, erro)` — máximo 2 argumentos. `logger.warn` é `__DEV__`-only; para erro que precisa sobreviver em produção, use `logger.error`.
- **Formulários:** sempre schema Zod + `useForm({ resolver: zodResolver(schema) })` + `Controller`; erro inline via `FieldError` ou prop `error` do design-system.
- **Toda rota em `app/` tem `ErrorBoundary`.**
- **Responsivo:** sempre `useResponsive()` de `@/hooks/useResponsive`.
- **Async UX:** operações assíncronas envolvidas em `useToast.withToast()`.
- `src/types/database.ts` **não existe** — tipos de domínio são curados à mão em `src/types/`. Não rode `/regenerate-supabase-types`.
- Mensagens ao usuário em **pt-BR**.

## File Structure

| Arquivo                                                          | Responsabilidade                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `database/migrations/20260806HHMMSS_onboarding_self_service.sql` | **Criar** — `cnpj` deixa de ser `NOT NULL` + RPC `criar_unidade_para_novo_gestor` com grants |
| `src/lib/schemas/onboarding.ts`                                  | **Criar** — `criarUnidadeSchema` + `CriarUnidadeInput`                                       |
| `src/hooks/onboarding/useCriarUnidade.ts`                        | **Criar** — chama a RPC, traduz `PERFIL_JA_EXISTE` em sucesso                                |
| `app/onboarding/criar-unidade.tsx`                               | **Criar** — formulário e navegação                                                           |
| `app/index.tsx`                                                  | **Modificar** (linha ~84) — portão: sessão sem perfil → onboarding                           |
| `src/lib/auth.ts`                                                | **Modificar** (`signUp`, ~linha 91) — remove insert em `usuarios`, envia `nome` em metadata  |
| `src/lib/schemas/auth.ts`                                        | **Modificar** (`registerSchema`, linha 32) — remove `tipo`                                   |
| `app/auth/register.tsx`                                          | **Modificar** — remove o seletor gestor/motorista                                            |
| `src/types/unidade.ts`                                           | **Modificar** — campos de sede no tipo curado à mão                                          |
| `docs/PROJECT_CONTEXT.md`, `database/MIGRATIONS.md`              | **Modificar** — registrar                                                                    |

Ordem: Task 1 entrega a RPC; Task 2 a tela que a consome; Task 3 o portão que leva à tela; Task 4 limpa o caminho antigo; Task 5 documenta. **Tudo vai num único PR** — entre a Task 4 e a Task 3 o cadastro fica sem saída, então não faz sentido mergear pela metade.

---

### Task 1: Migration — RPC de onboarding

**Files:**

- Create: `database/migrations/20260806HHMMSS_onboarding_self_service.sql` (substitua `HHMMSS` pela hora UTC real da criação)

**Interfaces:**

- Consumes: nada.
- Produces: `public.criar_unidade_para_novo_gestor(text,text,text,text,text,numeric,numeric,text) returns uuid`. Erros por `errcode`: `28000` não autenticado · `P0001` com mensagem `PERFIL_JA_EXISTE` · `22023` validação.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================================
-- Migration: onboarding self-service (testador cria a própria unidade)
-- Date: 2026-08-06
-- Purpose: hoje nenhum usuário novo consegue concluir cadastro. `signUp` cria a
--          conta no Auth e depois tenta inserir em `usuarios`, insert que a
--          policy `usuarios_insert_optimized` bloqueia porque exige que o autor
--          já seja gestor de alguma unidade. Como o erro vem DEPOIS da conta
--          criada, sobra conta órfã (5 pessoas reais nesse estado).
--          Esta RPC cria unidade + perfil + vínculo em transação única.
-- ============================================================================

BEGIN;

-- 1. CNPJ deixa de ser obrigatório.
--    O UNIQUE permanece: em Postgres, múltiplos NULL não colidem.
ALTER TABLE public.unidades ALTER COLUMN cnpj DROP NOT NULL;

-- 2. RPC de onboarding
CREATE OR REPLACE FUNCTION public.criar_unidade_para_novo_gestor(
  p_gestor_nome     text,
  p_unidade_nome    text,
  p_cidade          text,
  p_uf              text,
  p_sede_endereco   text,
  p_sede_latitude   numeric,
  p_sede_longitude  numeric,
  p_telefone        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_email      text;
  v_unidade_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;

  -- Guarda central: restringe a função a onboarding e limita cada conta a
  -- exatamente uma unidade. Sem ela, qualquer gestor criaria unidades à vontade.
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_uid) THEN
    RAISE EXCEPTION 'PERFIL_JA_EXISTE' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(btrim(p_gestor_nome), '') = ''
     OR coalesce(btrim(p_unidade_nome), '') = ''
     OR coalesce(btrim(p_cidade), '') = '' THEN
    RAISE EXCEPTION 'CAMPOS_OBRIGATORIOS' USING ERRCODE = '22023';
  END IF;

  -- Sem coordenadas a unidade nasce incapaz de gerar rota: partida e chegada
  -- saem de sede_latitude/sede_longitude (src/hooks/nova-entrega/useEnderecoUnidade.ts).
  IF p_sede_latitude IS NULL OR p_sede_longitude IS NULL THEN
    RAISE EXCEPTION 'COORDENADAS_OBRIGATORIAS' USING ERRCODE = '22023';
  END IF;

  -- E-mail vem da sessão, nunca de parâmetro: parâmetro permitiria cadastrar
  -- perfil com e-mail alheio.
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.unidades (
    nome, cidade, uf, sede_endereco, sede_latitude, sede_longitude,
    origem, status, ativa
  )
  VALUES (
    btrim(p_unidade_nome),
    btrim(p_cidade),
    nullif(btrim(coalesce(p_uf, '')), ''),
    nullif(btrim(coalesce(p_sede_endereco, '')), ''),
    p_sede_latitude,
    p_sede_longitude,
    'self_service',
    'trial',
    true
  )
  RETURNING id INTO v_unidade_id;

  -- papel é literal, nunca parâmetro: parâmetro deixaria o client escolher o
  -- próprio papel.
  -- primeira_senha = false: o default da coluna é TRUE e mandaria o gestor
  -- recém-criado para /onboarding/first-password trocar a senha que ele acabou
  -- de escolher.
  -- is_gestor_principal = true: quem cria a unidade é o titular. Sem isso ele
  -- não gerencia a própria equipe (app/unidade/equipe.tsx, transferir.tsx).
  INSERT INTO public.usuarios (
    id, email, nome, papel, unidade_id, telefone,
    ativo, primeira_senha, is_gestor_principal
  )
  VALUES (
    v_uid,
    v_email,
    btrim(p_gestor_nome),
    'gestor',
    v_unidade_id,
    nullif(btrim(coalesce(p_telefone, '')), ''),
    true, false, true
  );

  INSERT INTO public.usuario_unidades (
    usuario_id, unidade_id, papel, ativo, is_principal
  )
  VALUES (v_uid, v_unidade_id, 'gestor', true, true);

  RETURN v_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_unidade_para_novo_gestor(
  text, text, text, text, text, numeric, numeric, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.criar_unidade_para_novo_gestor(
  text, text, text, text, text, numeric, numeric, text
) TO authenticated;

COMMENT ON FUNCTION public.criar_unidade_para_novo_gestor(
  text, text, text, text, text, numeric, numeric, text
) IS 'Onboarding self-service. Só executa para auth.uid() SEM linha em usuarios; cria unidade + perfil de gestor + vínculo em transação única.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.criar_unidade_para_novo_gestor(
--   text, text, text, text, text, numeric, numeric, text);
-- -- ATENÇÃO: reverter o NOT NULL de cnpj só é possível se nenhuma unidade
-- -- tiver cnpj nulo. Rode antes:
-- --   select count(*) from public.unidades where cnpj is null;
-- -- ALTER TABLE public.unidades ALTER COLUMN cnpj SET NOT NULL;
-- COMMIT;
```

- [ ] **Step 2: Revisar com o agente de RLS**

Dispare o agente `rls-policy-reviewer` sobre o arquivo criado. Ele precisa devolver `APPROVE`. Pontos que ele deve confirmar: `SECURITY DEFINER` com `SET search_path`, `REVOKE` de `anon`, `papel` literal, `email` vindo de `auth.users`, e a guarda `PERFIL_JA_EXISTE` sendo inescapável.

Se vier `REQUEST_CHANGES`, corrija e repita antes de seguir.

- [ ] **Step 3: PARE — aplicação é do controlador**

**Não aplique.** Peça ao gestor o aval e informe que a aplicação usa `mcp__supabase__apply_migration`, **sem** `BEGIN`/`COMMIT` no SQL enviado (o runner abre a própria transação) e que o registro fica sob timestamp próprio, diferente do nome do arquivo.

- [ ] **Step 4: Verificar depois de aplicada**

```sql
select proname,
       pg_get_function_identity_arguments(oid) as args,
       prosecdef as security_definer
from pg_proc where proname = 'criar_unidade_para_novo_gestor';

select is_nullable from information_schema.columns
where table_schema='public' and table_name='unidades' and column_name='cnpj';
```

Esperado: uma linha com `security_definer = true`; `is_nullable = YES`.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/20260806*_onboarding_self_service.sql
git commit -m "feat(db): RPC de onboarding self-service + cnpj opcional"
```

---

### Task 2: Tela de onboarding

**Files:**

- Create: `src/lib/schemas/onboarding.ts`
- Create: `src/hooks/onboarding/useCriarUnidade.ts`
- Create: `app/onboarding/criar-unidade.tsx`
- Test: `src/hooks/onboarding/__tests__/useCriarUnidade.test.ts`

**Interfaces:**

- Consumes: RPC `criar_unidade_para_novo_gestor` (Task 1).
- Produces: `useCriarUnidade()` → `{ criarUnidade(input: CriarUnidadeParams): Promise<{ ok: true }>, loading: boolean }`; `criarUnidadeSchema`; tipos `CriarUnidadeInput` (formulário, coordenadas opcionais) e `CriarUnidadeParams` (RPC, coordenadas obrigatórias).

- [ ] **Step 1: Escrever o schema**

`src/lib/schemas/onboarding.ts`:

```ts
import { z } from 'zod';

export const criarUnidadeSchema = z
  .object({
    gestorNome: z.string().trim().min(3, 'Informe seu nome completo'),
    unidadeNome: z.string().trim().min(2, 'Informe o nome da empresa'),
    cidade: z.string().trim().min(2, 'Informe a cidade'),
    uf: z
      .string()
      .trim()
      .length(2, 'UF deve ter 2 letras')
      .optional()
      .or(z.literal('')),
    endereco: z.string().trim().min(5, 'Informe o endereço da sede'),
    // Opcionais no tipo, obrigatórios na validação. Digitar no campo precisa
    // poder LIMPAR as coordenadas (só são confiáveis vindas de uma sugestão
    // selecionada), e `setValue(campo, undefined)` só é legal se o tipo aceitar.
    // Tipar como obrigatório aqui forçaria um cast na tela.
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    telefone: z.string().trim().optional(),
  })
  .refine((d) => d.latitude !== undefined && d.longitude !== undefined, {
    // Sem coordenadas a unidade nasce incapaz de gerar rota.
    message: 'Selecione o endereço na lista de sugestões',
    path: ['endereco'],
  });

export type CriarUnidadeInput = z.infer<typeof criarUnidadeSchema>;

/** Entrada da RPC: aqui as coordenadas já passaram pelo `.refine`. */
export type CriarUnidadeParams = Omit<
  CriarUnidadeInput,
  'latitude' | 'longitude'
> & { latitude: number; longitude: number };
```

- [ ] **Step 2: Escrever o teste do hook (falhando)**

`src/hooks/onboarding/__tests__/useCriarUnidade.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react-native';

import { useCriarUnidade } from '../useCriarUnidade';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const input = {
  gestorNome: 'Maria Souza',
  unidadeNome: 'Transportes Souza',
  cidade: 'João Pessoa',
  uf: 'PB',
  endereco: 'Av. Epitácio Pessoa, 100',
  latitude: -7.1195,
  longitude: -34.845,
  telefone: '',
};

describe('useCriarUnidade', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envia os parâmetros da RPC sem papel e sem email', async () => {
    mockSupabase.rpc = jest
      .fn()
      .mockResolvedValue({ data: 'unidade-1', error: null });

    const { result } = renderHook(() => useCriarUnidade());
    await act(async () => {
      await result.current.criarUnidade(input);
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'criar_unidade_para_novo_gestor',
      expect.objectContaining({
        p_gestor_nome: 'Maria Souza',
        p_unidade_nome: 'Transportes Souza',
        p_cidade: 'João Pessoa',
        p_sede_latitude: -7.1195,
        p_sede_longitude: -34.845,
      }),
    );

    // Regressão: papel e email vêm da sessão no servidor. Se alguém adicionar
    // ao payload, o client volta a poder escolher o próprio papel.
    const payload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
    expect(payload).not.toHaveProperty('p_papel');
    expect(payload).not.toHaveProperty('p_email');
  });

  it('trata PERFIL_JA_EXISTE como sucesso (duplo submit é idempotente)', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'PERFIL_JA_EXISTE', code: 'P0001' },
    });

    const { result } = renderHook(() => useCriarUnidade());

    let retorno: { ok: boolean } | undefined;
    await act(async () => {
      retorno = await result.current.criarUnidade(input);
    });

    expect(retorno).toEqual({ ok: true });
  });

  it('propaga erro real da RPC', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'COORDENADAS_OBRIGATORIAS', code: '22023' },
    });

    const { result } = renderHook(() => useCriarUnidade());

    await expect(
      act(async () => {
        await result.current.criarUnidade(input);
      }),
    ).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- src/hooks/onboarding/__tests__/useCriarUnidade.test.ts`
Expected: FAIL — `Cannot find module '../useCriarUnidade'`

- [ ] **Step 4: Implementar o hook**

`src/hooks/onboarding/useCriarUnidade.ts`:

```ts
import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { CriarUnidadeParams } from '@/lib/schemas/onboarding';

/**
 * Sentinela devolvida pela RPC quando o usuário já tem perfil. Reconhecemos por
 * ela, e não por texto livre: comparar a mensagem quebraria na primeira
 * mudança de redação.
 */
const PERFIL_JA_EXISTE = 'PERFIL_JA_EXISTE';

export function useCriarUnidade() {
  const [loading, setLoading] = useState(false);

  const criarUnidade = useCallback(async (input: CriarUnidadeParams) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('criar_unidade_para_novo_gestor', {
        p_gestor_nome: input.gestorNome,
        p_unidade_nome: input.unidadeNome,
        p_cidade: input.cidade,
        p_uf: input.uf || null,
        p_sede_endereco: input.endereco,
        p_sede_latitude: input.latitude,
        p_sede_longitude: input.longitude,
        p_telefone: input.telefone || null,
      });

      if (error) {
        // Já existe perfil: o estado desejado já está no banco. Tratar como
        // sucesso é o que torna duplo submit inofensivo.
        if (error.message?.includes(PERFIL_JA_EXISTE)) {
          return { ok: true as const };
        }
        // `error`, não `warn`: warn é __DEV__-only e sumiria em produção,
        // justamente onde precisamos saber que um onboarding falhou.
        logger.error('[useCriarUnidade] Falha ao criar unidade', error);
        throw error;
      }

      return { ok: true as const };
    } finally {
      setLoading(false);
    }
  }, []);

  return { criarUnidade, loading };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- src/hooks/onboarding/__tests__/useCriarUnidade.test.ts`
Expected: PASS — 3 testes

- [ ] **Step 5b: Teste do schema — sem coordenadas não passa**

Crie `src/lib/schemas/__tests__/onboarding.test.ts`:

```ts
import { criarUnidadeSchema } from '../onboarding';

const base = {
  gestorNome: 'Maria Souza',
  unidadeNome: 'Transportes Souza',
  cidade: 'João Pessoa',
  uf: 'PB',
  endereco: 'Av. Epitácio Pessoa, 100',
  telefone: '',
};

describe('criarUnidadeSchema', () => {
  it('rejeita endereço digitado sem selecionar sugestão (sem coordenadas)', () => {
    const r = criarUnidadeSchema.safeParse(base);

    expect(r.success).toBe(false);
    if (!r.success) {
      // A mensagem aparece no campo de endereço, que é onde o usuário age.
      expect(r.error.issues[0].path).toContain('endereco');
      expect(r.error.issues[0].message).toMatch(/sugest/i);
    }
  });

  it('aceita quando as coordenadas vieram da sugestão', () => {
    const r = criarUnidadeSchema.safeParse({
      ...base,
      latitude: -7.1195,
      longitude: -34.845,
    });

    expect(r.success).toBe(true);
  });
});
```

Run: `npm test -- src/lib/schemas/__tests__/onboarding.test.ts`
Expected: PASS — 2 testes

- [ ] **Step 6: Escrever a tela**

`app/onboarding/criar-unidade.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Button, Card, Input, Text } from '@/design-system';
import { useCriarUnidade } from '@/hooks/onboarding/useCriarUnidade';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import {
  criarUnidadeSchema,
  type CriarUnidadeInput,
} from '@/lib/schemas/onboarding';
import type { Coordenadas } from '@/types/endereco';

function CriarUnidadeScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { criarUnidade, loading } = useCriarUnidade();
  const { withToast } = useToast();

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CriarUnidadeInput>({
    resolver: zodResolver(criarUnidadeSchema),
    defaultValues: {
      gestorNome: '',
      unidadeNome: '',
      cidade: '',
      uf: '',
      endereco: '',
      telefone: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  async function onSubmit(data: CriarUnidadeInput) {
    // O `.refine` do schema já barra este caso; a checagem existe para o
    // TypeScript estreitar o tipo, sem cast.
    if (data.latitude === undefined || data.longitude === undefined) return;

    await withToast(
      () =>
        criarUnidade({
          ...data,
          latitude: data.latitude,
          longitude: data.longitude,
        }),
      {
        loading: 'Criando sua unidade…',
        success: 'Tudo pronto! Bem-vindo ao Rota Mestre.',
        onSuccess: () => router.replace('/gestor/inicio'),
      },
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: isDesktop ? 32 : 16 }}>
      <ResponsiveContainer>
        <Card>
          <Text variant="h2">Falta pouco</Text>
          <Text variant="body">
            Cadastre sua empresa para começar a criar rotas.
          </Text>

          <Controller
            control={control}
            name="gestorNome"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Seu nome"
                value={value}
                onChangeText={onChange}
                error={errors.gestorNome?.message}
                autoCapitalize="words"
              />
            )}
          />

          <Controller
            control={control}
            name="unidadeNome"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Nome da empresa"
                value={value}
                onChangeText={onChange}
                error={errors.unidadeNome?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="cidade"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Cidade"
                value={value}
                onChangeText={onChange}
                error={errors.cidade?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="uf"
            render={({ field: { onChange, value } }) => (
              <Input
                label="UF (opcional)"
                value={value ?? ''}
                onChangeText={(t) => onChange(t.toUpperCase())}
                maxLength={2}
                error={errors.uf?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="endereco"
            render={({ field: { onChange, value } }) => (
              <AddressAutocomplete
                value={value || ''}
                onChangeText={(text) => {
                  // Editar o texto invalida as coordenadas: elas só são
                  // confiáveis quando vêm de uma sugestão selecionada.
                  if (text !== value) {
                    setValue('latitude', undefined);
                    setValue('longitude', undefined);
                  }
                  onChange(text);
                }}
                onSelectAddress={(address, _placeId, coords?: Coordenadas) => {
                  onChange(address);
                  if (coords) {
                    setValue('latitude', coords.latitude);
                    setValue('longitude', coords.longitude);
                  }
                }}
                error={errors.endereco?.message}
                placeholder="Endereço da sede"
                required
                multiline
              />
            )}
          />

          <View>
            <Button
              title="Criar unidade"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              accessibilityLabel="Criar unidade e concluir cadastro"
            />
          </View>
        </Card>
      </ResponsiveContainer>
    </ScrollView>
  );
}

export default function CriarUnidadeRoute() {
  return (
    <ErrorBoundary>
      <CriarUnidadeScreen />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 7: Verificar tipos e lint**

Run: `npm run type-check && npm run lint`
Expected: ambos exit 0. Se `Input` ou `Button` não aceitarem alguma prop usada acima, ajuste para a API real do design-system — não force com `as any`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas/onboarding.ts src/lib/schemas/__tests__/onboarding.test.ts src/hooks/onboarding app/onboarding/criar-unidade.tsx
git commit -m "feat(onboarding): tela de criacao de unidade para novo gestor"
```

---

### Task 3: Portão de roteamento

**Files:**

- Modify: `app/index.tsx:84-91`
- Test: `app/__tests__/index-onboarding-gate.test.tsx`

**Interfaces:**

- Consumes: rota `/onboarding/criar-unidade` (Task 2).
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Escrever o teste (falhando)**

`app/__tests__/index-onboarding-gate.test.tsx`:

```tsx
import { render, waitFor } from '@testing-library/react-native';

import Index from '../index';
import { authService } from '@/lib/auth';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/auth', () => ({
  authService: {
    getSession: jest.fn(),
    getUsuario: jest.fn(),
  },
}));

const mockAuth = authService as jest.Mocked<typeof authService>;

describe('portão de onboarding em app/index', () => {
  beforeEach(() => jest.clearAllMocks());

  it('manda para o onboarding quando há sessão mas não há perfil', async () => {
    mockAuth.getSession.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockAuth.getUsuario.mockResolvedValue(null as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/criar-unidade');
    });
    // Regressão: devolver para o login é o beco silencioso que travou
    // 5 pessoas reais — a sessão é válida, então login não é a resposta.
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/login');
  });

  it('mantém o destino de gestor quando há perfil', async () => {
    mockAuth.getSession.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockAuth.getUsuario.mockResolvedValue({
      id: 'u1',
      papel: 'gestor',
      primeira_senha: false,
    } as never);

    render(<Index />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/gestor/inicio');
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- app/__tests__/index-onboarding-gate.test.tsx`
Expected: FAIL — o primeiro teste recebe `/auth/login`

- [ ] **Step 3: Trocar o desvio**

Em `app/index.tsx`, substitua o bloco atual:

```ts
if (!usuario) {
  logger.warn('⚠️ Usuário não encontrado no banco, redirecionando para login');
  hasRedirected.current = true;
  router.replace('/auth/login');
  return;
}
```

por:

```ts
if (!usuario) {
  // Sessão válida sem perfil = cadastro incompleto. Mandar para o login
  // aqui foi o que travou 5 pessoas reais: o login funciona, então elas
  // voltavam para a mesma tela sem mensagem e desistiam.
  // O portão reage a ESTADO, então serve tanto para cadastro novo
  // quanto para as contas órfãs antigas.
  logger.warn('[index] Sessão sem perfil → onboarding de criação de unidade');
  hasRedirected.current = true;
  router.replace('/onboarding/criar-unidade');
  return;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- app/__tests__/index-onboarding-gate.test.tsx`
Expected: PASS — 2 testes

- [ ] **Step 5: Commit**

```bash
git add app/index.tsx app/__tests__/index-onboarding-gate.test.tsx
git commit -m "feat(auth): sessao sem perfil vai para onboarding, nao para o login"
```

---

### Task 4: `signUp` para de escrever em `usuarios`

**Files:**

- Modify: `src/lib/auth.ts:91-119`
- Modify: `src/lib/schemas/auth.ts:32-45`
- Modify: `app/auth/register.tsx`
- Test: `src/lib/__tests__/auth.test.ts` (acrescentar)

**Interfaces:**

- Consumes: portão da Task 3 (é ele que recebe o usuário depois).
- Produces: `authService.signUp(email: string, password: string, nome: string): Promise<AuthResponse['data']>` — **o parâmetro `papel` deixa de existir**.

- [ ] **Step 1: Escrever o teste (falhando)**

Acrescente em `src/lib/__tests__/auth.test.ts`:

```ts
describe('signUp', () => {
  it('NÃO insere em usuarios — o perfil nasce na RPC de onboarding', async () => {
    const mockFrom = jest.fn();
    mockSupabase.from = mockFrom;
    mockSupabase.auth.signUp = jest.fn().mockResolvedValue({
      data: { user: { id: 'novo-1' }, session: null },
      error: null,
    });

    await authService.signUp('novo@teste.com', 'SenhaForte123', 'Novo Gestor');

    // Regressão do bug que deixou 5 contas órfãs: o insert é bloqueado pelo
    // RLS e acontece DEPOIS da conta no Auth já existir.
    expect(mockFrom).not.toHaveBeenCalledWith('usuarios');
  });

  it('envia o nome em options.data para o onboarding pré-preencher', async () => {
    mockSupabase.auth.signUp = jest.fn().mockResolvedValue({
      data: { user: { id: 'novo-2' }, session: null },
      error: null,
    });

    await authService.signUp('novo2@teste.com', 'SenhaForte123', 'Ana Lima');

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'novo2@teste.com',
        options: expect.objectContaining({
          data: expect.objectContaining({ nome: 'Ana Lima' }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/lib/__tests__/auth.test.ts -t "signUp"`
Expected: FAIL — o primeiro teste acusa `from('usuarios')`

- [ ] **Step 3: Reescrever `signUp`**

Em `src/lib/auth.ts`, substitua o método inteiro por:

```ts
  /**
   * Cria apenas a conta no Auth.
   *
   * O perfil (`usuarios`) e a unidade nascem depois, na RPC
   * `criar_unidade_para_novo_gestor`, chamada pela tela de onboarding após o
   * primeiro login. Inserir em `usuarios` aqui é o que quebrava o cadastro: a
   * policy exige que o autor já seja gestor de alguma unidade, então o insert
   * falhava DEPOIS da conta já existir — deixando conta órfã.
   *
   * `nome` viaja em `options.data` só para a tela de onboarding pré-preencher.
   * É metadata controlada pelo client, então a RPC revalida.
   */
  async signUp(email: string, password: string, nome: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });

    if (error) throw error;

    return data;
  },
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/lib/__tests__/auth.test.ts -t "signUp"`
Expected: PASS — 2 testes

- [ ] **Step 5: Remover `tipo` do schema**

Em `src/lib/schemas/auth.ts`, no `registerSchema`, apague a linha `tipo: z.enum(['gestor', 'motorista']),`. O restante do objeto e o `.refine` das senhas ficam iguais.

- [ ] **Step 6: Remover o seletor da tela de registro**

Em `app/auth/register.tsx`:

1. Remova `tipo: 'motorista'` dos `defaultValues`.
2. Remova o `Controller` do campo `tipo` e os botões de escolha gestor/motorista.
3. Ajuste a chamada: `await authService.signUp(email, password, nome);`
4. Remova `tipo` do destructuring `const { nome, email, password, tipo } = data;`.

Motivo, para o comentário do PR: motorista nunca se autocadastra — é criado pelo gestor via `criar-motorista`, que já o vincula à unidade. Um motorista self-service ficaria sem unidade, sem rota e sem quem lhe atribuísse uma.

- [ ] **Step 7: Suíte inteira e gates**

Run: `npm test && npm run type-check && npm run lint`
Expected: os três exit 0. Testes que referenciavam `tipo` no registro precisam ser ajustados — o campo deixou de existir.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/lib/schemas/auth.ts app/auth/register.tsx src/lib/__tests__/auth.test.ts
git commit -m "fix(auth): signUp para de inserir em usuarios e cadastro vira sempre gestor"
```

---

### Task 5: Tipos e documentação

**Files:**

- Modify: `src/types/unidade.ts`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `database/MIGRATIONS.md`

**Interfaces:**

- Consumes: tudo anterior.
- Produces: nada.

- [ ] **Step 1: Completar o tipo curado à mão**

Em `src/types/unidade.ts`, garanta que a interface da unidade tem os campos que a RPC grava. Acrescente apenas os que faltarem:

```ts
  uf?: string | null;
  sede_endereco?: string | null;
  sede_latitude?: number | null;
  sede_longitude?: number | null;
  origem?: string | null;
  status?: string | null;
```

Não gere `src/types/database.ts` — ele não existe neste projeto por decisão.

- [ ] **Step 2: Registrar a migration**

Em `database/MIGRATIONS.md`, acrescente a entrada com número, data, propósito e status ✅, seguindo o formato das anteriores.

- [ ] **Step 3: Atualizar o contexto do projeto**

Em `docs/PROJECT_CONTEXT.md`, na tabela de pendências, registre que o cadastro público estava quebrado e foi corrigido em 06/08/2026. Acrescente em "Armadilhas que já custaram caro":

```markdown
- **Cadastro público quebrado até 06/08/2026.** `signUp` criava a conta no Auth
  e depois inseria em `usuarios` — insert que o RLS bloqueia porque exige que o
  autor já seja gestor. O erro vinha DEPOIS da conta criada: 5 pessoas reais
  ficaram com conta órfã, e `app/index.tsx` as devolvia ao login sem mensagem.
  Lição: **operação que precisa de mais de uma linha vira RPC em transação**,
  nunca dois passos no client. Indicador de saúde:
  `select au.email from auth.users au left join public.usuarios u on u.id = au.id where u.id is null;`
```

- [ ] **Step 4: Commit**

```bash
git add src/types/unidade.ts docs/PROJECT_CONTEXT.md database/MIGRATIONS.md
git commit -m "docs: registrar onboarding self-service e a armadilha do cadastro em dois passos"
```

---

## Validação final (exige o gestor — não automatizável)

Nenhum teste toca o banco real, então estes passos fecham o que a suíte não alcança:

1. Cadastro com e-mail descartável no app; confirmar o e-mail; logar.
2. Conferir que o portão levou a `/onboarding/criar-unidade`.
3. Preencher e enviar. Conferir no banco:

```sql
select u.nome, u.papel, u.unidade_id is not null as tem_unidade,
       u.primeira_senha, u.is_gestor_principal,
       un.nome as unidade, un.origem, un.status,
       un.sede_latitude is not null as tem_coordenadas
from public.usuarios u
join public.unidades un on un.id = u.unidade_id
where u.email = '<email de teste>';
```

Esperado: `papel = gestor`, `tem_unidade = true`, **`primeira_senha = false`**, **`is_gestor_principal = true`**, `origem = self_service`, `status = trial`, `tem_coordenadas = true`.

4. **Criar um motorista com essa conta.** É o que prova que o self-service gera gestor funcional — depende de `usuarios.unidade_id`, que a Edge Function `criar-motorista` lê.
5. **Criar uma rota.** Depende das coordenadas da sede.
6. Indicador de saúde — deve parar de crescer para cadastros novos:

```sql
select au.email, au.created_at from auth.users au
left join public.usuarios u on u.id = au.id
where u.id is null order by au.created_at desc;
```

Hoje esta query acusa 7 linhas. As 5 antigas só somem quando cada pessoa logar e concluir o onboarding.
