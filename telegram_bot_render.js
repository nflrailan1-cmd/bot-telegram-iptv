const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

// ===================== CONFIGURAÇÃO ======================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'SEU_TOKEN_AQUI';
const API_URL = process.env.PANEL_URL || 'https://mundofiaspo.com/gestor/telegram_api.php';
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://seu-app.onrender.com';
const PORT = process.env.PORT || 3000;

// ✅ Usar webhook para Render (mais eficiente que polling)
const bot = new TelegramBot(TOKEN, { webHook: { port: PORT } });
bot.setWebHook(`${RENDER_URL}/bot${TOKEN}`);

// Express para receber webhooks
const app = express();
app.use(express.json());

// Armazenar estado dos usuários
const userStates = {};

// ===================== FUNÇÕES AUXILIARES ======================
async function getServers() {
    try {
        const res = await axios.get(`${API_URL}?action=get_servers`);
        return res.data.servers || [];
    } catch (error) {
        console.error('❌ Erro ao obter servidores:', error.message);
        return [];
    }
}

async function getAccounts(host, page = 1) {
    try {
        const res = await axios.get(`${API_URL}?action=get_accounts&host=${encodeURIComponent(host)}&page=${page}`);
        return res.data;
    } catch (error) {
        console.error('❌ Erro ao obter contas:', error.message);
        return null;
    }
}

async function getAccountDetails(id) {
    try {
        const res = await axios.get(`${API_URL}?action=format_account&id=${id}`);
        return res.data;
    } catch (error) {
        console.error('❌ Erro ao obter detalhes:', error.message);
        return null;
    }
}

// ===================== COMANDO: START ======================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        await axios.post(`${API_URL}?action=register_user`, {
            user_id: userId,
            username: msg.from.username || 'N/A',
            first_name: msg.from.first_name || 'N/A'
        });
    } catch (e) {
        console.log('ℹ️ Aviso ao registrar usuário:', e.message);
    }
    
    const welcomeText = `
🎯 <b>BEM-VINDO AO BOT DE CONTAS IPTV</b>

Use este bot para consultar contas IPTV por servidor.

<b>Comandos disponíveis:</b>
/start - Exibe este menu
/servidores - Lista todos os servidores
/ajuda - Mostra ajuda

Clique em /servidores para começar! 👇
    `.trim();
    
    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[
                { text: '📋 Ver Servidores', callback_data: 'show_servers' }
            ]]
        }
    });
});

// ===================== COMANDO: SERVIDORES ======================
bot.onText(/\/servidores/, async (msg) => {
    const chatId = msg.chat.id;
    await showServers(chatId);
});

async function showServers(chatId) {
    const servers = await getServers();
    
    if (servers.length === 0) {
        bot.sendMessage(chatId, '❌ Nenhum servidor encontrado.');
        return;
    }
    
    let text = `📡 <b>SERVIDORES DISPONÍVEIS:</b>\n\n`;
    const buttons = [];
    
    servers.forEach((server, index) => {
        text += `${index + 1}. ${server.host} (${server.count} contas)\n`;
        buttons.push([
            {
                text: `📂 ${server.host}`,
                callback_data: `select_server|${server.host}|1`
            },
            {
                text: '🗑️ Deletar',
                callback_data: `delete_server|${server.host}`
            }
        ]);
    });
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: buttons
        }
    });
}

// ===================== CALLBACK QUERIES ======================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    bot.sendChatAction(chatId, 'typing');
    
    if (data === 'show_servers') {
        await showServers(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Delete server
    if (data.startsWith('delete_server|')) {
        const host = data.split('|')[1];
        userStates[chatId] = { action: 'confirm_delete_server', host: host };
        
        bot.sendMessage(chatId, `⚠️ <b>CUIDADO!</b>\n\nVocê tem certeza que deseja <b>DELETAR TODAS</b> as contas do servidor:\n\n🌐 <code>${host}</code>\n\nEsta ação <b>NÃO pode ser desfeita!</b>`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ Sim, deletar', callback_data: `confirm_delete|${host}` },
                    { text: '❌ Cancelar', callback_data: 'show_servers' }
                ]]
            }
        });
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Confirm delete
    if (data.startsWith('confirm_delete|')) {
        const host = data.split('|')[1];
        try {
            await axios.post(`${API_URL}?action=delete_server`, { host: host });
            bot.sendMessage(chatId, `✅ <b>Servidor deletado com sucesso!</b>\n\n🌐 ${host}`, {
                parse_mode: 'HTML'
            });
        } catch (error) {
            bot.sendMessage(chatId, `❌ Erro ao deletar: ${error.message}`, {
                parse_mode: 'HTML'
            });
        }
        delete userStates[chatId];
        await showServers(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Select server
    if (data.startsWith('select_server|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // View account
    if (data.startsWith('view_account|')) {
        const id = data.split('|')[1];
        const result = await getAccountDetails(id);
        
        if (result && result.ok) {
            bot.sendMessage(chatId, result.mensagem, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '◀️ Voltar', callback_data: `select_server|${result.conta.host}|1` }
                    ]]
                }
            });
        } else {
            bot.sendMessage(chatId, '❌ Erro ao carregar dados.');
        }
        
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Pagination
    if (data.startsWith('page|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
        bot.answerCallbackQuery(query.id);
        return;
    }
});

async function showAccounts(chatId, host, page = 1) {
    const result = await getAccounts(host, page);
    
    if (!result || !result.ok) {
        bot.sendMessage(chatId, '❌ Erro ao carregar contas.');
        return;
    }
    
    if (result.contas.length === 0) {
        bot.sendMessage(chatId, `❌ Nenhuma conta para ${host}`);
        return;
    }
    
    let text = `🌐 <b>SERVIDOR:</b> ${host}\n`;
    text += `📊 Página ${result.page} de ${result.pages}\n\n`;
    
    const buttons = [];
    
    result.contas.forEach((conta) => {
        const expira = conta.expira ? new Date(conta.expira).toLocaleDateString('pt-BR') : '-';
        const status = conta.dias_restantes > 0 ? '✅' : '❌';
        const nomeServidor = conta.host || host;
        
        text += `${status} <b>#${conta.id}</b> | ${conta.username}\n`;
        text += `   📡 ${nomeServidor}\n`;
        text += `   Exp: ${expira} (${conta.dias_restantes} dias)\n`;
        text += `   Con: ${conta.con_ativas}/${conta.max_con}\n\n`;
        
        buttons.push([{
            text: `📌 ID #${conta.id}`,
            callback_data: `view_account|${conta.id}`
        }]);
    });
    
    const navButtons = [];
    if (result.page > 1) {
        navButtons.push({
            text: '⬅️ Anterior',
            callback_data: `page|${host}|${result.page - 1}`
        });
    }
    if (result.page < result.pages) {
        navButtons.push({
            text: 'Próximo ➡️',
            callback_data: `page|${host}|${result.page + 1}`
        });
    }
    navButtons.push({
        text: '🏠 Menu',
        callback_data: 'show_servers'
    });
    
    buttons.push(navButtons);
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: buttons
        }
    });
}

// ===================== COMANDO: AJUDA ======================
bot.onText(/\/ajuda/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
<b>📚 AJUDA - BOT DE CONTAS IPTV</b>

<b>Como usar:</b>
1. Digite /servidores para ver lista
2. Clique no servidor
3. Clique no ID da conta
4. Use Próximo/Anterior para paginar

<b>Dados exibidos:</b>
🌐 HOST - Servidor
👤 USER - Usuário
🔑 PASS - Senha
📆 EXPIRA - Data de expiração
⏰ DIAS - Dias restantes

<b>Comandos:</b>
/start - Inicia o bot
/servidores - Lista servidores
/ajuda - Esta mensagem
    `.trim();
    
    bot.sendMessage(chatId, helpText, {
        parse_mode: 'HTML'
    });
});

// ===================== EXPRESS ROUTES ======================
app.get('/', (req, res) => {
    res.json({ status: '✅ Bot rodando', timestamp: new Date() });
});

app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ===================== INICIAR SERVIDOR ======================
app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  🤖 BOT TELEGRAM IPTV - RENDER.COM   ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log('');
    console.log('✅ Bot iniciado com sucesso!');
    console.log(`📡 API URL: ${API_URL}`);
    console.log(`🌐 Webhook URL: ${RENDER_URL}/bot${TOKEN}`);
    console.log(`🔌 Porta: ${PORT}`);
    console.log('');
    console.log('Aguardando mensagens no Telegram...');
    console.log('');
});

// ===================== TRATAMENTO DE ERROS ======================
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise Rejeitada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
});
