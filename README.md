# 🤖 Bot Telegram - Gerenciador de Contas IPTV

Bot Telegram otimizado para rodar no **Render plano free** com webhook (sem polling contínuo).

## ✨ Funcionalidades

- 📋 Listar servidores IPTV com quantidade de contas
- 👀 Ver detalhes completos de cada conta
- ✅ Marcar contas como "em uso" ou "não usada"
- 📋 Copiar dados da conta para clipboard
- 📄 Paginação de contas (10 por página)
- 👤 Registrar usuários no banco de dados
- 🌐 Navegação intuitiva com botões inline
- ⚡ Otimizado para economizar recursos

## 🚀 Setup Rápido

### 1. Clonar e instalar
```bash
git clone seu-repositorio
cd seu-repositorio
npm install
```

### 2. Configurar variáveis
```bash
cp .env.example .env
# Editar .env com seus dados
```

### 3. Deploy no Render
- Conectar repositório no Render
- Adicionar variáveis de ambiente
- Deploy automático

### 4. Ativar webhook
```
https://seu-app.onrender.com/setup-webhook
```

## 📱 Comandos do Bot

| Comando | Descrição |
|---------|-----------|
| `/start` | Inicia o bot |
| `/servidores` | Lista todos os servidores |
| `/ajuda` | Mostra ajuda |

## 🔧 Variáveis de Ambiente

```
TELEGRAM_BOT_TOKEN      # Token do bot (@BotFather)
WEBHOOK_URL            # URL do Render (https://seu-app.onrender.com/webhook)
DB_HOST                # Host MySQL
DB_USER                # Usuário MySQL
DB_PASS                # Senha MySQL
DB_NAME                # Banco de dados
PANEL_API_URL          # URL da API (telegram_api.php)
PORT                   # Porta (padrão 3000)
```

## 📊 Requisitos Mínimos

- Node.js 18+
- MySQL 5.7+
- Telegram Bot Token
- Conta Render (free)

## 🎯 Otimizações para Plano Free

✅ **Webhook** - Mais eficiente que polling
✅ **Pool de conexão limitado** - 2 conexões max
✅ **Timeouts baixos** - Falha rápido em caso de erro
✅ **Edição de mensagens** - Reduz requisições
✅ **Sem background tasks** - Apenas responde eventos

## 📈 Monitoramento

Verificar status:
```
https://seu-app.onrender.com/health
```

## 🔗 Endpoints

| Endpoint | Descrição |
|----------|-----------|
| `POST /webhook` | Recebe eventos do Telegram |
| `GET /health` | Health check |
| `GET /setup-webhook` | Configura webhook |

## 🐛 Troubleshooting

**Bot não responde?**
- Acessar `/setup-webhook` para ativar
- Verificar logs no Render
- Confirmar variáveis de ambiente

**Erro de banco?**
- Testar credenciais MySQL
- Verificar se API está acessível
- Aumentar timeout da API

**Plano free hibernando?**
- Normal (após 15 min inativo)
- Webhook acorda automaticamente
- Sem problemas para uso normal

## 📚 Documentação Completa

Veja [SETUP.md](SETUP.md) para instruções detalhadas.

## 📄 Licença

MIT

## 👨‍💻 Desenvolvido para Render Free

Leve, rápido e eficiente! ⚡
