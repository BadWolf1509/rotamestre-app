# 🌐 Status DNS - RotaMestre

**Última verificação**: 2025-10-20

---

## ✅ Registros DNS Ativos

| Domínio | Tipo | Destino | Status | SSL |
|---------|------|---------|--------|-----|
| rotamestre.tec.br | A | 216.198.79.1 | ✅ Ativo | ✅ |
| www.rotamestre.tec.br | CNAME | 3a288de4d433bd70.vercel-dns-017.com. | ✅ Ativo | ✅ |
| app.rotamestre.tec.br | CNAME | cname.vercel-dns.com. | ✅ Ativo | ✅ |
| painel.rotamestre.tec.br | CNAME | cname.vercel-dns.com. | ✅ Ativo | ✅ |
| docs.rotamestre.tec.br | CNAME | cname.vercel-dns.com. | ✅ Ativo | ✅ |
| api.rotamestre.tec.br | CNAME | cname.vercel-dns.com. | ✅ Ativo | ✅ |

---

## 📊 Infraestrutura

### DNS Provider
- **Provedor**: Vercel DNS
- **Nameservers**:
  - ns1.vercel-dns.com
  - ns2.vercel-dns.com

### Hosting
- **Provider**: Vercel
- **IP Principal**: 216.198.79.1
- **CDN**: Vercel Edge Network
- **SSL**: Let's Encrypt (automático)

---

## 🔍 Verificação de Propagação

### Comandos para Teste

```bash
# Verificar A record
dig rotamestre.tec.br A

# Verificar CNAME
dig app.rotamestre.tec.br CNAME

# Verificar propagação global
# https://dnschecker.org/#A/rotamestre.tec.br
```

### Resultados Esperados

```bash
# rotamestre.tec.br
rotamestre.tec.br.  300  IN  A  216.198.79.1

# www.rotamestre.tec.br
www.rotamestre.tec.br.  300  IN  CNAME  3a288de4d433bd70.vercel-dns-017.com.

# app.rotamestre.tec.br
app.rotamestre.tec.br.  300  IN  CNAME  cname.vercel-dns.com.

# painel.rotamestre.tec.br
painel.rotamestre.tec.br.  300  IN  CNAME  cname.vercel-dns.com.

# docs.rotamestre.tec.br
docs.rotamestre.tec.br.  300  IN  CNAME  cname.vercel-dns.com.

# api.rotamestre.tec.br
api.rotamestre.tec.br.  300  IN  CNAME  cname.vercel-dns.com.
```

---

## 🔐 Certificados SSL/TLS

### Status dos Certificados

| Domínio | Emissor | Validade | Auto-Renew |
|---------|---------|----------|------------|
| rotamestre.tec.br | Let's Encrypt | 90 dias | ✅ Sim |
| app.rotamestre.tec.br | Let's Encrypt | 90 dias | ✅ Sim |
| painel.rotamestre.tec.br | Let's Encrypt | 90 dias | ✅ Sim |
| docs.rotamestre.tec.br | Let's Encrypt | 90 dias | ✅ Sim |
| api.rotamestre.tec.br | Let's Encrypt | 90 dias | ✅ Sim |

### Verificar SSL

```bash
# Testar SSL/TLS
openssl s_client -connect rotamestre.tec.br:443 -servername rotamestre.tec.br

# Ou use: https://www.ssllabs.com/ssltest/
```

---

## 🎯 Redirects Configurados

### HTTPS Forçado
```
http://rotamestre.tec.br → https://rotamestre.tec.br (301)
http://app.rotamestre.tec.br → https://app.rotamestre.tec.br (301)
http://painel.rotamestre.tec.br → https://painel.rotamestre.tec.br (301)
http://docs.rotamestre.tec.br → https://docs.rotamestre.tec.br (301)
http://api.rotamestre.tec.br → https://api.rotamestre.tec.br (301)
```

### WWW Redirect
```
https://www.rotamestre.tec.br → https://rotamestre.tec.br (301)
```

---

## 📧 Email (Status)

### MX Records (Pendente)

Se você deseja configurar email @rotamestre.tec.br, adicione:

```dns
@  IN  MX  10  mx1.zoho.com.
@  IN  MX  20  mx2.zoho.com.

# SPF
@  IN  TXT  "v=spf1 include:zoho.com ~all"

# DMARC
_dmarc  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:admin@rotamestre.tec.br"
```

---

## ⏱️ TTL (Time to Live)

| Registro | TTL | Descrição |
|----------|-----|-----------|
| A | 300s (5min) | Rápida atualização se necessário |
| CNAME | 300s (5min) | Rápida atualização se necessário |
| MX | 3600s (1h) | Email (quando configurado) |

**Nota**: TTL de 300s permite mudanças rápidas. Para produção estável, considerar aumentar para 3600s (1h).

---

## 🔄 Histórico de Mudanças

### 2025-10-20
- ✅ DNS migrado para Vercel
- ✅ Todos os subdomínios configurados
- ✅ SSL automático ativo
- ✅ Redirects HTTPS funcionando

---

## 🛠️ Ferramentas de Monitoramento

### Verificação DNS
- https://dnschecker.org
- https://www.whatsmydns.net
- https://mxtoolbox.com

### Verificação SSL
- https://www.ssllabs.com/ssltest/
- https://www.digicert.com/help/

### Performance
- https://tools.pingdom.com
- https://www.webpagetest.org
- https://pagespeed.web.dev

---

## 📞 Suporte

### Em caso de problemas DNS:

1. **Verificar propagação**: https://dnschecker.org
2. **Limpar cache DNS local**:
   ```bash
   # Windows
   ipconfig /flushdns

   # macOS
   sudo dscacheutil -flushcache

   # Linux
   sudo systemd-resolve --flush-caches
   ```
3. **Aguardar propagação**: Até 48h (geralmente < 4h)
4. **Contatar suporte Vercel**: https://vercel.com/support

---

## ✅ Checklist de Verificação

### Domínio Principal
- [x] rotamestre.tec.br acessível via HTTPS
- [x] www.rotamestre.tec.br redireciona para raiz
- [x] SSL/TLS válido e ativo
- [x] HTTP força redirect para HTTPS

### Subdomínios
- [x] app.rotamestre.tec.br configurado
- [x] painel.rotamestre.tec.br configurado
- [x] docs.rotamestre.tec.br configurado
- [x] api.rotamestre.tec.br configurado
- [x] Todos com SSL/TLS ativo

### Segurança
- [x] HTTPS forçado em todos os domínios
- [x] Certificados SSL válidos
- [x] Headers de segurança configurados (HSTS, etc)
- [ ] CAA records configurados (opcional)
- [ ] DNSSEC habilitado (opcional)

### Email (Futuro)
- [ ] MX records configurados
- [ ] SPF record adicionado
- [ ] DKIM configurado
- [ ] DMARC configurado

---

**Status Geral**: ✅ **OPERACIONAL**

Todos os domínios estão configurados e funcionais. SSL/TLS ativo em todos. Redirects funcionando corretamente.
