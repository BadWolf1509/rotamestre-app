# 🌐 Configuração DNS - RotaMestre

## 📋 Registros DNS Necessários

### Domínio Principal - rotamestre.tec.br

```dns
; A/AAAA Records (IP do servidor/Vercel)
rotamestre.tec.br.           300   IN   A      76.76.21.21
rotamestre.tec.br.           300   IN   AAAA   2606:4700:3034::ac43:bd5e

; CNAME para www (redirect)
www.rotamestre.tec.br.       300   IN   CNAME  rotamestre.tec.br.
```

### App Web - app.rotamestre.tec.br

```dns
; CNAME para Vercel
app.rotamestre.tec.br.       300   IN   CNAME  cname.vercel-dns.com.

; Ou para Netlify
app.rotamestre.tec.br.       300   IN   CNAME  rotamestre-app.netlify.app.

; WWW redirect
www.app.rotamestre.tec.br.   300   IN   CNAME  app.rotamestre.tec.br.
```

### Painel Admin - painel.rotamestre.tec.br

```dns
; CNAME para Vercel
painel.rotamestre.tec.br.    300   IN   CNAME  cname.vercel-dns.com.

; WWW redirect
www.painel.rotamestre.tec.br. 300  IN   CNAME  painel.rotamestre.tec.br.
```

### Documentação - docs.rotamestre.tec.br

```dns
; CNAME para GitHub Pages
docs.rotamestre.tec.br.      300   IN   CNAME  rotamestre.github.io.

; Ou para Vercel
docs.rotamestre.tec.br.      300   IN   CNAME  cname.vercel-dns.com.

; WWW redirect
www.docs.rotamestre.tec.br.  300   IN   CNAME  docs.rotamestre.tec.br.
```

### API - api.rotamestre.tec.br

```dns
; CNAME para Supabase
api.rotamestre.tec.br.       300   IN   CNAME  xezslsyxjivunmhhyxtd.supabase.co.

; Ou CNAME para proxy (Cloudflare Workers/Vercel)
api.rotamestre.tec.br.       300   IN   CNAME  cname.vercel-dns.com.

; WWW redirect
www.api.rotamestre.tec.br.   300   IN   CNAME  api.rotamestre.tec.br.
```

---

## 📧 Email (MX Records)

### Usando Zoho Mail

```dns
; MX Records
rotamestre.tec.br.           300   IN   MX     10  mx1.zoho.com.
rotamestre.tec.br.           300   IN   MX     20  mx2.zoho.com.

; SPF Record (anti-spam)
rotamestre.tec.br.           300   IN   TXT    "v=spf1 include:zoho.com ~all"

; DKIM Record (assinatura de email)
zmail._domainkey.rotamestre.tec.br. 300 IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCS..."

; DMARC Record (política de email)
_dmarc.rotamestre.tec.br.    300   IN   TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@rotamestre.tec.br"
```

### Usando Google Workspace

```dns
; MX Records
rotamestre.tec.br.           300   IN   MX     1   aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     5   alt1.aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     5   alt2.aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     10  alt3.aspmx.l.google.com.
rotamestre.tec.br.           300   IN   MX     10  alt4.aspmx.l.google.com.

; SPF Record
rotamestre.tec.br.           300   IN   TXT    "v=spf1 include:_spf.google.com ~all"

; DMARC Record
_dmarc.rotamestre.tec.br.    300   IN   TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@rotamestre.tec.br"
```

---

## 🔐 Segurança (CAA Records)

```dns
; CAA Records - Autoriza apenas Let's Encrypt e Cloudflare
rotamestre.tec.br.           300   IN   CAA    0 issue "letsencrypt.org"
rotamestre.tec.br.           300   IN   CAA    0 issue "pki.goog"
rotamestre.tec.br.           300   IN   CAA    0 issuewild "letsencrypt.org"
rotamestre.tec.br.           300   IN   CAA    0 iodef "mailto:security@rotamestre.tec.br"
```

---

## 📊 Verificação de Domínios

### Google Search Console

```dns
; TXT Record para verificação
rotamestre.tec.br.           300   IN   TXT    "google-site-verification=abc123..."
```

### Facebook Domain Verification

```dns
; TXT Record para verificação
rotamestre.tec.br.           300   IN   TXT    "facebook-domain-verification=xyz789..."
```

---

## 🎯 Arquivo de Zona Completo (Exemplo)

```bind
$TTL 300
@   IN  SOA ns1.rotamestre.tec.br. admin.rotamestre.tec.br. (
        2025102001  ; Serial
        3600        ; Refresh
        1800        ; Retry
        604800      ; Expire
        300 )       ; Minimum TTL

; Nameservers
@                           IN  NS     ns1.cloudflare.com.
@                           IN  NS     ns2.cloudflare.com.

; A/AAAA Records
@                           IN  A      76.76.21.21
@                           IN  AAAA   2606:4700:3034::ac43:bd5e

; CNAME Records
www                         IN  CNAME  rotamestre.tec.br.
app                         IN  CNAME  cname.vercel-dns.com.
www.app                     IN  CNAME  app.rotamestre.tec.br.
painel                      IN  CNAME  cname.vercel-dns.com.
www.painel                  IN  CNAME  painel.rotamestre.tec.br.
docs                        IN  CNAME  rotamestre.github.io.
www.docs                    IN  CNAME  docs.rotamestre.tec.br.
api                         IN  CNAME  xezslsyxjivunmhhyxtd.supabase.co.
www.api                     IN  CNAME  api.rotamestre.tec.br.

; MX Records (Zoho Mail)
@                           IN  MX     10  mx1.zoho.com.
@                           IN  MX     20  mx2.zoho.com.

; TXT Records
@                           IN  TXT    "v=spf1 include:zoho.com ~all"
_dmarc                      IN  TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@rotamestre.tec.br"
zmail._domainkey            IN  TXT    "v=DKIM1; k=rsa; p=MIGfMA0GCS..."

; CAA Records
@                           IN  CAA    0 issue "letsencrypt.org"
@                           IN  CAA    0 issuewild "letsencrypt.org"
```

---

## ✅ Checklist de Configuração

### Antes de Configurar DNS
- [ ] Conta criada no provedor DNS (Cloudflare/Route53/Vercel)
- [ ] Domínio registrado e transferido
- [ ] Acesso ao painel de controle
- [ ] Backup dos registros DNS atuais

### Configuração Básica
- [ ] A/AAAA records configurados
- [ ] CNAME para subdomínios configurados
- [ ] WWW redirects configurados
- [ ] TTL ajustado (300s durante migração, 3600s em produção)

### Email
- [ ] MX records configurados
- [ ] SPF record adicionado
- [ ] DKIM configurado
- [ ] DMARC configurado
- [ ] Teste de envio/recebimento

### Segurança
- [ ] CAA records adicionados
- [ ] SSL/TLS certificados gerados
- [ ] DNSSEC habilitado (opcional)
- [ ] Firewall configurado (Cloudflare)

### Verificações
- [ ] DNS propagado (use https://dnschecker.org)
- [ ] SSL/TLS funcionando (https://www.ssllabs.com/ssltest/)
- [ ] Redirects funcionando (301 www → non-www)
- [ ] Email funcionando (envio/recebimento)
- [ ] Subdomínios acessíveis

---

## 🛠️ Ferramentas de Teste

### DNS Lookup
```bash
# Verificar A record
dig rotamestre.tec.br A

# Verificar CNAME
dig app.rotamestre.tec.br CNAME

# Verificar MX
dig rotamestre.tec.br MX

# Verificar TXT (SPF)
dig rotamestre.tec.br TXT
```

### SSL/TLS Test
```bash
# Testar SSL com OpenSSL
openssl s_client -connect rotamestre.tec.br:443 -servername rotamestre.tec.br

# Ou use: https://www.ssllabs.com/ssltest/
```

### Propagação DNS
- https://dnschecker.org
- https://www.whatsmydns.net
- https://mxtoolbox.com

---

## 📞 Suporte

### Problemas Comuns

**DNS não propagou**
- Aguarde até 48h (geralmente < 4h)
- Limpe cache DNS: `ipconfig /flushdns` (Windows) ou `sudo dscacheutil -flushcache` (Mac)
- Verifique no https://dnschecker.org

**SSL não funciona**
- Verifique se o CNAME está correto
- Aguarde provisionamento do certificado (até 15min)
- Verifique CAA records

**Email não funciona**
- Verifique MX records com `dig rotamestre.tec.br MX`
- Teste SPF com https://mxtoolbox.com/spf.aspx
- Aguarde propagação DNS

---

**Última atualização**: 2025-10-20
