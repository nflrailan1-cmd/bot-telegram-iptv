# 🤖 Bot Telegram IPTV v2.0

Bot Telegram completo para gerenciamento de servidores IPTV com menu operacional, suporte a admin e deployment gratuito.

## ✨ Funcionalidades

### 👥 Para Todos os Usuários
- 📋 Ver lista de servidores com contagem de contas
- 🔍 Buscar contas por servidor
- 📊 Visualizar detalhes completos das contas
- 📄 Paginação de contas (10 por página)
- 🎛️ Menu operacional intuitivo
- 📚 Sistema de ajuda integrado

### ⚙️ Funções Admin
- ➕ Adicionar novo servidor (manual)
- 📥 Importar múltiplos servidores via arquivo .txt
- 🗑️ Deletar servidores com confirmação
- 👮 Controle de acesso por ID de usuário
- 📋 Listar todos os servidores
- 🔧 Painel administrativo completo

## 🚀 Quick Start

### Instalação Local

```bash
# 1. Clonar repositório
git clone seu-repo
cd bot-telegram

# 2. Instalar dependências
npm install

# 3. Configurar .env
cp .env.example .env
# Editar .env com seu token e configurações

# 4. Executar
npm start
```

### Deploy Gratuito

#### Railway.app (Recomendado)
```bash
# 1. Fazer push para GitHub
git push origin main

# 2. Conectar GitHub no Railway
# 3. Deploy automático
# 4. Configurar variáveis de ambiente no Railway Dashboard
```

Ver [SETUP_GUIA.md](./SETUP_GUIA.md) para instruções completas.

## 📋 Variáveis de Ambiente

```env
# Obrigatório
TELEGRAM_BOT_TOKEN=seu_token
API_URL=https://seu-painel.com/telegram_api.php
ADMIN_IDS=123456789,987654321

# Opcional
WEBHOOK_URL=https://seu-projeto.railway.app
PORT=3000
```

## 🔌 Estrutura de Arquivos

```
bot-telegram/
├── bot_telegram_v2.js       # Bot principal com todos os comandos
├── telegram_api.php          # API backend (integra com seu painel)
├── package.json              # Dependências Node.js
├── Procfile                  # Para Railway/Heroku
├── Dockerfile                # Para Google Cloud Run
├── .env.example              # Template de configuração
├── .gitignore                # Arquivos a ignorar
├── SETUP_GUIA.md             # Guia detalhado de setup
├── README.md                 # Este arquivo
└── exemplo_importacao.txt    # Exemplo de arquivo para importação
```

## 📡 Comandos do Bot

### Públicos
- `/start` - Menu inicial
- `/menu` - Menu operacional
- `/servidores` - Ver lista de servidores
- `/ajuda` - Ajuda e informações

### Admin
- `/admin` - Painel administrativo
- `/adicionar` - Adicionar servidor (manual)
- `/importar` - Importar servidores (arquivo)

## 📥 Importação de Servidores

Envie arquivo `.txt` no formato:

```
Nome Servidor 1|http://url1.com
Nome Servidor 2|http://url2.com
Servidor 3|https://url3.com.br
```

O bot importa automaticamente cada linha.

## 🔒 Segurança

- ✅ Variáveis de ambiente para credentials
- ✅ Validação de admin por ID
- ✅ Confirmação antes de deletar
- ✅ Proteção contra SQL Injection (PDO prepared)
- ✅ HTTPS obrigatório em produção
- ✅ Rate limiting automático do Telegram

## 📊 API Endpoints

| Ação | Método | Endpoint |
|------|--------|----------|
| Listar servidores | GET | `?action=get_servers` |
| Contas por servidor | GET | `?action=get_accounts&host=X&page=1` |
| Detalhes de conta | GET | `?action=format_account&id=X` |
| Adicionar servidor | POST | `?action=add_server` |
| Deletar servidor | GET | `?action=delete_server&id=X` |
| Registrar usuário | POST | `?action=register_user` |

## 🐛 Troubleshooting

### Bot não responde
- Verificar token em `.env`
- Verificar logs (`npm start`)
- Testar em https://api.telegram.org/botTOKEN/getMe

### API retorna 404
- Confirmar URL em `API_URL`
- Testar endpoint manualmente
- Verificar arquivo `telegram_api.php` no servidor

### Variáveis não carregam
- Usar Dashboard da plataforma (Railway/Render)
- Não fazer commit do `.env`
- Reiniciar aplicação após mudanças

## 📚 Documentação Completa

Veja [SETUP_GUIA.md](./SETUP_GUIA.md) para:
- Setup detalhado local
- 4 opções de deployment gratuito
- Configuração de webhooks
- Troubleshooting completo
- Exemplos de API

## 🌐 Plataformas de Hosting Gratuito

| Plataforma | Limite | URL | Setup |
|-----------|--------|-----|-------|
| **Railway** | 500h/mês | railway.app | ⭐⭐⭐ Recomendado |
| Render | 750h/mês | render.com | ⭐⭐⭐ Bom |
| Google Cloud Run | 2M req/mês | cloud.google.com | ⭐⭐ Avançado |
| VPS/SSH próprio | Ilimitado | seu-servidor | ⭐⭐⭐ Profissional |

## 🔐 Obtendo seu ID Telegram

1. Enviar `/start` no bot
2. Ver ID nos logs: `User ID: 123456789`
3. Ou usar @userinfobot

## 💡 Dicas

- Use polling por padrão (mais estável)
- Webhook é mais eficiente mas requer HTTPS
- Railway auto-configura webhook
- Manter `.env` fora do git sempre
- Testar localmente antes de deploy

## 📝 Próximas Melhorias

- [ ] Autenticação por PIN
- [ ] Notificações de expiração
- [ ] Busca avançada
- [ ] Estatísticas por usuário
- [ ] Backup automático
- [ ] Dark mode no bot

## 👨‍💻 Suporte

- 📧 Configurar variáveis de ambiente
- 🔗 Testar endpoints manualmente
- 📱 Verificar token com @BotFather
- 🎯 Ler SETUP_GUIA.md com atenção

## 📄 Licença

MIT - Seu uso livre

---

**Status:** ✅ Produção Ready  
**Versão:** 2.0.0  
**Node:** 18.x+  
**Última atualização:** 2024

Sucesso! 🚀
