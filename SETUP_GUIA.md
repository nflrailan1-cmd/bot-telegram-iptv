# 🤖 Bot Telegram IPTV - Guia Completo

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Setup Local](#setup-local)
3. [Deployment Gratuito](#deployment-gratuito)
4. [Configuração de Admin](#configuração-de-admin)
5. [API Endpoints](#api-endpoints)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Pré-requisitos

- **Node.js** 14+ instalado
- **Bot Token do Telegram** (criar em @BotFather)
- **URL do seu Painel** (onde está a API)
- **IDs de Admin** (para funções administrativas)

---

## 🏠 Setup Local

### 1. Clonar/Preparar Arquivos

```bash
# Criar pasta do projeto
mkdir bot-telegram && cd bot-telegram

# Copiar os arquivos:
# - bot_telegram_v2.js
# - package.json (abaixo)
# - .env (criar)
```

### 2. Criar `package.json`

```json
{
  "name": "bot-telegram-iptv",
  "version": "2.0.0",
  "description": "Bot Telegram para gerenciamento IPTV",
  "main": "bot_telegram_v2.js",
  "scripts": {
    "start": "node bot_telegram_v2.js",
    "dev": "nodemon bot_telegram_v2.js"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.61.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 3. Criar `.env`

```env
# Obrigatório
TELEGRAM_BOT_TOKEN=SEU_TOKEN_AQUI
API_URL=https://seu-painel.com/telegram_api.php

# Admins (IDs separados por vírgula)
ADMIN_IDS=123456789,987654321

# Opcional (se usar webhook)
WEBHOOK_URL=https://seu-servidor.com
PORT=3000
```

### 4. Instalar Dependências

```bash
npm install
```

### 5. Testar Localmente

```bash
npm start
```

Você verá:
```
✅ Bot iniciado com sucesso!
🔗 Modo: Polling
📡 API URL: https://seu-painel.com/telegram_api.php
👮 Admins configurados: 123456789, 987654321
```

---

## 🚀 Deployment Gratuito

### ⭐ Opção 1: Railway.app (Recomendado - Mais Fácil)

#### Vantagens:
- ✅ Gratuito por 500 horas/mês
- ✅ Webhook automático
- ✅ Environment variables via UI
- ✅ Logs em tempo real
- ✅ Sem cartão de crédito

#### Passos:

1. **Criar conta em railway.app**
   - Ir para https://railway.app
   - Sign up com GitHub

2. **Conectar repositório GitHub**
   - Fazer fork: https://github.com/seu-usuario/seu-repo
   - Copiar os arquivos do bot para o repo
   - Criar arquivo `Procfile`:
   ```
   worker: node bot_telegram_v2.js
   ```

3. **Criar novo projeto no Railway**
   - New Project → GitHub Repo
   - Selecionar o repositório
   - Railway faz deploy automático

4. **Configurar variáveis de ambiente**
   - Variables → Add Variable
   - `TELEGRAM_BOT_TOKEN` = seu token
   - `API_URL` = https://seu-painel.com/telegram_api.php
   - `ADMIN_IDS` = seus IDs
   - `WEBHOOK_URL` = https://seu-projeto.railway.app

5. **Deploy automático**
   - Cada push ao GitHub dispara novo deploy

---

### ⭐ Opção 2: Heroku (Alternativa)

#### ⚠️ Nota: Heroku removeu plano free em 2022, mas ainda há alternativas

Use **Render.com** como alternativa similar:

1. **Criar conta em render.com**
   - https://render.com

2. **Criar serviço Web**
   - New Web Service
   - Conectar GitHub
   - Environment: Node
   - Build: `npm install`
   - Start: `npm start`

3. **Variáveis de Ambiente**
   - Environment → Add Environment Variable
   - Mesmas do Railway

4. **Domínio gratuito**
   - Render fornece URL gratuita
   - Use na `WEBHOOK_URL`

---

### ⭐ Opção 3: Google Cloud Run (Mais Robusto)

#### Vantagens:
- ✅ 2 milhões de requisições/mês grátis
- ✅ Escalável automaticamente
- ✅ Suporta webhooks nativamente

#### Passos (via gcloud CLI):

```bash
# 1. Instalar Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# 2. Autenticar
gcloud auth login

# 3. Criar Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "bot_telegram_v2.js"]
EOF

# 4. Deploy
gcloud run deploy bot-telegram \
  --source . \
  --platform managed \
  --region us-central1 \
  --memory 256Mi \
  --set-env-vars TELEGRAM_BOT_TOKEN=SEU_TOKEN,API_URL=https://seu-painel.com/telegram_api.php,ADMIN_IDS=123456789

# 5. Pegar URL e usar como WEBHOOK_URL
```

---

### ⭐ Opção 4: VPS Próprio ou Shared Hosting

Se você tiver acesso SSH:

```bash
# 1. No servidor SSH
cd /home/usuario/bot

# 2. Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instalar dependências
npm install

# 4. Usar PM2 para manter rodando
npm install -g pm2

# 5. Iniciar com PM2
pm2 start bot_telegram_v2.js --name "bot-iptv"
pm2 startup
pm2 save

# 6. Verificar logs
pm2 logs bot-iptv
```

---

## ⚙️ Configuração de Admin

### Obter seu ID do Telegram

1. Envie `/start` no bot
2. Veja seu ID no console:
   ```
   User ID: 123456789
   ```

Ou use @userinfobot no Telegram para descobrir.

### Ativar Modo Admin

Adicione à variável `ADMIN_IDS`:
```env
ADMIN_IDS=123456789,987654321,555555555
```

### Funcionalidades Admin

- 📋 `/admin` - Painel administrativo
- ➕ `/adicionar` - Adicionar servidor manual
- 📥 `/importar` - Importar de arquivo .txt
- 🗑️ Menu Admin - Deletar servidores
- ⚙️ Gerenciar tudo sem acessar painel web

---

## 📡 API Endpoints

### GET `/telegram_api.php?action=get_servers`

Lista todos os servidores com contagem de contas.

**Resposta:**
```json
{
  "ok": true,
  "servers": [
    {
      "id": "1",
      "host": "servidor1.com",
      "count": "15"
    }
  ]
}
```

---

### GET `/telegram_api.php?action=get_accounts`

Obtém contas de um servidor com paginação.

**Parâmetros:**
- `host` (obrigatório) - Nome do servidor
- `page` (opcional) - Número da página (padrão: 1)

**Resposta:**
```json
{
  "ok": true,
  "contas": [
    {
      "id": "123",
      "username": "user1",
      "password": "pass123",
      "host": "servidor1.com",
      "data_criada": "01/01/2024",
      "expira": "01/07/2024",
      "dias_restantes": "180",
      "con_ativas": "2",
      "max_con": "4"
    }
  ],
  "page": 1,
  "pages": 5,
  "total": 45
}
```

---

### GET `/telegram_api.php?action=format_account`

Detalhes completos de uma conta.

**Parâmetros:**
- `id` (obrigatório) - ID da conta

**Resposta:**
```json
{
  "ok": true,
  "mensagem": "...",
  "conta": { ... }
}
```

---

### POST `/telegram_api.php?action=add_server`

Adicionar novo servidor.

**JSON Body:**
```json
{
  "name": "novo-servidor",
  "url": "http://servidor.com"
}
```

**Resposta:**
```json
{
  "ok": true,
  "id": "42",
  "msg": "Servidor adicionado"
}
```

---

### GET `/telegram_api.php?action=delete_server`

Deletar servidor.

**Parâmetros:**
- `id` (obrigatório) - ID do servidor

**Resposta:**
```json
{
  "ok": true,
  "msg": "Servidor deletado"
}
```

---

## 🐛 Troubleshooting

### Bot não responde

**Solução:**
```bash
# 1. Verificar token
echo "Token correto? Verificar em .env"

# 2. Verificar logs
pm2 logs bot-iptv
# ou Railway/Render dashboard

# 3. Testar token
curl https://api.telegram.org/botSEU_TOKEN/getMe
```

### API retorna erro 404

**Solução:**
```bash
# 1. Verificar URL da API
echo "API_URL correto em .env?"

# 2. Testar endpoint
curl "https://seu-painel.com/telegram_api.php?action=get_servers"

# 3. Verificar arquivo telegram_api.php está em servidor
```

### Modo Webhook não conecta

**Solução:**
```bash
# 1. URL deve ser HTTPS
# 2. Porta deve ser 443 ou 8443
# 3. Testar endpoint:
curl https://seu-webhook-url/botSEU_TOKEN -X POST

# 4. Se erro, reverter para polling (remover WEBHOOK_URL do .env)
```

### Variáveis de ambiente não carregam

**Solução:**
```bash
# 1. Reiniciar aplicação
pm2 restart bot-iptv

# 2. Verificar que .env está gitignore (não fazer commit)
echo ".env" >> .gitignore

# 3. No Railway/Render, variáveis devem estar no painel, não em .env
```

### Limite de requisições

Se receber erro `429 Too Many Requests`:
```bash
# Bot usa polling por padrão (mais seguro)
# Se quiser webhook, Railway/Render auto-configura
# Não fazer múltiplos bots com mesmo token
```

---

## 📚 Estrutura de Pastas (Final)

```
bot-telegram/
├── bot_telegram_v2.js      # Bot principal
├── telegram_api.php         # API backend
├── package.json             # Dependências Node
├── .env                     # Variáveis (git ignore)
├── Procfile                 # Para Railway
├── Dockerfile               # Para Cloud Run
└── README.md                # Documentação
```

---

## ✅ Checklist de Deploy

- [ ] Token do bot criado em @BotFather
- [ ] Variáveis de ambiente configuradas
- [ ] telegram_api.php no servidor web
- [ ] URL da API testada manualmente
- [ ] Plataforma de hosting escolhida (Railway/Render/Google Cloud)
- [ ] Repositório GitHub criado com bot
- [ ] Deploy realizado
- [ ] Bot testando `/start`
- [ ] Admin IDs configurados
- [ ] Testes com `/admin`, `/adicionar`, `/importar`

---

## 🎯 Próximos Passos

1. **Melhorias Futuras:**
   - Autenticação por PIN no bot
   - Notificações de expiração de contas
   - Busca avançada de contas
   - Estatísticas por usuário

2. **Segurança:**
   - Rate limiting por usuário
   - Logs de ações admin
   - Backups automáticos

3. **Performance:**
   - Cache de servidores
   - Compressão de mensagens
   - Database índices

---

**Precisa de ajuda?** Teste localmente antes de fazer deploy!

```bash
npm install
npm start
```

Sucesso! 🚀
