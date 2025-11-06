# Configurar Email com Servidor SMTP Próprio (VPS)

## Vantagens do Servidor Próprio
✅ **Controle total** sobre envio de emails
✅ **Sem limites** de emails/dia
✅ **Sem custos adicionais** de terceiros
✅ **Maior privacidade** dos dados
✅ **Personalização completa**

---

## Pré-requisitos

### Informações Necessárias do Servidor VPS:
```
- IP do servidor VPS
- Domínio configurado (rotamestre.tec.br)
- Servidor SMTP rodando (Postfix, Exim, etc.)
- Porta SMTP (geralmente 587 ou 465)
- Credenciais de autenticação
```

---

## Passo 1: Verificar Configuração do Servidor SMTP

### 1.1. Conectar na VPS via SSH
```bash
ssh usuario@seu-servidor-vps.com
# ou
ssh root@IP_DA_VPS
```

### 1.2. Verificar se SMTP está rodando
```bash
# Para Postfix
systemctl status postfix

# Para Exim
systemctl status exim4

# Verificar portas abertas
netstat -tulpn | grep -E ':(25|587|465)'
```

**Saída esperada:**
```
tcp  0  0.0.0.0:25     0.0.0.0:*  LISTEN  12345/master
tcp  0  0.0.0.0:587    0.0.0.0:*  LISTEN  12345/master
```

### 1.3. Testar envio de email
```bash
# Instalar mailutils se necessário
apt-get install mailutils -y

# Testar envio
echo "Teste de email" | mail -s "Assunto Teste" seu@email.com
```

---

## Passo 2: Criar Conta de Email no Servidor

### Opção A: Postfix (Mais Comum)

#### 2.1. Criar usuário virtual
```bash
# Editar arquivo de usuários virtuais
nano /etc/postfix/virtual_users

# Adicionar linha:
no-reply@rotamestre.tec.br    rotamestre_noreply
```

#### 2.2. Criar senha
```bash
# Gerar senha hash
echo "SUA_SENHA_SEGURA" | openssl passwd -1 -stdin

# Adicionar ao arquivo de senhas
nano /etc/postfix/virtual_passwords

# Adicionar linha:
no-reply@rotamestre.tec.br:{HASH_GERADO}
```

#### 2.3. Atualizar banco de dados
```bash
postmap /etc/postfix/virtual_users
postmap /etc/postfix/virtual_passwords
systemctl reload postfix
```

### Opção B: cPanel/WHM

1. Login no cPanel
2. Email Accounts → Create Email Account
3. Email: `no-reply@rotamestre.tec.br`
4. Password: (senha segura)
5. Create Account

### Opção C: Plesk

1. Mail → Email Addresses
2. Create Email Address
3. Email: `no-reply@rotamestre.tec.br`
4. Password: (senha segura)
5. OK

---

## Passo 3: Configurar DKIM, SPF e DMARC

### 3.1. SPF (Sender Policy Framework)

**Adicionar registro TXT no DNS:**
```
Tipo: TXT
Nome: @
Valor: v=spf1 ip4:SEU_IP_VPS a mx ~all
TTL: 3600
```

**Exemplo:**
```
v=spf1 ip4:203.0.113.50 a mx ~all
```

### 3.2. DKIM (DomainKeys Identified Mail)

#### Gerar chaves DKIM no servidor:
```bash
# Instalar opendkim
apt-get install opendkim opendkim-tools -y

# Gerar chaves
opendkim-genkey -s mail -d rotamestre.tec.br

# Ver chave pública
cat mail.txt
```

**Adicionar registro TXT no DNS:**
```
Tipo: TXT
Nome: mail._domainkey
Valor: (conteúdo do arquivo mail.txt)
TTL: 3600
```

### 3.3. DMARC (Domain-based Message Authentication)

**Adicionar registro TXT no DNS:**
```
Tipo: TXT
Nome: _dmarc
Valor: v=DMARC1; p=quarantine; rua=mailto:dmarc@rotamestre.tec.br
TTL: 3600
```

### 3.4. Registro MX (Mail Exchange)

**Verificar/Adicionar registro MX:**
```
Tipo: MX
Nome: @
Valor: mail.rotamestre.tec.br
Prioridade: 10
TTL: 3600
```

---

## Passo 4: Configurar Supabase

### 4.1. Acessar Painel Supabase
```
1. https://app.supabase.com
2. Selecione seu projeto
3. Authentication → SMTP Settings
```

### 4.2. Preencher Configurações SMTP

#### Para Porta 587 (TLS/STARTTLS - Recomendado):
```
Enable Custom SMTP: ✅ ON

SMTP Host:     mail.rotamestre.tec.br (ou IP da VPS)
SMTP Port:     587
SMTP Username: no-reply@rotamestre.tec.br
SMTP Password: (senha criada no Passo 2)
Sender Email:  no-reply@rotamestre.tec.br
Sender Name:   Rota Mestre
```

#### Para Porta 465 (SSL):
```
Enable Custom SMTP: ✅ ON

SMTP Host:     mail.rotamestre.tec.br
SMTP Port:     465
SMTP Username: no-reply@rotamestre.tec.br
SMTP Password: (senha criada no Passo 2)
Sender Email:  no-reply@rotamestre.tec.br
Sender Name:   Rota Mestre
```

#### Para Porta 25 (Não Recomendado - Sem Criptografia):
```
⚠️ Não recomendado para produção!
Use apenas se necessário e em rede segura.

SMTP Port: 25
```

### 4.3. Salvar Configurações
```
Clique em "Save"
```

---

## Passo 5: Configurar Templates de Email

### No Supabase:
```
Authentication → Email Templates
```

**Use os templates do arquivo:** `docs/email-templates.html`

1. **Reset Password** → Template 1
2. **Confirm Signup** → Template 2
3. **Magic Link** → Template 3

---

## Passo 6: Testar Configuração

### 6.1. Teste via Aplicação
```
1. Abra: http://localhost:8083/auth/forgot-password
2. Digite email válido
3. Clique em "Enviar"
```

### 6.2. Verificar Logs do Servidor

**No servidor VPS:**
```bash
# Para Postfix
tail -f /var/log/mail.log

# Para Exim
tail -f /var/log/exim4/mainlog
```

**Procure por:**
```
✅ status=sent (250 OK)
❌ status=deferred (erro temporário)
❌ status=bounced (erro permanente)
```

### 6.3. Verificar Email
```
1. Cheque caixa de entrada
2. Verifique spam/lixo eletrônico
3. Confira headers do email
```

---

## Troubleshooting

### Email não chega

#### 1. Verificar conectividade SMTP
```bash
# Teste de porta 587
telnet mail.rotamestre.tec.br 587

# Teste de porta 465
telnet mail.rotamestre.tec.br 465

# Ou use nc (netcat)
nc -zv mail.rotamestre.tec.br 587
```

**Saída esperada:**
```
Connected to mail.rotamestre.tec.br
220 mail.rotamestre.tec.br ESMTP
```

#### 2. Verificar credenciais
```bash
# No servidor VPS, teste autenticação
swaks --to teste@gmail.com \
      --from no-reply@rotamestre.tec.br \
      --server mail.rotamestre.tec.br:587 \
      --auth LOGIN \
      --auth-user no-reply@rotamestre.tec.br \
      --auth-password "SUA_SENHA" \
      --tls
```

#### 3. Verificar DNS
```bash
# Verificar registro MX
nslookup -type=mx rotamestre.tec.br

# Verificar SPF
nslookup -type=txt rotamestre.tec.br

# Verificar DKIM
nslookup -type=txt mail._domainkey.rotamestre.tec.br
```

### Emails vão para spam

#### 1. Configurar Reverse DNS (PTR)
```bash
# Verificar PTR atual
dig -x SEU_IP_VPS

# Solicitar ao provedor VPS para configurar:
PTR: SEU_IP_VPS → mail.rotamestre.tec.br
```

#### 2. Testar reputação do servidor
```
- https://mxtoolbox.com/SuperTool.aspx
- https://www.mail-tester.com
- https://multirbl.valli.org
```

#### 3. Verificar blacklists
```bash
# Verificar se IP está em blacklist
curl -s http://multirbl.valli.org/lookup/SEU_IP_VPS.html
```

### Erro "Connection refused"

```bash
# Verificar firewall
ufw status
iptables -L -n

# Liberar portas
ufw allow 587/tcp
ufw allow 465/tcp

# Para iptables
iptables -A INPUT -p tcp --dport 587 -j ACCEPT
iptables -A INPUT -p tcp --dport 465 -j ACCEPT
iptables-save
```

### Erro "Authentication failed"

```bash
# Verificar se senha está correta
# Recriar usuário/senha

# Para Postfix, verificar logs
grep "authentication failed" /var/log/mail.log

# Testar manualmente
telnet mail.rotamestre.tec.br 587
EHLO teste
AUTH LOGIN
(base64 do username)
(base64 do password)
```

---

## Configuração Avançada

### 1. Rate Limiting (Prevenir Spam)

**No Postfix:**
```bash
nano /etc/postfix/main.cf

# Adicionar:
smtpd_client_connection_rate_limit = 10
smtpd_client_message_rate_limit = 20
smtpd_client_recipient_rate_limit = 50
```

### 2. Autenticação SASL

```bash
# Habilitar SASL
nano /etc/postfix/main.cf

# Adicionar:
smtpd_sasl_auth_enable = yes
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
```

### 3. TLS/SSL Forte

```bash
nano /etc/postfix/main.cf

# Configurar TLS
smtpd_tls_security_level = may
smtpd_tls_cert_file = /etc/ssl/certs/rotamestre.crt
smtpd_tls_key_file = /etc/ssl/private/rotamestre.key
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_ciphers = high
```

### 4. Monitoramento de Logs

```bash
# Instalar logwatch
apt-get install logwatch -y

# Configurar relatório diário
logwatch --detail high --mailto admin@rotamestre.tec.br --service postfix
```

### 5. Backup de Configurações

```bash
# Criar backup
tar -czf smtp-backup-$(date +%Y%m%d).tar.gz \
    /etc/postfix \
    /etc/dovecot \
    /etc/opendkim

# Restaurar backup
tar -xzf smtp-backup-20250106.tar.gz -C /
systemctl restart postfix dovecot opendkim
```

---

## Checklist Final

```
[✓] Servidor SMTP rodando na VPS
[✓] Porta 587/465 aberta no firewall
[✓] Conta no-reply@rotamestre.tec.br criada
[✓] DNS configurado (SPF, DKIM, DMARC, MX)
[✓] Reverse DNS (PTR) configurado
[✓] TLS/SSL configurado
[✓] SMTP configurado no Supabase
[✓] Templates de email customizados
[✓] Teste de envio realizado
[✓] Email recebido com sucesso
[✓] Não está em blacklist
[✓] Score de reputação > 8/10
```

---

## Informações do Servidor para Supabase

### Resumo das Configurações:

```yaml
# Copie e preencha com suas informações:

SMTP Host: _________________________
           (ex: mail.rotamestre.tec.br ou IP da VPS)

SMTP Port: _________________________
           (587 para TLS, 465 para SSL)

SMTP Username: no-reply@rotamestre.tec.br

SMTP Password: _________________________
               (senha criada no servidor)

Sender Email: no-reply@rotamestre.tec.br

Sender Name: Rota Mestre
```

---

## Recursos Úteis

- **Postfix Docs**: http://www.postfix.org/documentation.html
- **DKIM Generator**: https://dkimcore.org/tools/
- **SPF Check**: https://www.spfwizard.net
- **Email Tester**: https://www.mail-tester.com
- **MX Toolbox**: https://mxtoolbox.com
- **Blacklist Check**: https://multirbl.valli.org

---

## Próximos Passos

1. ✅ Configurar monitoramento de logs
2. ✅ Implementar rate limiting
3. ✅ Configurar backup automático
4. ✅ Testar recuperação de desastres
5. ✅ Documentar procedimentos operacionais

---

## Vantagens vs Resend/SendGrid

| Recurso | Servidor Próprio | Resend/SendGrid |
|---------|------------------|-----------------|
| Custo mensal | R$ 0 (já tem VPS) | R$ 0-100+ |
| Emails/dia | Ilimitado* | 100-50.000 |
| Controle total | ✅ Sim | ❌ Limitado |
| Privacidade | ✅ Total | ⚠️ Terceiros |
| Manutenção | ⚠️ Você gerencia | ✅ Gerenciado |
| Reputação | 🔄 Construir | ✅ Estabelecida |
| Setup | ⏱️ Médio | ⚡ Rápido |
| Analytics | 🔧 DIY | ✅ Incluído |

*Ilimitado dentro da capacidade do servidor

---

## 🎉 Pronto!

Seu servidor SMTP próprio está configurado para enviar emails profissionais via Supabase!

Benefícios:
- ✅ Controle total
- ✅ Sem custos extras
- ✅ Privacidade garantida
- ✅ Emails ilimitados
