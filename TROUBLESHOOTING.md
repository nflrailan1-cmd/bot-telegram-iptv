# 🔧 Guia de Troubleshooting - Bot Telegram IPTV

## ❌ Bot não responde aos comandos

### Checklist
1. **Webhook configurado?**
   ```bash
   curl https://seu-app.onrender.com/setup-webhook
   ```
   Deve retornar: `{"ok": true, "message": "Webhook configurado com sucesso"}`

2. **Variáveis de ambiente preenchidas?**
   - No Render Dashboard → Environment
   - Verificar se `TELEGRAM_BOT_TOKEN` está correto
   - Verificar se `WEBHOOK_URL` bate com URL do Render

3. **Bot iniciado?**
   - No Render → Logs
   - Procurar por "🤖 Bot Telegram iniciado na porta 3000"
   - Se não aparecer, há erro no startup

### Solução
```bash
# Refazer webhook (força reconfiguração)
curl "https://seu-app.onrender.com/setup-webhook"

# Testar bot diretamente
# No Telegram: /start
```

---

## 🔗 Erro de conexão com API

### Sintomas
- Mensagem: "❌ Erro ao carregar contas"
- Logs mostram timeouts

### Causas
1. **URL da API incorreta**
   - Verificar `PANEL_API_URL` no Render
   - Testar: `curl "PANEL_API_URL?action=get_servers"`

2. **API não está online**
   - Verificar se PHP está rodando
   - Testar: `curl "https://seu-painel.com/telegram_api.php?action=get_servers"`

3. **Firewall/IP bloqueado**
   - Render usa IPs dinâmicos
   - Considerar remover restrições de IP ou usar whitelist de ranges

### Solução
```bash
# Testar API direto
curl "https://seu-painel.com/telegram_api.php?action=get_servers"

# Deve retornar JSON com servidores
# Exemplo: {"ok": true, "servers": [{"host": "servidor1", "count": 5}]}
```

---

## 🗄️ Erro de banco de dados

### Sintomas
- "❌ Erro ao carregar dados"
- Logs: "Connection timeout"

### Causas
1. **Credenciais incorretas**
   - Verificar `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
   - Testar conexão local: `mysql -h HOST -u USER -p`

2. **MySQL não está acessível remotamente**
   - Host: usar IP ou domínio correto
   - Porta: geralmente 3306 (se não padrão, adicionar `:PORTA` no HOST)

3. **Limite de conexões atingido**
   - Plano free tem limite de 2 conexões
   - Fechar conexões antigas: `SHOW PROCESSLIST;`

### Solução
```bash
# Testar conexão MySQL (local no servidor)
mysql -h seu-host -u seu-usuario -p seu-banco -e "SELECT 1;"

# Verificar se tabelas existem
mysql -h seu-host -u seu-usuario -p seu-banco -e "SHOW TABLES;"

# Deve incluir: m3u_accounts, telegram_users, telegram_actions
```

---

## 📊 Plano Free do Render Hibernando

### O que é?
Após 15 minutos sem requisições, a instância entra em "sleep mode" (hiberna).

### É problema?
❌ **NÃO** para webhook!
- Primeira mensagem ao bot acorda a instância
- Webhook sempre desperta o serviço
- Latência inicial pode ser 5-10s (aceitável)

### Solução (opcional)
```bash
# Ping periódico para manter vivo (em cron do servidor)
# A cada 10 minutos:
*/10 * * * * curl -s "https://seu-app.onrender.com/health" > /dev/null 2>&1
```

---

## 🔑 Erro: "Webhook configure failed"

### Causas
1. **Token inválido ou expirado**
   - Solicitar novo token em @BotFather

2. **URL webhook inválida**
   - Verificar se `WEBHOOK_URL` é HTTPS
   - Verificar se domínio existe
   - Render fornece HTTPS automaticamente

3. **Firewall do Telegram bloqueando**
   - Raro, mas Telegram testa conectividade

### Solução
```bash
# 1. Deletar webhook antigo
curl "https://api.telegram.org/botSEU_TOKEN/deleteWebhook"

# 2. Configurar novo
curl "https://api.telegram.org/botSEU_TOKEN/setWebhook?url=https://seu-app.onrender.com/webhook"

# 3. Verificar status
curl "https://api.telegram.org/botSEU_TOKEN/getWebhookInfo"
```

---

## ⏱️ Timeout de Requisições

### Sintomas
- Botão fica "travado"
- Após alguns segundos: erro

### Causas
1. **API lenta**
   - Base de dados indexada?
   - Muitos servidores (>1000)?

2. **Conexão flaky**
   - Render ↔ Painel instável
   - Render ↔ MySQL instável

### Solução
```js
// No código (já configurado com 5s):
const timeout: 5000 // aumentar para 10000 se necessário

// Otimizar no painel:
// - Adicionar índices no banco
// - Cache de servidores (Redis)
// - CDN para API
```

---

## 🚫 Erro: "Message not modified"

### O que significa?
Tentou editar mensagem com o mesmo conteúdo.

### Quando acontece?
- Clica em botão de paginação (página atual)
- Clica em botão duas vezes rápido

### É problema?
✅ **Não**, Telegram rejeita internamente (silencioso).

---

## 📱 Bot mostra informações erradas

### Verificar
1. **API retorna dados corretos?**
   ```bash
   curl "PANEL_API_URL?action=format_account&id=1"
   ```

2. **Banco de dados foi atualizado?**
   - Contas podem ser cacheadas
   - Tentar atualizar dados: `/servidores`

3. **Fuso horário correto?**
   - Verificar `date_default_timezone_set('America/Sao_Paulo');`
   - Bot também usa fuso

### Solução
```bash
# No painel, verificar dados:
mysql -h host -u user -p banco -e "SELECT * FROM m3u_accounts LIMIT 1\G"

# Comparar com o que o bot mostra
```

---

## 💾 Limite de Memória Atingido

### Sintomas
- Render mata o processo
- Logs: "Out of memory"

### Causas
1. **Muitas conexões abertas**
   - Pool de conexão configurado para 2 (mínimo)
   - Está ok

2. **Muita paginação aberta**
   - Cada usuário causa 1-2 conexões
   - Suporta ~40 usuários simultâneos (limite Render free)

### Solução
```js
// Já otimizado no código:
connectionLimit: 2,  // Máximo 2 conexões
```

Se ainda tiver problemas:
- Considerar plano pago do Render
- Ou usar service externo (ex: Railway, Vercel)

---

## 🔒 Segurança: Token vaza/foi capturado

### Ação imediata
1. **Deletar webhook atual:**
   ```bash
   curl "https://api.telegram.org/botTOKEN_VELHO/deleteWebhook"
   ```

2. **Solicitar novo token em @BotFather**
   - /mybots → seu bot → /token

3. **Atualizar no Render:**
   - Dashboard → Environment → `TELEGRAM_BOT_TOKEN`

4. **Reconfigurar webhook:**
   ```
   https://seu-app.onrender.com/setup-webhook
   ```

---

## 📈 Performance: Muitos usuários (>100)

### Otimizações
1. **Cache de servidores:**
   ```js
   // Fazer cache por 1 minuto
   const cache = new Map();
   
   async function getServersWithCache() {
       if (cache.has('servers')) {
           return cache.get('servers');
       }
       const servers = await getServers();
       cache.set('servers', servers);
       setTimeout(() => cache.delete('servers'), 60000);
       return servers;
   }
   ```

2. **Aumentar pool de conexão** (com upgrade de plano):
   ```js
   connectionLimit: 5
   ```

3. **Adicionar índices no banco:**
   ```sql
   CREATE INDEX idx_host ON m3u_accounts(host);
   CREATE INDEX idx_in_use ON m3u_accounts(in_use);
   ```

---

## 🐛 Reportar Bug/Problema

Quando pedir ajuda, fornecer:
1. **Erro exato** (print de tela)
2. **Logs do Render** (copiar últimas 50 linhas)
3. **Variáveis de ambiente** (sem valores sensíveis)
4. **Ações antes do erro** (step-by-step)
5. **Testar:**
   ```bash
   curl -v "https://seu-app.onrender.com/health"
   curl -v "PANEL_API_URL?action=get_servers"
   ```

---

## ✅ Checklist de Diagnóstico Rápido

- [ ] Webhook configurado: `https://seu-app.onrender.com/setup-webhook`
- [ ] Status OK: `https://seu-app.onrender.com/health`
- [ ] API online: `PANEL_API_URL?action=get_servers`
- [ ] Token Telegram válido
- [ ] Variáveis de ambiente preenchidas
- [ ] MySQL conectando
- [ ] Instância Render ativa (verde)
- [ ] Logs não mostram erros

Se tudo OK mas ainda há problema → verificar logs em tempo real no Render.

---

**Dúvida? Verificar SETUP.md ou testar endpoints isoladamente!**
