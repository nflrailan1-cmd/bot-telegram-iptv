# 🤖 Bot Telegram IPTV - Guia Completo de Setup

## 📋 Pré-requisitos

- Bot criado no Telegram (@BotFather)
- Token do bot Telegram
- Conta no Render.com (plano free)
- Acesso ao banco de dados MySQL
- URL da sua API (telegram_api.php)

---

## 🚀 Passo 1: Preparar o Repositório

### 1.1 Criar repositório Git
```bash
git init
git add .
git commit -m "Initial commit"
```

### 1.2 Criar repositório no GitHub/GitLab
- Fazer push do código
- O Render vai puxar automaticamente

---

## 🔧 Passo 2: Configurar no Render.com

### 2.1 Criar novo serviço
1. Acesse render.com e faça login
2. Clique em "New" → "Web Service"
3. Conecte seu repositório GitHub/GitLab
4. Configure:
   - **Name**: `telegram-iptv-bot`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node telegram_bot.js`
   - **Plan**: Free (suficiente para webhook)

### 2.2 Adicionar variáveis de ambiente
No painel do Render:
1. Vá para "Environment"
2. Adicione as seguintes variáveis:

```
TELEGRAM_BOT_TOKEN = seu_token_do_bot
WEBHOOK_URL = https://seu-app.onrender.com/webhook
DB_HOST = seu_host_mysql
DB_USER = seu_usuario_mysql
DB_PASS = sua_senha_mysql
DB_NAME = seu_banco_mysql
PANEL_API_URL = https://seu-painel.com/telegram_api.php
PORT = 3000
```

### 2.3 Deploy
- Clique em "Deploy"
- Aguarde 5-10 minutos
- Verifique se o serviço está rodando (verde)

---

## ✅ Passo 3: Configurar Webhook do Telegram

### 3.1 Acessar endpoint de setup
Após o deploy no Render, acesse:
```
https://seu-app.onrender.com/setup-webhook
```

Você deve receber uma resposta JSON:
```json
{
  "ok": true,
  "message": "Webhook configurado com sucesso"
}
```

### 3.2 Verificar webhook
Acesse:
```
https://seu-app.onrender.com/health
```

Deve retornar status OK.

---

## 📱 Passo 4: Testar o Bot

1. Procure seu bot no Telegram
2. Clique em `/start`
3. Teste os comandos:
   - `/servidores` - Lista servidores
   - `/ajuda` - Mostra ajuda
   - Clique nos botões para navegar

---

## 🛠️ Solução de Problemas

### Bot não responde
- Verificar se webhook está ativo: `https://seu-app.onrender.com/setup-webhook`
- Verificar variáveis de ambiente no Render
- Verificar logs no Render ("Logs")

### Erro de banco de dados
- Confirmar se credenciais MySQL estão corretas
- Testar conexão diretamente
- Verificar se a API está acessível

### Timeout de requisição
- Aumentar timeouts no código (já é 5s)
- Verificar velocidade da API
- Considerar cache de servidores

### Plano free do Render
- ⚠️ Instância hibernará após 15 min de inatividade
- ✅ Webhook acorda a instância automaticamente
- ✅ Suficiente para bots com uso moderado

---

## 📊 Monitoramento

### Verificar uso de memória
1. No Render, vá para "Metrics"
2. Monitore CPU e memória
3. Plano free tem limite de 0.5GB RAM

### Logs
No Render: Logs → Veja eventos do bot

---

## 🔒 Segurança

### Variáveis sensíveis
- ✅ Usar arquivo `.env` localmente
- ✅ Configurar no Render (não no git)
- ❌ Nunca committar `.env` com dados reais

### Proteção da API
- Considerar adicionar IP whitelist
- Usar HTTPS (Render fornece automaticamente)
- Validar requisições do webhook

---

## 📈 Otimizações para Plano Free

1. **Pool de conexão limitado (2 conexões)**
   - Reduz uso de memória
   - Suficiente para webhook

2. **Timeouts baixos (5s)**
   - Evita travamentos
   - Falha rápido em caso de erro

3. **Sem polling contínuo**
   - Webhook é mais eficiente
   - Não consome recursos em background

4. **Respostas editas**
   - Edita mensagens em vez de enviar novas
   - Reduz requisições de API

---

## 🔄 Atualizações

Para fazer deploy de novas versões:

```bash
git add .
git commit -m "Sua mensagem"
git push
```

Render fará deploy automaticamente.

---

## 📞 Suporte

Se encontrar problemas:
1. Verificar status do webhook
2. Verificar logs no Render
3. Testar API manualmente: `curl API_URL?action=get_servers`
4. Confirmar banco de dados está online

---

## ✨ Funcionalidades Incluídas

✅ Listar servidores com quantidade de contas
✅ Ver todas as contas de um servidor (paginadas)
✅ Visualizar detalhes completos da conta
✅ Marcar conta como "em uso" ou "não usada"
✅ Copiar dados da conta
✅ Registrar usuários que usam o bot
✅ Navegação intuitiva com botões inline
✅ Otimizado para Render plano free
✅ Webhook (sem polling contínuo)
✅ Health check

---

**Bot criado com ❤️ para ser rápido e leve no Render free!**
