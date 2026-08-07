# Atualizar Dados da Unidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a tela "Minha unidade" salvar de verdade, sem abrir as colunas comerciais da tabela.

**Architecture:** Uma RPC `SECURITY DEFINER` recebe exatamente 10 campos e é a única porta de escrita. **Nenhuma policy de UPDATE é criada** — as outras 17 colunas de `unidades` continuam sem caminho até elas. A tela troca `.update()` por `.rpc()`, separa o gate de edição do badge de "gestor principal", e ganha o campo de endereço da sede.

**Tech Stack:** Postgres/Supabase (RPC + RLS), React Native + Expo Router, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-07-atualizar-unidade-design.md`

## Global Constraints

- **O único banco é PRODUÇÃO.** Não existe staging. Nenhum subagente escreve no banco; a migration é aplicada pelo controlador da sessão com aval explícito do gestor, via `mcp__supabase__apply_migration` (SQL **sem** `BEGIN`/`COMMIT` — o runner abre a própria transação).
- **NÃO criar policy de UPDATE, INSERT ou DELETE em `unidades`.** Todo o desenho apoia-se nisso: `anon`/`authenticated` já têm grant de tabela cheio, então uma policy liberaria as 17 colunas protegidas de uma vez.
- **Nenhum teste toca o banco real** — use o mock global de `@/lib/supabase` (`jest.setup.js`).
- **Sem `as any` em código de produção.**
- **Logger:** `logger.warn(mensagem, erro)` — máximo 2 argumentos; `logger.warn` é `__DEV__`-only, então use `logger.error` para o que precisa sobreviver em produção.
- **Feedback de erro:** `showError(error, { title })` — a forma que aciona `src/lib/errorMapping.ts`. **Não** use `showError({ title, message })`, que contorna o mapeamento.
- `src/types/database.ts` **não existe** — tipos de domínio são curados à mão. Não rode `/regenerate-supabase-types`.
- Mensagens ao usuário em **pt-BR**.

## File Structure

| Arquivo                                                    | Responsabilidade                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| `database/migrations/20260807HHMMSS_atualizar_unidade.sql` | **Criar** — RPC `atualizar_unidade` com grants                            |
| `supabase/migrations/20260807HHMMSS_atualizar_unidade.sql` | **Criar** — cópia byte-idêntica (exigida por `database/MIGRATIONS.md:17`) |
| `src/lib/errorMapping.ts`                                  | **Modificar** — padrão para `SEM_PERMISSAO`                               |
| `src/lib/__tests__/errorMapping.test.ts`                   | **Modificar** — cobertura do padrão novo                                  |
| `app/unidade/index.tsx`                                    | **Modificar** — `podeEditar`, `handleSave` via RPC, campo de sede         |
| `app/unidade/__tests__/index.test.tsx`                     | **Criar** — o diretório não existe hoje                                   |
| `docs/PROJECT_CONTEXT.md`, `database/MIGRATIONS.md`        | **Modificar** — registrar                                                 |

---

### Task 1: Migration — RPC `atualizar_unidade`

**Files:**

- Create: `database/migrations/20260807HHMMSS_atualizar_unidade.sql` (substitua `HHMMSS` pela hora UTC real)
- Create: `supabase/migrations/20260807HHMMSS_atualizar_unidade.sql` (cópia byte-idêntica)

**Interfaces:**

- Consumes: nada.
- Produces: `public.atualizar_unidade(uuid,text,text,text,text,text,text,text,numeric,numeric) returns void`. Sentinelas: `NAO_AUTENTICADO` (`28000`) · `SEM_PERMISSAO` (`42501`) · `CAMPOS_OBRIGATORIOS` (`22023`) · `UF_INVALIDA` (`22023`) · `COORDENADAS_INVALIDAS` (`22023`).

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================================
-- Migration: RPC de atualização de dados da unidade
-- Date: 2026-08-07
-- Purpose: `unidades` tem RLS ligada e só a policy `unidades_select`. O
--          `.update()` da tela "Minha unidade" não dá erro — dá 0 linhas
--          afetadas — e o código só olha `error`, então exibe "Dados
--          atualizados com sucesso!" e recarrega os valores antigos.
--
--          NÃO criamos policy de UPDATE de propósito: `anon`/`authenticated`
--          já têm grant de tabela cheio (default do Supabase), e RLS não
--          restringe coluna. Uma policy liberaria plano, status,
--          desconto_percentual, asaas_customer_id e observacoes_admin de uma
--          vez. Esta RPC é a única porta, com 10 campos explícitos.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.atualizar_unidade(
  p_unidade_id      uuid,
  p_nome            text,
  p_telefone        text,
  p_endereco        text,
  p_cidade          text,
  p_uf              text,
  p_cep             text,
  p_sede_endereco   text DEFAULT NULL,
  p_sede_latitude   numeric DEFAULT NULL,
  p_sede_longitude  numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_atualiza_sede boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;

  -- Qualquer gestor ATIVO daquela unidade. Deliberadamente não usa flag de
  -- "principal": `usuarios.is_gestor_principal` é false para os 9 gestores
  -- atuais e `usuario_unidades.is_principal` é false para 2 deles — exigir
  -- qualquer uma travaria gestor legítimo.
  IF NOT EXISTS (
    SELECT 1 FROM public.usuario_unidades
    WHERE usuario_id = v_uid
      AND unidade_id = p_unidade_id
      AND papel = 'gestor'
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO' USING ERRCODE = '42501';
  END IF;

  -- `cidade` entra aqui porque é NOT NULL no schema: sem a guarda, cidade
  -- vazia estouraria com violação de constraint crua em vez de sentinela.
  IF coalesce(btrim(p_nome), '') = ''
     OR coalesce(btrim(p_cidade), '') = '' THEN
    RAISE EXCEPTION 'CAMPOS_OBRIGATORIOS' USING ERRCODE = '22023';
  END IF;

  IF p_uf IS NOT NULL
     AND btrim(p_uf) <> ''
     AND length(btrim(p_uf)) <> 2 THEN
    RAISE EXCEPTION 'UF_INVALIDA' USING ERRCODE = '22023';
  END IF;

  -- A sede só é sobrescrita quando os TRÊS campos vierem juntos. Apagar a
  -- sede por omissão deixaria a unidade incapaz de gerar rota: partida e
  -- chegada saem de sede_latitude/sede_longitude
  -- (src/hooks/nova-entrega/useEnderecoUnidade.ts).
  v_atualiza_sede := p_sede_endereco IS NOT NULL
                     AND btrim(p_sede_endereco) <> ''
                     AND p_sede_latitude IS NOT NULL
                     AND p_sede_longitude IS NOT NULL;

  IF v_atualiza_sede
     AND (p_sede_latitude NOT BETWEEN -90 AND 90
          OR p_sede_longitude NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'COORDENADAS_INVALIDAS' USING ERRCODE = '22023';
  END IF;

  UPDATE public.unidades SET
    nome           = btrim(p_nome),
    cidade         = btrim(p_cidade),
    telefone       = nullif(btrim(coalesce(p_telefone, '')), ''),
    endereco       = nullif(btrim(coalesce(p_endereco, '')), ''),
    uf             = nullif(btrim(coalesce(p_uf, '')), ''),
    cep            = nullif(btrim(coalesce(p_cep, '')), ''),
    sede_endereco  = CASE WHEN v_atualiza_sede
                          THEN btrim(p_sede_endereco) ELSE sede_endereco END,
    sede_latitude  = CASE WHEN v_atualiza_sede
                          THEN p_sede_latitude ELSE sede_latitude END,
    sede_longitude = CASE WHEN v_atualiza_sede
                          THEN p_sede_longitude ELSE sede_longitude END,
    updated_at     = now()
  WHERE id = p_unidade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_unidade(
  uuid, text, text, text, text, text, text, text, numeric, numeric
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.atualizar_unidade(
  uuid, text, text, text, text, text, text, text, numeric, numeric
) TO authenticated;

COMMENT ON FUNCTION public.atualizar_unidade(
  uuid, text, text, text, text, text, text, text, numeric, numeric
) IS 'Única porta de escrita em unidades pelo app. NÃO existe policy de UPDATE: as demais colunas (plano, status, desconto_percentual, asaas_customer_id, observacoes_admin...) ficam inalcançáveis por construção.';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.atualizar_unidade(
--   uuid, text, text, text, text, text, text, text, numeric, numeric);
-- COMMIT;
-- NÃO crie policy de UPDATE como "compensação" ao reverter: isso abriria as
-- 17 colunas que esta RPC protege.
```

- [ ] **Step 2: Espelhar em `supabase/migrations/`**

`database/MIGRATIONS.md:17` exige cópia byte-idêntica para alteração nova de schema. Copie o arquivo (use `cp`, não retranscreva) e confirme:

Run: `diff database/migrations/20260807*_atualizar_unidade.sql supabase/migrations/20260807*_atualizar_unidade.sql`
Expected: saída vazia, exit 0.

- [ ] **Step 3: Revisar com o agente de RLS**

Dispare o agente `rls-policy-reviewer` sobre o arquivo. Precisa devolver `APPROVE`. Ele deve confirmar: `SECURITY DEFINER` com `SET search_path = ''`, `REVOKE` de `anon`, guarda de permissão inescapável, **e que nenhuma policy foi criada**.

Se vier `REQUEST_CHANGES`, corrija e repita.

- [ ] **Step 4: PARE — aplicação é do controlador**

**Não aplique.** Nenhuma escrita no banco. Reporte que a migration está pronta.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/20260807*_atualizar_unidade.sql supabase/migrations/20260807*_atualizar_unidade.sql
git commit -m "feat(db): RPC atualizar_unidade sem policy de UPDATE"
```

---

### Task 2: Mensagem de erro para `SEM_PERMISSAO`

**Files:**

- Modify: `src/lib/errorMapping.ts`
- Test: `src/lib/__tests__/errorMapping.test.ts`

**Interfaces:**

- Consumes: a sentinela `SEM_PERMISSAO` da Task 1.
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Escrever o teste falhando**

Acrescente em `src/lib/__tests__/errorMapping.test.ts`, seguindo o formato dos blocos vizinhos:

```ts
describe('SEM_PERMISSAO', () => {
  it('orienta a falta de permissão em vez de mandar contatar o suporte', () => {
    const resultado = getErrorMessage({ message: 'SEM_PERMISSAO' });

    expect(resultado.title).not.toBe('Algo deu errado');
    expect(resultado.message).toMatch(/permiss/i);
    // O texto cru da sentinela nunca pode chegar ao usuário.
    expect(resultado.message).not.toContain('SEM_PERMISSAO');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/lib/__tests__/errorMapping.test.ts -t "SEM_PERMISSAO"`
Expected: FAIL — cai no `DEFAULT_ERROR`, cujo título é `Algo deu errado`.

- [ ] **Step 3: Acrescentar o padrão**

Em `src/lib/errorMapping.ts`, dentro do array `ERROR_PATTERNS`, acrescente uma entrada seguindo exatamente o formato das vizinhas (`{ pattern, error: { title, message } }`):

```ts
  {
    pattern: /SEM_PERMISSAO/i,
    error: {
      title: 'Sem permissão',
      message:
        'Você precisa ser gestor desta unidade para alterar estes dados.',
    },
  },
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/lib/__tests__/errorMapping.test.ts`
Expected: PASS — a suíte inteira do arquivo, incluindo o teste novo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/errorMapping.ts src/lib/__tests__/errorMapping.test.ts
git commit -m "feat(errors): mensagem propria para SEM_PERMISSAO"
```

---

### Task 3: Tela — gate, salvamento e campo de sede

**Files:**

- Modify: `app/unidade/index.tsx`
- Create: `app/unidade/__tests__/index.test.tsx` (o diretório não existe)

**Interfaces:**

- Consumes: RPC `atualizar_unidade` (Task 1); padrão `SEM_PERMISSAO` (Task 2).
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/unidade/__tests__/index.test.tsx`. **Leia `app/unidade/index.tsx` inteiro antes** — você vai precisar mockar o que ele importa (`@/hooks/useUser` ou equivalente, `expo-router`, `@/lib/supabase`). Siga o padrão de mocks de `app/__tests__/index-onboarding-gate.test.tsx`, que já existe nesta base.

```tsx
import {
  render,
  waitFor,
  fireEvent,
  screen,
} from '@testing-library/react-native';

import UnidadeScreen from '../index';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

/**
 * Seletores reais da tela (confirmados em app/unidade/index.tsx):
 *   entrar em edição → texto '✏️ Editar Informações' (l. 410)
 *   salvar           → texto 'Salvar'                (l. 325)
 *   telefone         → placeholder '(00) 00000-0000' (l. 247)
 *   nome             → placeholder 'Nome da unidade' (l. 224)
 */
async function entrarEmEdicao() {
  fireEvent.press(await screen.findByText('✏️ Editar Informações'));
}

async function salvar() {
  fireEvent.press(await screen.findByText('Salvar'));
}

describe('tela Minha Unidade', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mostra o botão de editar para gestor (hoje some para todos)', async () => {
    render(<UnidadeScreen />);

    // Regressão: o gate era `is_gestor_principal`, false para os 9 gestores.
    expect(await screen.findByText('✏️ Editar Informações')).toBeTruthy();
  });

  it('envia à RPC apenas os campos editáveis — nunca os comerciais', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.changeText(
      screen.getByPlaceholderText('(00) 00000-0000'),
      '11988887777',
    );
    await salvar();

    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalled());
    const payload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];

    // Estas colunas não têm caminho pela RPC. Se alguém as acrescentar ao
    // payload, a proteção estrutural vira teatro.
    expect(payload).not.toHaveProperty('p_plano');
    expect(payload).not.toHaveProperty('p_status');
    expect(payload).not.toHaveProperty('p_asaas_customer_id');
    expect(payload).not.toHaveProperty('p_desconto_percentual');
    expect(payload).not.toHaveProperty('p_observacoes_admin');
  });

  it('NÃO exibe sucesso quando a RPC falha', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'SEM_PERMISSAO', code: '42501' },
    });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    await salvar();

    // O bug desta spec: antes, 0 linhas afetadas virava "sucesso".
    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalled());
    expect(screen.queryByText(/atualizados com sucesso/i)).toBeNull();
  });

  it('não envia a sede quando o campo não foi editado', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.changeText(
      screen.getByPlaceholderText('(00) 00000-0000'),
      '11977776666',
    );
    await salvar();

    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalled());
    const payload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];

    // Nulos fazem a RPC preservar a sede. Enviar string vazia a apagaria.
    expect(payload.p_sede_latitude).toBeNull();
    expect(payload.p_sede_longitude).toBeNull();
  });
});
```

A tela lê `userData` de um hook e carrega a unidade via `supabase.from('unidades').select()` — mocke ambos para que o primeiro teste tenha um gestor e uma unidade. Se algum elemento não for alcançável pelos seletores acima, acrescente `accessibilityLabel` ao componente na Task 3 — **não** relaxe a asserção.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- app/unidade/__tests__/index.test.tsx`
Expected: FAIL — a tela ainda usa `.update()`, então `supabase.rpc` nunca é chamado.

- [ ] **Step 3: Separar `podeEditar` de `isGestorPrincipal`**

Em `app/unidade/index.tsx`, logo abaixo da linha 182:

```ts
const isGestorPrincipal = userData?.is_gestor_principal === true;
// Editar os dados é diferente de ser o titular. `is_gestor_principal` é
// false para todos os gestores hoje, então gatear a edição por ele esconde
// o botão de todo mundo. O gate da UI é conveniência — quem decide de fato
// é a guarda da RPC.
const podeEditar = userData?.papel === 'gestor';
```

Troque `isGestorPrincipal` por `podeEditar` **apenas** nos dois lugares que gateiam edição: a linha 335 (`desktopActions`) e a linha 404 (botão mobile). **Não** troque na linha 188 — lá o badge "⭐ Gestor Principal" é identidade, e `isGestorPrincipal` é o conceito certo.

- [ ] **Step 4: Trocar `handleSave` pela RPC**

Substitua o corpo do `try` em `handleSave` (linhas ~144-163):

```ts
setSaving(true);

const { error } = await supabase.rpc('atualizar_unidade', {
  p_unidade_id: unidade!.id,
  p_nome: nome.trim(),
  p_telefone: cleanPhone(telefone),
  p_endereco: endereco.trim(),
  p_cidade: cidade.trim(),
  p_uf: estado.trim(),
  p_cep: cep.trim(),
  p_sede_endereco: sedeEndereco.trim() || null,
  p_sede_latitude: sedeLatitude ?? null,
  p_sede_longitude: sedeLongitude ?? null,
});

if (error) throw error;

showToast('Dados atualizados com sucesso!', 'success', 3000);
setEditMode(false);
await loadUnidade();
```

E no `catch`, troque o `showToast` de erro por:

```ts
    } catch (error) {
      logger.error('Erro ao atualizar unidade', error);
      showError(error, { title: 'Não foi possível salvar' });
    } finally {
```

`showError(error, { title })` é a forma que aciona `errorMapping`; a forma com objeto `{ title, message }` o contorna.

- [ ] **Step 5: Acrescentar o campo de sede**

Declare o estado ao lado dos demais (`nome`, `telefone`, …):

```ts
const [sedeEndereco, setSedeEndereco] = useState('');
const [sedeLatitude, setSedeLatitude] = useState<number | undefined>();
const [sedeLongitude, setSedeLongitude] = useState<number | undefined>();
```

Inicialize em `loadUnidade` a partir de `unidade.sede_endereco` (e deixe lat/long indefinidos — só são preenchidos ao selecionar uma sugestão), e limpe em `handleCancel` junto com os outros campos.

No `FormularioUnidade`, visível **apenas** quando `editMode` for verdadeiro, acrescente:

```tsx
<AddressAutocomplete
  value={sedeEndereco}
  onChangeText={(text) => {
    // Editar o texto invalida as coordenadas: elas só são
    // confiáveis quando vêm de uma sugestão selecionada.
    if (text !== sedeEndereco) {
      setSedeLatitude(undefined);
      setSedeLongitude(undefined);
    }
    setSedeEndereco(text);
  }}
  onSelectAddress={(address, _placeId, coords) => {
    setSedeEndereco(address);
    if (coords) {
      setSedeLatitude(coords.latitude);
      setSedeLongitude(coords.longitude);
    }
  }}
  placeholder="Endereço da sede (partida e chegada das rotas)"
  multiline
/>
```

Importe `AddressAutocomplete` de `@/design-system` — a regra `no-restricted-imports` do ESLint proíbe `@/components/AddressAutocomplete` em nível `error`.

- [ ] **Step 6: Rodar os testes e os gates**

Run: `npm test -- app/unidade && npm run type-check && npm run lint`
Expected: os três exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/unidade/index.tsx app/unidade/__tests__/index.test.tsx
git commit -m "fix(unidade): salvar via RPC, liberar edicao para gestor e permitir editar a sede"
```

---

### Task 4: Documentação

**Files:**

- Modify: `database/MIGRATIONS.md`
- Modify: `docs/PROJECT_CONTEXT.md`

**Interfaces:**

- Consumes: tudo anterior.
- Produces: nada.

- [ ] **Step 1: Registrar a migration**

Em `database/MIGRATIONS.md`, acrescente a entrada seguindo o formato das vizinhas (número, data, arquivos, objetivo, bullets, status). **Deixe o status inequívoco** — se ainda não tiver sido aplicada quando você escrever, marque como pendente, não como concluída.

- [ ] **Step 2: Acrescentar a armadilha**

Em `docs/PROJECT_CONTEXT.md`, na seção "Armadilhas que já custaram caro":

```markdown
- **`unidades` não tem — e não deve ter — policy de UPDATE.** A tabela tem 17
  colunas fora do que o app edita, várias comerciais (`plano`, `status`,
  `desconto_percentual`, `asaas_customer_id`, `observacoes_admin`). Como
  `anon`/`authenticated` já têm grant de tabela cheio (default do Supabase) e
  RLS **não restringe coluna**, criar uma policy de UPDATE libera as 17 de uma
  vez — um gestor poderia se promover de plano e estender o próprio trial. A
  escrita passa pela RPC `atualizar_unidade`, que aceita 10 campos explícitos.
  **Se algum dia essa RPC parar de funcionar, o conserto não é adicionar
  policy.** Verificação: um `.update()` direto em `unidades` pelo client tem
  que continuar falhando.
```

- [ ] **Step 3: Atualizar a data do banner**

A linha 3 de `docs/PROJECT_CONTEXT.md` traz `Atualizado em <data>`. Bump para a data de hoje — o arquivo mudou de fato, e essa convenção é seguida em todo commit que o altera.

- [ ] **Step 4: Riscar a pendência**

A tabela de pendências tem um item sobre `unidades` sem policy de UPDATE. Remova-o — ele deixa de ser pendência. Renumere os itens seguintes se necessário.

- [ ] **Step 5: Verificar formatação e commitar**

Run: `npx prettier --check docs/PROJECT_CONTEXT.md database/MIGRATIONS.md`
Expected: exit 0. Se acusar, rode `npx prettier --write` nos dois e repita.

```bash
git add docs/PROJECT_CONTEXT.md database/MIGRATIONS.md
git commit -m "docs: registrar RPC atualizar_unidade e a armadilha da policy ausente"
```

---

## Validação final (exige o gestor — não automatizável)

Nenhum teste toca o banco real. Estes passos fecham o que a suíte não alcança:

1. Entrar como gestor, abrir "Minha unidade", editar telefone e CEP, salvar.
2. Conferir **no banco** que a linha mudou de verdade:

```sql
select nome, telefone, cep, updated_at from public.unidades where id = '<uuid>';
```

3. Editar o endereço da sede selecionando uma sugestão e conferir que
   `sede_latitude`/`sede_longitude` mudaram.
4. Salvar **sem** tocar no campo de sede e confirmar que as coordenadas
   continuam as mesmas — é a regra de preservação.
5. **O teste que protege o desenho inteiro:** confirmar que um `.update()`
   direto continua bloqueado. No console do navegador, autenticado:

```js
await supabase
  .from('unidades')
  .update({ plano: 'profissional' })
  .eq('id', '<uuid>')
  .select();
```

Esperado: **array vazio** (0 linhas afetadas), e `plano` inalterado no banco.
Se essa chamada alterar qualquer coisa, existe policy de UPDATE onde não
deveria e as 17 colunas estão abertas.
