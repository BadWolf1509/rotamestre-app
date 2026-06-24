# C3 — Bucket `fotos-entrega` privado + signed URLs (Fase 1)

**Data:** 2026-06-23
**Status:** Aprovado (design) — pronto para plano de implementação
**Relacionado:** seção 8 (follow-up C3) de `docs/superpowers/specs/2026-06-22-security-hardening-multitenant-design.md`; advisor `public_bucket_allows_listing`.

## 1. Contexto e problema

O bucket de fotos `fotos-entrega` (comprovantes de entrega, fotos de perfil, fotos de incidente) está **público**. Verificação no banco vivo (`xezslsyxjivunmhhyxtd`, 2026-06-23):

- `storage.buckets`: `fotos-entrega` com `public = true`, limite 5 MB, mime `image/jpeg|png|webp`, **968 objetos**.
- Policy de SELECT em `storage.objects`: `bucket_id = 'fotos-entrega'` para o role **`authenticated`** (sem escopo de unidade). Combinado com o bucket público, isso gera **duas exposições**:
  1. **Download público:** qualquer pessoa com o link (ou que adivinhe o path estruturado `unidadeId/rotaId/...`) baixa o arquivo **sem login**.
  2. **Enumeração cross-tenant:** qualquer usuário **autenticado** (de qualquer unidade) pode listar/ler as fotos de **todos** os tenants.
- O advisor `public_bucket_allows_listing` confirma a exposição (re-verificado 2026-06-23).
- Conteúdo é **PII** (endereços, destinatários, comprovantes, rostos em perfil) → risco LGPD.

### O que é persistido hoje

A coluna guarda a **URL pública completa**. Escala (2026-06-23):

| Tabela       | Total | Com `foto_url` | Observação                                                                      |
| ------------ | ----- | -------------- | ------------------------------------------------------------------------------- |
| `paradas`    | 2569  | 871            | ⚠️ algumas linhas têm a string literal `"success"` em vez de URL (bug de dados) |
| `usuarios`   | 17    | 4              | URL pública válida (`perfis/...`)                                               |
| `incidentes` | 28    | 17             | URL pública válida (`incidentes/...`)                                           |

- **`logs.detalhes`: 0 linhas** referenciam o bucket → **não é alvo** (apesar de o roadmap citar).
- **Paths:** `paradas` = `unidadeId/rotaId/...` (escopável por unidade); **perfil** = `perfis/...` e **incidente** = `incidentes/...` (**sem unidade no path**).

### Superfície de código (mapa)

- Upload central: `src/lib/storage.ts` — 5× `getPublicUrl`, **zero** signed URL; uploads em `uploadFotoEntrega`, `uploadFotoEntregaWithProgress`, `uploadFotoUsuario`, `uploadIncidentPhoto`; persistência em `salvarFotoParada` e `uploadFotoUsuario`; deleção em `deletarFoto` (extrai path da URL via split).
- Render (remoto) — **mais amplo que o esperado** (varredura `foto_url` em `app/` + `src/`): a maioria das telas renderiza avatar via **componentes compartilhados** — `UserMenuTrigger` (avatar do header, via `userImageUrl`/`useDesktopHeaderMenu` em ~11 telas) e `AvatarEditable` (`PerfilDesktopLayout`, `app/perfil/index.tsx`, `app/motorista/perfil/index.tsx`). Sites **standalone** com `<Image>` direto: `ParadaCard`, `ParadaCardCompact`, `IncidenteDetalhesModal`, `DrawerHeader`, `PerfilHeader`, `app/gestor/motoristas.tsx` (via `MotoristaAvatar`), **`Avatar`** (genérico — usado por `app/unidade/equipe.tsx` e `UserCell`/`DataTableRenderers`) e **`DashboardMobile`** (avatar do gestor no mobile). `CameraUpload` e os previews do wizard de incidente usam `file://` local (não contam). **Prop morta:** `StatusSection.userPhoto`. ⚠️ `Avatar` e `DashboardMobile` só foram identificados no **review final do branch** (o mapa inicial errava ao atribuir `equipe.tsx` ao `AvatarEditable`).
- Constante do bucket: `BUCKET_FOTOS_ENTREGA = 'fotos-entrega'` em `src/lib/storage.ts`.

## 2. Objetivo e escopo

**Objetivo (Fase 1):** tornar `fotos-entrega` **privado** e servir as fotos a usuários autenticados via **signed URLs de curta duração**, fechando o download público e a enumeração anônima.

**No escopo:**

- `storage.buckets.public = false`.
- Camada de assinatura (util + hook) e troca dos sites de render.
- Uploads passam a persistir o **path** (não a URL pública).
- Sem backfill: o código aceita os **dois formatos** (URL legada + path).

**Fora de escopo (Fase 2 / outros):**

- **Isolamento por unidade** em `storage.objects` (usuário da unidade A não acessa fotos da B). Exige paths `unidadeId/...` para perfil/incidente (hoje não têm) ou mapeamento via tabela. Documentado como Fase 2.
- Embed de foto no PDF export (v2).
- Bucket `incidentes` órfão (há policies para um bucket `incidentes`, mas as fotos de incidente moram em `fotos-entrega/incidentes/`) — verificar à parte.
- `logs.detalhes` (0 linhas referenciam o bucket).

## 3. Decisões

- **Profundidade (Fase 1):** fechar a exposição pública; o acesso cross-unidade por usuário autenticado fica para a Fase 2. Justificativa: a maior exposição real (internet aberta) é o bucket público; o app está pré-lançamento (~17 usuários).
- **Abordagem A — hook on-read, sem migração de dados:** o valor salvo pode ser URL antiga ou path; um util normaliza para path e um hook gera o signed URL sob demanda. Menor risco e mais contido; linhas antigas seguem funcionando sem backfill.

## 4. Desenho

### 4.1 Storage (infra/DB)

- Migration: `update storage.buckets set public = false where id = 'fotos-entrega';` (seguindo as convenções de `database/migrations` + `supabase/migrations`; revisada pela `rls-policy-reviewer`).
- **Policies de `storage.objects` permanecem.** A SELECT (`authenticated AND bucket_id='fotos-entrega'`) é necessária para usuários logados **gerarem signed URL**. O acesso cross-unidade que ela ainda permite é justamente o adiado para a Fase 2. Privar o bucket já limpa o advisor `public_bucket_allows_listing`.

### 4.2 Camada de assinatura (`src/lib/storage.ts`)

- `getStoragePath(value: string | null): string | null` — extrai o path dentro do bucket a partir de uma URL pública (`.../object/public/fotos-entrega/<path>`), de uma URL assinada (`.../object/sign/fotos-entrega/<path>`) ou de um path puro; retorna `null` para vazio/lixo (ex.: `"success"`).
- `createSignedUrlForFoto(value: string | null, expiresIn = 3600): Promise<string | null>` — `getStoragePath` → `supabase.storage.from('fotos-entrega').createSignedUrl(path, expiresIn)`; em erro, `logger.warn` + `null`.
- **Uploads persistem o path:** `uploadFotoEntrega`, `uploadFotoEntregaWithProgress`, `uploadFotoUsuario`, `uploadIncidentPhoto` passam a retornar/gravar o `filePath` em vez de `getPublicUrl(filePath)`.
- `deletarFoto(value)` usa `getStoragePath(value)` (serve para URL legada e path) antes de `.remove([path])`.

### 4.3 Hook de leitura (`src/hooks/storage/useSignedUrl.ts`)

- `useSignedUrl(value: string | null, options?: { expiresIn?: number }): { url: string | null; loading: boolean; error: boolean }`.
- Extrai o path, assina, **cacheia em memória por path** com timestamp de expiração; reusa o cache se ainda válido e **reassina** dentro de uma janela antes de expirar; **dedupe de requisições in-flight** (paths iguais compartilham uma chamada). `value` inválido/`null` → `url = null`.
- **Robustez p/ componentes genéricos:** `getStoragePath` devolve `null` para URLs http externas (não-bucket); o hook então faz **pass-through** dessas URLs (retorna o valor original). Assim `useSignedUrl` é seguro dentro de `AvatarEditable`/`UserMenuTrigger`, que são genéricos.
- Batch (`useSignedUrls(values[])` via `createSignedUrls`) fica como **otimização futura** caso listas grandes pesem; a virtualização já limita os cards renderizados.

### 4.4 Sites de render (trocam a fonte da imagem)

Estratégia: resolver via `useSignedUrl` **dentro dos componentes compartilhados** (cobre ~13 telas sem editá-las) + nos sites standalone.

**Compartilhados (resolução interna):**

- `UserMenuTrigger` — `useSignedUrl(imageUrl)`; cobre todas as ~11 telas que passam `userImageUrl` via `useDesktopHeaderMenu`.
- `AvatarEditable` — `useSignedUrl(imageUrl)`; cobre `PerfilDesktopLayout`, `app/perfil/index.tsx`, `app/motorista/perfil/index.tsx`, `app/unidade/equipe.tsx` (sem editá-las).

**Standalone (`<Image>` direto):** `ParadaCard`, `ParadaCardCompact`, `IncidenteDetalhesModal` (substitui o hack `?retry=`), `DrawerHeader`, `PerfilHeader`, `app/gestor/motoristas.tsx` (via `MotoristaAvatar`), `Avatar` (genérico — cobre `app/unidade/equipe.tsx` + `UserCell`) e `DashboardMobile` (avatar do gestor no mobile). Os dois últimos foram adicionados no review final do branch.

- **Sem mudança:** `useProfilePhoto` (grava o que o upload retorna = path; exibe via os componentes acima); `CameraUpload` preview (`file://` local); PDF export (v1 não embute foto). **Prop morta:** `StatusSection.userPhoto`.

### 4.5 Fluxo de dados

- **Upload:** captura → upload para `fotos-entrega/<path>` → persiste **path** em `foto_url` → UI renderiza via `useSignedUrl(path)`.
- **Leitura:** componente lê `foto_url` (path ou URL legada) → `useSignedUrl` → `getStoragePath` → `createSignedUrl` → `<Image>`. Expirou → hook reassina.

### 4.6 Tratamento de erro

- `null`/vazio/`"success"` → `url = null` → fallback existente (avatar placeholder / sem imagem).
- Falha de assinatura ou offline → `logger.warn` + fallback. (Assinar exige rede; visualizar foto offline não é suportado — fotos são remotas.)

## 5. Migração e rollout

- **Sem backfill de dados** (Abordagem A). A única mudança de estado é `public = false`.
- **Quebra:** privar o bucket invalida as URLs públicas antigas **na hora**.
  - **Ordem obrigatória:** (1) mergear o código (util + hook + sites + uploads), (2) confirmar o deploy web (Vercel auto-deploy no `main`), (3) **só então** rodar a migration que priva o bucket.
  - **Builds nativos antigos:** motoristas em build antigo (sem o hook) usam URL pública → fotos quebram até atualizarem o app. **Aceito** no estágio atual (pré-lançamento, ~17 usuários, rebuild recente); avisar usuários para atualizar.
- Após o flip: re-rodar `get_advisors` (security) e confirmar `public_bucket_allows_listing` resolvido.

## 6. Testes (TDD)

- `getStoragePath`: URL pública→path, URL assinada→path, path→path, lixo (`"success"`/vazio)→null.
- `createSignedUrlForFoto`: sucesso (mock `createSignedUrl`), erro→null.
- Uploads: assert que persistem **path** (ajustar mocks de `getPublicUrl` em `src/lib/__tests__/storage.test.ts`).
- `deletarFoto`: funciona com URL legada e com path.
- `useSignedUrl`: assina, cacheia, reassina ao expirar, dedupe, `null`→`url=null`.
- Componentes: mock de `useSignedUrl` → assert `uri` e fallback quando `url=null`, nos compartilhados (`UserMenuTrigger`, `AvatarEditable`) e nos standalone (`ParadaCard`, `ParadaCardCompact`, `IncidenteDetalhesModal`, `DrawerHeader`, `PerfilHeader`, `MotoristaAvatar`, `Avatar`, `DashboardMobile`). Testes de avatar devem usar um **path puro** como input (não URL completa) — senão o pass-through mascara o bug. Testes existentes desses componentes (ex.: `UserMenuTrigger.test.tsx`, a11y/`PerfilDesktopLayout.test.tsx`) devem mockar o hook.

## 7. Critérios de aceite

- Advisor `public_bucket_allows_listing` **resolvido**.
- Fotos (parada, perfil, incidente) **renderizam** para usuário autenticado, no web e no native (build novo).
- Linhas **antigas** (URL pública) continuam renderizando via assinatura (sem backfill).
- Linhas `"success"`/inválidas → fallback, sem crash.
- Download por **URL pública antiga** passa a **falhar** (bucket privado).
- Suíte verde (`jest`), `tsc --noEmit` e `eslint` limpos.

## 8. Riscos

- **Expiração durante visualização:** mitigado por TTL (1 h) + reassinatura no hook.
- **Custo de assinatura em listas:** dezenas de chamadas no primeiro render de uma rota; mitigado por cache + virtualização; batch é o plano B.
- **Builds nativos antigos:** ver §5 (aceito).
- **`createSignedUrl` exige a policy SELECT atual:** mantida de propósito.
