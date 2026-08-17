# Templates de email do Supabase Auth

Fonte de verdade **versionada** dos 6 templates de email do Auth. Antes disso eles
existiam só dentro do painel do Supabase, sem histórico e sem revisão.

## ⚠️ Estes arquivos não são lidos em produção

O Supabase hospedado não lê deste diretório. Editar um arquivo aqui **não muda**
o email que o usuário recebe — é preciso colar o conteúdo no painel:

`Authentication → Emails → <template> → Body (Source)`

https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/auth/templates

O `content_path` de `[auth.email.template.*]` no `supabase/config.toml` só afeta
`supabase start` (stack local). Não foi apontado para cá de propósito: aquele
arquivo ainda carrega `site_url = "http://127.0.0.1:3000"`, e um `config push`
acidental sobrescreveria a configuração de produção.

## Mapa arquivo → aba do painel → assunto

O assunto (**Subject**) fica fora do HTML, num campo separado do painel. Os
valores em produção hoje:

| Arquivo                     | Aba                  | Subject                       | Dispara?                                           |
| --------------------------- | -------------------- | ----------------------------- | -------------------------------------------------- |
| `confirm-signup.html`       | Confirm signup       | Confirme seu cadastro         | **sim**, todo cadastro                             |
| `reset-password.html`       | Reset Password       | Redefina sua senha            | **sim**                                            |
| `magic-link.html`           | Magic Link           | Seu link mágico               | não — o app não usa `signInWithOtp`                |
| `invite-user.html`          | Invite user          | Você foi convidado(a)         | só via convite manual no painel                    |
| `change-email-address.html` | Change Email Address | Confirmar alteração de e-mail | não — `updateUser` só é chamado com `{ password }` |
| `reauthentication.html`     | Reauthentication     | Confirmar reautenticação      | não                                                |

Os três de baixo estão em texto simples de propósito: nenhum é disparado pelo
app, então não valem o custo de manutenção de um layout completo.

## Invariantes

**Os links de `reset-password.html` e `confirm-signup.html` NÃO podem virar
`{{ .ConfirmationURL }}` direto.** Ambos apontam para uma página intermediária,
com o link real do Supabase no fragmento:

```
{{ .SiteURL }}/auth/confirm-reset#url={{ .ConfirmationURL }}     ← reset-password.html
{{ .SiteURL }}/auth/confirm-signup#url={{ .ConfirmationURL }}    ← confirm-signup.html
```

Fragmento (`#…`) nunca é enviado ao servidor HTTP, então link scanner de email
corporativo não consegue consumir o OTP single-use antes do usuário.

- No **reset**, o OTP consumido deixa o usuário sem redefinir a senha. Bug
  corrigido em `43d3352`.
- No **signup** o efeito é diferente e pior sob a ótica de segurança: o verify
  redireciona com **tokens de sessão** na URL, então o scanner que consome o
  link recebe uma sessão válida. (A conta acaba confirmada, e por isso o login
  costuma funcionar — o problema não é o usuário travar, é a sessão vazar.)

Pelo mesmo motivo, o **texto visível** do link alternativo precisa incluir o
`#url=…` nos dois. Sem ele, quem copia e cola cai em
`getConfirmationUrl() → null` e vê a tela "Link inválido".

A extração e a validação do destino vivem em `src/lib/auth/confirmationLink.ts`
(compartilhadas pelas duas telas); o layout, em
`src/components/auth/ConfirmLinkScreen.tsx`. Ver também
`docs/PASSWORD_RECOVERY.md`.

Isso depende de `Site URL = https://app.rotamestre.tec.br` em
`Authentication → URL Configuration`. Se o Site URL mudar, os links mudam junto.

## Restrições de cliente de email respeitadas aqui

Não desfaça estas ao editar — cada uma cobre um cliente que quebra:

- **Botão em `<table>`/`<td bgcolor>`, com o `padding` no `<td>`.** O Outlook
  desktop não aplica `padding` em elemento inline nem entende
  `display: inline-block`. Um `<a>` estilizado direto vira um retângulo
  apertado colado no texto. O `<a>` fica dentro do `<td>` com `display: block`.
  **Não devolva `padding` para o `<a>`.**
- **`background-color` antes do `background-image: linear-gradient(...)`** no
  cabeçalho, mais o atributo `bgcolor`. O Outlook (engine do Word) ignora
  gradiente; sem o fallback o `<h1>` branco fica invisível sobre fundo branco.
- **Emoji em vez de `<svg>` inline.** O Gmail remove `<svg>`; o Outlook não
  suporta nem `<svg>` nem o `display: inline-flex` / `border-radius` que faziam
  a bolinha colorida ao redor do ícone.
- **Avisos em `<table>`, não em `<div>`.** O suporte a `padding` em `<div>` é
  instável no Outlook. Pelo mesmo motivo o espaçamento entre eles usa linhas
  `<td height="…">` em vez de `margin` (ignorada em `<table>`).
- **`padding` no `<td>` externo, nunca na `<table>` externa** — Outlook ignora
  padding em `table`, e o email ficaria sem margem lateral.
- **`max-width: 600px; width: 100%`** na tabela interna, além do `width="600"`
  do atributo — sem isso alguns clientes forçam scroll horizontal no celular.
- **`<meta name="color-scheme" content="light">`** contra a inversão automática
  de cores do Apple Mail / Outlook.com. Sem isso o texto auxiliar `#9ca3af`
  fica ilegível em dark mode. (O Gmail descarta o `<head>` inteiro — lá não tem
  efeito, e não há solução via `<head>`.)
- **`role="presentation"`** nas tabelas de layout, para leitor de tela não
  anunciar como tabela de dados.

**Acentos:** os 3 fragmentos sem `<head>` (`invite-user`, `change-email-address`,
`reauthentication`) usam **entidades HTML** (`&ecirc;`, `&ccedil;&atilde;o`),
porque não têm `<meta charset>` para se apoiar. Os 3 branded declaram charset e
podem usar acento literal. Ao editar os fragmentos, mantenha as entidades.

**Preheader:** cada template branded abre com um `<div>` oculto
(`display:none; mso-hide:all`) que define o texto de prévia na lista de emails.
Sem ele, o cliente mostra "Rota Mestre Gestão Inteligente de Entregas".

**`{{ .Email }}`:** os 3 branded identificam a conta destinatária no corpo. É
uma defesa contra phishing — um email de senha que não diz de qual conta fala é
mais fácil de imitar.

Não existe versão texto-plano: o painel do Supabase não oferece multipart.
