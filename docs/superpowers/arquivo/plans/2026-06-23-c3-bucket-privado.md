# C3 — Bucket `fotos-entrega` privado + signed URLs (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o bucket `fotos-entrega` privado e servir as fotos a usuários autenticados via signed URLs gerados on-read, fechando o download público e a enumeração anônima.

**Architecture:** Abordagem A (sem migração de dados). Um util `getStoragePath` normaliza qualquer valor de `foto_url` (URL pública legada, URL assinada ou path puro) para o path do bucket; `createSignedUrlForFoto` gera o signed URL; o hook `useSignedUrl` resolve on-read com cache em memória + reassinatura + dedupe, e faz pass-through de URLs externas. Uploads passam a persistir o **path**. A privatização do bucket é aplicada por último, após o deploy do código.

**Tech Stack:** React Native + Expo, TypeScript, `@supabase/supabase-js` (Storage), Jest + `@testing-library/react-native`.

## Global Constraints

- **Logging:** `logger.warn(message, error)` — no máximo 2 args. `logger.error` idem. Testes espionam `logger`, não `console`.
- **Sem `as any`** em código de produção.
- **TDD:** todo código de produção entra depois de um teste que falhou primeiro.
- **Bucket constant:** usar `BUCKET_FOTOS_ENTREGA` (já definido em `src/lib/storage.ts:54`), nunca a string literal.
- **TTL do signed URL:** `3600` segundos (1 h). Janela de reassinatura: `60_000` ms.
- **Commits:** conventional commits; cada task termina com commit. Mensagens de commit terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Rollout:** a migration que priva o bucket é aplicada **só após** o código mergeado e o web deployado (ver Task 13/14). Não aplicar antes.

## File Structure

- `src/lib/storage.ts` — **modificar**: adicionar `getStoragePath` e `createSignedUrlForFoto`; trocar `getPublicUrl` por path nos 4 uploads; `deletarFoto` usa `getStoragePath`.
- `src/lib/__tests__/storage.test.ts` — **modificar**: novos describes p/ `getStoragePath`/`createSignedUrlForFoto`; ajustar asserts dos uploads (agora retornam path).
- `src/hooks/storage/useSignedUrl.ts` — **criar**: hook de assinatura on-read.
- `src/hooks/storage/__tests__/useSignedUrl.test.ts` — **criar**.
- Componentes compartilhados — **modificar**: `src/components/UserMenuTrigger.tsx`, `src/components/AvatarEditable.tsx`.
- Componentes standalone — **modificar**: `src/components/gestor/mapa-rota/ParadaCard.tsx`, `…/ParadaCardCompact.tsx`, `src/components/gestor/incidentes/IncidenteDetalhesModal.tsx`, `src/components/drawer/DrawerHeader.tsx`, `src/components/gestor/motorista-perfil/PerfilHeader.tsx`, `app/gestor/motoristas.tsx`.
- Migration — **criar**: `database/migrations/<ts>_c3_bucket_fotos_entrega_privado.sql` (+ cópia em `supabase/migrations/`).

---

## Task 1: `getStoragePath` util

**Files:**

- Modify: `src/lib/storage.ts` (adicionar função após a constante `BUCKET_FOTOS_ENTREGA`, ~linha 54)
- Test: `src/lib/__tests__/storage.test.ts`

**Interfaces:**

- Produces: `getStoragePath(value: string | null | undefined): string | null`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `src/lib/__tests__/storage.test.ts` (importar `getStoragePath` do `../storage`):

```ts
describe('getStoragePath', () => {
  it('extrai path de URL pública', () => {
    expect(
      getStoragePath(
        'https://x.supabase.co/storage/v1/object/public/fotos-entrega/u1/r1/p1_1.jpg',
      ),
    ).toBe('u1/r1/p1_1.jpg');
  });
  it('extrai path de URL assinada (remove query)', () => {
    expect(
      getStoragePath(
        'https://x.supabase.co/storage/v1/object/sign/fotos-entrega/perfis/p_1.jpg?token=abc',
      ),
    ).toBe('perfis/p_1.jpg');
  });
  it('aceita path puro', () => {
    expect(getStoragePath('incidentes/incident_1.jpg')).toBe(
      'incidentes/incident_1.jpg',
    );
  });
  it('retorna null para lixo sem pasta ("success")', () => {
    expect(getStoragePath('success')).toBeNull();
  });
  it('retorna null para vazio/null', () => {
    expect(getStoragePath('')).toBeNull();
    expect(getStoragePath(null)).toBeNull();
  });
  it('retorna null para URL http externa (não-bucket)', () => {
    expect(getStoragePath('https://gravatar.com/avatar/abc')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/__tests__/storage.test.ts -t getStoragePath`
Expected: FAIL (`getStoragePath is not a function` / import undefined).

- [ ] **Step 3: Implementar**

Em `src/lib/storage.ts`, logo após `const BUCKET_FOTOS_ENTREGA = 'fotos-entrega';`:

```ts
/**
 * Normaliza um valor de foto_url para o path dentro do bucket fotos-entrega.
 * Aceita URL pública (.../object/public/fotos-entrega/<path>), URL assinada
 * (.../object/sign/fotos-entrega/<path>?token=...) ou um path puro.
 * Retorna null para vazio, lixo (ex.: "success") ou URL http externa.
 */
export function getStoragePath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const marker = `/${BUCKET_FOTOS_ENTREGA}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) {
    let path = value.slice(idx + marker.length);
    const q = path.indexOf('?');
    if (q >= 0) path = path.slice(0, q);
    path = path.trim();
    return path || null;
  }
  // Não é URL do bucket: URL http externa não é path
  if (/^https?:\/\//i.test(value)) return null;
  const path = value.trim();
  // Path válido sempre tem prefixo de pasta (contém '/'); descarta lixo
  if (!path || !path.includes('/')) return null;
  return path;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/__tests__/storage.test.ts -t getStoragePath`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat(storage): getStoragePath normaliza foto_url para path do bucket"
```

---

## Task 2: `createSignedUrlForFoto`

**Files:**

- Modify: `src/lib/storage.ts` (após `getStoragePath`)
- Test: `src/lib/__tests__/storage.test.ts`

**Interfaces:**

- Consumes: `getStoragePath`
- Produces: `createSignedUrlForFoto(value: string | null | undefined, expiresIn?: number): Promise<string | null>`

- [ ] **Step 1: Escrever o teste que falha**

O teste usa o mock de `supabase.storage` já existente no arquivo (ver `mockGetPublicUrl` setup). Adicionar um `createSignedUrl` ao mock do storage e este describe:

```ts
describe('createSignedUrlForFoto', () => {
  it('gera signed URL a partir de um path', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://x.supabase.co/sign/abc' },
      error: null,
    });
    const url = await createSignedUrlForFoto('perfis/p_1.jpg');
    expect(url).toBe('https://x.supabase.co/sign/abc');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('perfis/p_1.jpg', 3600);
  });
  it('retorna null para valor inválido sem chamar a API', async () => {
    mockCreateSignedUrl.mockClear();
    const url = await createSignedUrlForFoto('success');
    expect(url).toBeNull();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
  it('retorna null em erro da API', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    expect(await createSignedUrlForFoto('perfis/p_1.jpg')).toBeNull();
  });
});
```

Garantir que o mock do storage no topo do arquivo exponha `createSignedUrl` (adicionar `const mockCreateSignedUrl = jest.fn();` e incluí-lo no objeto retornado por `supabase.storage.from(...)`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/__tests__/storage.test.ts -t createSignedUrlForFoto`
Expected: FAIL (função não existe).

- [ ] **Step 3: Implementar**

Em `src/lib/storage.ts`, após `getStoragePath`:

```ts
/**
 * Gera um signed URL de curta duração para uma foto do bucket.
 * Aceita URL legada ou path. Retorna null para valor inválido ou em erro.
 */
export async function createSignedUrlForFoto(
  value: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  const path = getStoragePath(value);
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      logger.warn('[Storage] Erro ao gerar signed URL', error ?? undefined);
      return null;
    }
    return data.signedUrl;
  } catch (error) {
    logger.warn('[Storage] Erro ao gerar signed URL', error as Error);
    return null;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/__tests__/storage.test.ts -t createSignedUrlForFoto`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat(storage): createSignedUrlForFoto gera signed URL on-read"
```

---

## Task 3: `useSignedUrl` hook

**Files:**

- Create: `src/hooks/storage/useSignedUrl.ts`
- Test: `src/hooks/storage/__tests__/useSignedUrl.test.ts`

**Interfaces:**

- Consumes: `getStoragePath`, `createSignedUrlForFoto` de `@/lib/storage`
- Produces: `useSignedUrl(value: string | null | undefined, options?: { expiresIn?: number }): { url: string | null; loading: boolean; error: boolean }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/hooks/storage/__tests__/useSignedUrl.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/storage', () => ({
  getStoragePath: jest.requireActual('@/lib/storage').getStoragePath,
  createSignedUrlForFoto: jest.fn(),
}));

import { createSignedUrlForFoto } from '@/lib/storage';
import { useSignedUrl } from '../useSignedUrl';

const mockSign = createSignedUrlForFoto as jest.Mock;

beforeEach(() => mockSign.mockReset());

it('retorna null para valor null sem assinar', () => {
  const { result } = renderHook(() => useSignedUrl(null));
  expect(result.current.url).toBeNull();
  expect(mockSign).not.toHaveBeenCalled();
});

it('assina um path e expõe a url', async () => {
  mockSign.mockResolvedValue('https://signed/aaa');
  const { result } = renderHook(() => useSignedUrl('u1/r1/task3a_unique.jpg'));
  await waitFor(() => expect(result.current.url).toBe('https://signed/aaa'));
});

it('faz pass-through de URL http externa', () => {
  const { result } = renderHook(() =>
    useSignedUrl('https://gravatar.com/avatar/xyz'),
  );
  expect(result.current.url).toBe('https://gravatar.com/avatar/xyz');
  expect(mockSign).not.toHaveBeenCalled();
});

it('dedupe: dois consumidores do mesmo path → uma assinatura', async () => {
  mockSign.mockResolvedValue('https://signed/bbb');
  const path = 'u1/r1/task3b_unique.jpg';
  renderHook(() => useSignedUrl(path));
  renderHook(() => useSignedUrl(path));
  await waitFor(() => expect(mockSign).toHaveBeenCalledTimes(1));
});
```

> Nota: usar paths **únicos por teste** (o cache é module-level e persiste no arquivo).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/hooks/storage/__tests__/useSignedUrl.test.ts`
Expected: FAIL (módulo `../useSignedUrl` não existe).

- [ ] **Step 3: Implementar**

Criar `src/hooks/storage/useSignedUrl.ts`:

```ts
import { useEffect, useState } from 'react';

import { createSignedUrlForFoto, getStoragePath } from '@/lib/storage';

interface SignedUrlState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const DEFAULT_EXPIRES_IN = 3600;
const REFRESH_MARGIN_MS = 60_000;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

function getFresh(path: string): string | null {
  const entry = cache.get(path);
  if (entry && entry.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return entry.url;
  }
  return null;
}

async function resolvePath(
  path: string,
  expiresIn: number,
): Promise<string | null> {
  const fresh = getFresh(path);
  if (fresh) return fresh;
  const existing = inFlight.get(path);
  if (existing) return existing;
  const promise = createSignedUrlForFoto(path, expiresIn)
    .then((url) => {
      if (url) {
        cache.set(path, { url, expiresAt: Date.now() + expiresIn * 1000 });
      }
      return url;
    })
    .finally(() => {
      inFlight.delete(path);
    });
  inFlight.set(path, promise);
  return promise;
}

/**
 * Resolve um foto_url (URL legada ou path) para um signed URL renderizável.
 * Pass-through de URLs http externas; null para valor inválido.
 */
export function useSignedUrl(
  value: string | null | undefined,
  options?: { expiresIn?: number },
): SignedUrlState {
  const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRES_IN;
  const path = getStoragePath(value);
  const passthrough =
    !path && typeof value === 'string' && /^https?:\/\//i.test(value);

  const [url, setUrl] = useState<string | null>(() => {
    if (passthrough) return value as string;
    return path ? getFresh(path) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (passthrough) {
      setUrl(value as string);
      setLoading(false);
      setError(false);
      return;
    }
    if (!path) {
      setUrl(null);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    resolvePath(path, expiresIn).then((resolved) => {
      if (!active) return;
      setUrl(resolved);
      setError(resolved === null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [path, passthrough, value, expiresIn]);

  return { url, loading, error };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/hooks/storage/__tests__/useSignedUrl.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/storage/useSignedUrl.ts src/hooks/storage/__tests__/useSignedUrl.test.ts
git commit -m "feat(storage): hook useSignedUrl (assina on-read, cache, dedupe, pass-through)"
```

---

## Task 4: Uploads persistem path + `deletarFoto` usa `getStoragePath`

**Files:**

- Modify: `src/lib/storage.ts` (`uploadFotoEntrega`, `uploadFotoEntregaWithProgress`, `uploadFotoUsuario`, `uploadIncidentPhoto`, `deletarFoto`)
- Test: `src/lib/__tests__/storage.test.ts`

**Interfaces:**

- Consumes: `getStoragePath` (Task 1)
- Produces: uploads retornam/persistem o **path** (não a URL pública); `deletarFoto` aceita URL legada e path.

- [ ] **Step 1: Atualizar os testes (devem falhar)**

Em `src/lib/__tests__/storage.test.ts`, ajustar as expectativas dos uploads para o **path** e adicionar caso de `deletarFoto` com path. Exemplos (adaptar aos nomes/mocks existentes):

```ts
it('uploadFotoEntrega retorna o path (não a URL pública)', async () => {
  // ... mocks de upload OK já existentes ...
  const result = await uploadFotoEntrega('u1', 'r1', 'p1', 'file://x.jpg');
  expect(result).toMatch(/^u1\/r1\/p1_\d+\.jpg$/);
});

it('uploadFotoUsuario grava o path em usuarios.foto_url', async () => {
  const result = await uploadFotoUsuario('user1', 'file://x.jpg');
  expect(result).toMatch(/^perfis\/perfil_user1_\d+\.jpg$/);
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ foto_url: expect.stringMatching(/^perfis\//) }),
  );
});

it('deletarFoto aceita path puro', async () => {
  await deletarFoto('perfis/perfil_x.jpg');
  expect(mockRemove).toHaveBeenCalledWith(['perfis/perfil_x.jpg']);
});
```

Remover/ajustar asserts antigos que esperavam a URL pública como retorno.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/__tests__/storage.test.ts`
Expected: FAIL nos casos ajustados (ainda retorna `publicUrl`).

- [ ] **Step 3: Implementar as trocas**

`uploadFotoEntrega` — substituir o bloco `getPublicUrl` (linhas ~100-105) por:

```ts
// Persistir o PATH (bucket privado: signed URL é gerado on-read)
return filePath;
```

`uploadFotoEntregaWithProgress` — web (`xhr.onload`, ~174-182): trocar o `getPublicUrl`/`resolve(url)` por:

```ts
onProgress?.(90);
onProgress?.(100);
resolve(filePath);
```

e native (~227-235): trocar por:

```ts
onProgress?.(90);
onProgress?.(100);
return filePath;
```

`uploadFotoUsuario` — (~442-461): remover `getPublicUrl`; gravar e retornar path:

```ts
// Atualizar tabela usuarios com o PATH da nova foto
const { error: updateError } = await supabase
  .from('usuarios')
  .update({ foto_url: filePath, updated_at: new Date().toISOString() })
  .eq('id', usuarioId);

if (updateError) {
  logger.error('[Storage] Erro ao atualizar foto_url no banco', updateError);
  throw updateError;
}

return filePath;
```

`uploadIncidentPhoto` — (~506-511): trocar por:

```ts
// Persistir o PATH (signed URL gerado on-read)
return filePath;
```

`deletarFoto` — substituir o corpo de extração de path:

```ts
export async function deletarFoto(fotoUrl: string): Promise<boolean> {
  try {
    const filePath = getStoragePath(fotoUrl);
    if (!filePath) {
      logger.warn('[Storage] deletarFoto: valor inválido, nada a remover');
      return false;
    }
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .remove([filePath]);
    if (error) {
      logger.error('[Storage] Erro ao deletar', error);
      throw error;
    }
    return true;
  } catch (error) {
    logger.error('[Storage] Erro ao deletar foto', error);
    return false;
  }
}
```

> `uploadELinkFotoParada` não muda: passa o path de `uploadFotoEntrega*` para `salvarFotoParada` (grava path) e, no rollback, para `deletarFoto` (que agora aceita path).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/__tests__/storage.test.ts`
Expected: PASS (todo o arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts
git commit -m "feat(storage): uploads persistem path; deletarFoto via getStoragePath"
```

---

## Tasks 5-12: Sites de render usam `useSignedUrl`

> **Padrão comum a todas:** importar `import { useSignedUrl } from '@/hooks/storage/useSignedUrl';`, chamar o hook no topo do componente (regra dos hooks — nunca condicional), e usar `url` no lugar do `foto_url` cru no `<Image>`/gate/callback. Nos **testes existentes** de cada componente, mockar o hook:
>
> ```ts
> jest.mock('@/hooks/storage/useSignedUrl', () => ({
>   useSignedUrl: jest.fn(),
> }));
> import { useSignedUrl } from '@/hooks/storage/useSignedUrl';
> (useSignedUrl as jest.Mock).mockReturnValue({
>   url: 'https://signed/x',
>   loading: false,
>   error: false,
> });
> ```

### Task 5: `UserMenuTrigger` (cobre ~11 telas via `userImageUrl`)

**Files:** Modify `src/components/UserMenuTrigger.tsx`; Test `src/components/__tests__/UserMenuTrigger.test.tsx`

- [ ] **Step 1: Teste que falha** — em `UserMenuTrigger.test.tsx`, adicionar o mock do hook (acima) e:

```ts
it('usa o signed URL do hook na imagem', () => {
  (useSignedUrl as jest.Mock).mockReturnValue({ url: 'https://signed/u', loading: false, error: false });
  const { UNSAFE_getByType } = render(<UserMenuTrigger name="João" imageUrl="perfis/p.jpg" />);
  expect(UNSAFE_getByType(require('react-native').Image).props.source).toEqual({ uri: 'https://signed/u' });
});
it('mostra inicial quando o hook retorna null', () => {
  (useSignedUrl as jest.Mock).mockReturnValue({ url: null, loading: false, error: false });
  const { queryByText } = render(<UserMenuTrigger name="João" imageUrl="perfis/p.jpg" />);
  expect(queryByText('J')).toBeTruthy();
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/components/__tests__/UserMenuTrigger.test.tsx`
- [ ] **Step 3: Implementar** — em `UserMenuTrigger.tsx`:
  - adicionar import do hook;
  - dentro do componente: `const { url: signedImageUrl } = useSignedUrl(imageUrl);`
  - trocar o gate/Image (linha ~70-71):

```tsx
{
  signedImageUrl ? (
    <Image
      source={{ uri: signedImageUrl }}
      style={styles.avatarImage}
      resizeMode="cover"
    />
  ) : (
    <Text style={styles.avatarText}>{initial}</Text>
  );
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/components/__tests__/UserMenuTrigger.test.tsx`
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): UserMenuTrigger usa signed URL"`

### Task 6: `AvatarEditable` (cobre perfil/equipe)

**Files:** Modify `src/components/AvatarEditable.tsx`; Test `src/components/__tests__/AvatarEditable.a11y.test.tsx` (ou novo arquivo de teste de imagem)

- [ ] **Step 1: Teste que falha** — render com `imageUrl="perfis/p.jpg"` e hook mockado retornando `url: 'https://signed/a'`; assert `Image.props.source.uri === 'https://signed/a'`. Com `url: null` → renderiza iniciais (`getByText('US')` para name "Usuário Sobrenome").
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/components/__tests__/AvatarEditable.a11y.test.tsx`
- [ ] **Step 3: Implementar** — em `AvatarEditable.tsx`: import do hook; `const { url: signedImageUrl } = useSignedUrl(imageUrl);` e trocar a condição `imageUrl ?` (linha ~152) e o `source={{ uri: imageUrl }}` (linha ~154) por `signedImageUrl`.
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): AvatarEditable resolve signed URL internamente"`

### Task 7: `ParadaCard`

**Files:** Modify `src/components/gestor/mapa-rota/ParadaCard.tsx`; Test `…/__tests__/ParadaCard.test.tsx`

- [ ] **Step 1: Teste que falha** — hook mockado; com `parada.foto_url='u/r/p.jpg'` e `url:'https://signed/p'` a foto renderiza com esse uri; com `url:null` mostra placeholder/sem foto.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** — no topo do render: `const { url: fotoUrl } = useSignedUrl(parada.foto_url);` e trocar:
  - gate (linha 169): `{fotoUrl && !imageError && (`
  - `onPress` (172): `onImagePress(fotoUrl)`
  - `Image` (176): `source={{ uri: fotoUrl }}`
    > O comparador do `React.memo` (linha 208-215) continua comparando `parada.foto_url` — ok (o input não muda).
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): ParadaCard usa signed URL"`

### Task 8: `ParadaCardCompact`

**Files:** Modify `src/components/gestor/mapa-rota/ParadaCardCompact.tsx`; Test `…/__tests__/ParadaCardCompact.test.tsx`

- [ ] **Step 1: Teste que falha** — hook mockado; `hasPhoto` derivado do signed url.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** — no topo: `const { url: fotoUrl } = useSignedUrl(parada.foto_url);`
  - linha 93: `const hasPhoto = !!fotoUrl && !imageError;`
  - `onImagePress(parada.foto_url!)` (225, 246) → `onImagePress(fotoUrl!)`
  - `Image` (249): `source={{ uri: fotoUrl ?? undefined }}`
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): ParadaCardCompact usa signed URL"`

### Task 9: `IncidenteDetalhesModal`

**Files:** Modify `src/components/gestor/incidentes/IncidenteDetalhesModal.tsx`; Test `…/__tests__/` correspondente

- [ ] **Step 1: Ler o componente inteiro** para mapear `fotoRetryCount`, `fotoError`, `fotoLoading`, `onFotoLoad`, `onFotoError` (origem: props ou hook local). Run: `npx jest` não — apenas leitura.
- [ ] **Step 2: Teste que falha** — hook mockado; `incidente.foto_url='incidentes/i.jpg'`, `url:'https://signed/i'` → `Image.source.uri === 'https://signed/i'`.
- [ ] **Step 3: Rodar e ver falhar**
- [ ] **Step 4: Implementar** — substituir o cálculo `fotoUri` (linhas 69-73) por `const { url: fotoUri } = useSignedUrl(incidente.foto_url);`. Remover a concatenação `?retry=${fotoRetryCount}` (signed URLs são únicos). Se `fotoRetryCount` ficar sem uso, remover sua declaração/uso; manter o botão "Tentar novamente" resetando `fotoError` (comportamento existente). `Image` (305) continua `source={{ uri: fotoUri }}`.
- [ ] **Step 5: Rodar e ver passar**; depois **Step 6: Commit** — `git commit -m "feat(c3): IncidenteDetalhesModal usa signed URL"`

### Task 10: `DrawerHeader`

**Files:** Modify `src/components/drawer/DrawerHeader.tsx`; Test `…/__tests__/` (criar se não existir)

- [ ] **Step 1: Teste que falha** — hook mockado; `profile.foto_url='perfis/p.jpg'`, `url:'https://signed/d'` → Image com esse uri; `url:null` → inicial do nome.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** — import do hook; `const { url: avatarUrl } = useSignedUrl(profile?.foto_url);`; trocar gate (20) e `Image` (21) para `avatarUrl`.
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): DrawerHeader usa signed URL"`

### Task 11: `PerfilHeader`

**Files:** Modify `src/components/gestor/motorista-perfil/PerfilHeader.tsx`; Test correspondente

- [ ] **Step 1: Teste que falha** — hook mockado; `motorista.foto_url` → signed; null → iniciais.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** — `const { url: avatarUrl } = useSignedUrl(motorista.foto_url);`; trocar gate (38) e `Image` (39).
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `git commit -m "feat(c3): PerfilHeader usa signed URL"`

### Task 12: `app/gestor/motoristas.tsx`

**Files:** Modify `app/gestor/motoristas.tsx`; Test correspondente (se existir)

- [ ] **Step 1: Ler** o render ~255-270 para a estrutura do item da lista (o `<Image>` está dentro de um `.map`). Como hooks não podem ser chamados dentro de `.map`, **extrair um pequeno componente** `MotoristaAvatar` que recebe `foto_url` e chama `useSignedUrl`, OU mover a lista para um componente de item próprio.
- [ ] **Step 2: Teste que falha** — para o novo `MotoristaAvatar`: hook mockado → renderiza Image com signed uri; null → placeholder/inicial.
- [ ] **Step 3: Rodar e ver falhar**
- [ ] **Step 4: Implementar** — criar `MotoristaAvatar` (no mesmo arquivo ou `src/components/...`), usar `useSignedUrl(foto_url)`, e substituir o bloco `{motorista.foto_url ? <Image .../> : ...}` (261-263) pelo componente.
- [ ] **Step 5: Rodar e ver passar**; **Step 6: Commit** — `git commit -m "feat(c3): lista de motoristas usa signed URL (MotoristaAvatar)"`

---

## Task 13: Migration — privar o bucket (criar arquivo)

**Files:**

- Create: `database/migrations/<YYYYMMDDhhmmss>_c3_bucket_fotos_entrega_privado.sql`
- Create: cópia idêntica em `supabase/migrations/<mesmo nome>.sql`

- [ ] **Step 1: Criar a migration** (usar a skill `/new-migration` para o scaffold/timestamp). Conteúdo:

```sql
-- C3 Fase 1: tornar o bucket fotos-entrega privado.
-- Signed URLs passam a ser gerados on-read (ver src/hooks/storage/useSignedUrl).
-- As policies de storage.objects permanecem (necessárias p/ gerar signed URL).
-- ATENÇÃO: aplicar SOMENTE após o código estar deployado (web) — ver plano §Rollout.
update storage.buckets set public = false where id = 'fotos-entrega';
```

- [ ] **Step 2: Revisar com a agent `rls-policy-reviewer`** (mudança de storage). Esperado: APPROVE (não altera RLS; só o flag `public`).
- [ ] **Step 3: NÃO aplicar ainda.** Commit do arquivo:

```bash
git add database/migrations supabase/migrations
git commit -m "feat(c3): migration p/ privar bucket fotos-entrega (aplicar pós-deploy)"
```

---

## Task 14: Verificação final + rollout

- [ ] **Step 1: Rodar a suíte completa e os gates**

```bash
npx jest src/lib src/hooks/storage src/components app/gestor
npm run type-check
npx eslint . --ext .ts,.tsx --max-warnings=0
```

Expected: tudo verde.

- [ ] **Step 2: Abrir o PR do código** (sem a aplicação da migration). Mergear após CI verde + review (workflow do repo). Confirmar deploy web (Vercel).

- [ ] **Step 3: Aplicar a privatização** (pós-deploy): `mcp__supabase__apply_migration` com o SQL da Task 13 (ou `supabase db push`).

- [ ] **Step 4: Verificar o advisor**

Run (MCP): `get_advisors(type: "security")`
Expected: `public_bucket_allows_listing` **ausente** (resolvido).

- [ ] **Step 5: Smoke manual** — logar como gestor (web), abrir mapa-rota com parada com foto, perfil com avatar, e um incidente com foto → imagens renderizam (signed URL). Confirmar que uma URL pública antiga, colada direto no navegador, agora **falha**.

- [ ] **Step 6: Avisar os ~17 usuários** para atualizarem o app nativo (builds antigos quebram as fotos).

---

## Self-Review

**Spec coverage:** §4.1 storage→Task 13; §4.2 util/uploads/deletar→Tasks 1,2,4; §4.3 hook→Task 3; §4.4 render (compartilhados + standalone)→Tasks 5-12; §5 rollout→Tasks 13-14; §6 testes→cada task; §7 critérios→Task 14. `useProfilePhoto` sem mudança (confirmado). Sem lacunas.

**Placeholder scan:** sem TBD/TODO; código completo nas funções/hook/migration; edits de componente com linhas-âncora e trechos exatos.

**Type consistency:** `getStoragePath(value) → string|null`, `createSignedUrlForFoto(value, expiresIn?) → Promise<string|null>`, `useSignedUrl(value, {expiresIn?}) → {url, loading, error}` — usados consistentemente nas Tasks 3-12. Bucket sempre via `BUCKET_FOTOS_ENTREGA`. TTL `3600` / margem `60_000` consistentes.
