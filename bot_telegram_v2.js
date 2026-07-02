const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

// ===================== CONFIGURAÇÃO ======================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'SEU_TOKEN_AQUI';
const API_URL = process.env.API_URL || 'https://seu-painel.com/telegram_api.php';
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Para webhooks (gratuito em Railway, Heroku alternativas)
const PORT = process.env.PORT || 3000;

const bot = WEBHOOK_URL 
    ? new TelegramBot(TOKEN, { webHook: { port: PORT, host: '0.0.0.0' } })
    : new TelegramBot(TOKEN, { polling: true });

if (WEBHOOK_URL) {
    bot.setWebHook(`${WEBHOOK_URL}/bot${TOKEN}`);
    console.log(`🔗 Webhook configurado: ${WEBHOOK_URL}`);
}

const userStates = {};
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(Number) : [];

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

async function deleteServer(id) {
    try {
        const res = await axios.post(`${API_URL}?action=delete_server&id=${id}`);
        return res.data;
    } catch (error) {
        console.error('❌ Erro ao deletar servidor:', error.message);
        return { ok: false, erro: error.message };
    }
}

async function addServer(name, url) {
    try {
        const res = await axios.post(`${API_URL}?action=add_server`, { name, url });
        return res.data;
    } catch (error) {
        console.error('❌ Erro ao adicionar servidor:', error.message);
        return { ok: false, erro: error.message };
    }
}

function isAdmin(userId) {
    return adminIds.includes(userId);
}

// ===================== COMANDO: START ======================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isAdminUser = isAdmin(userId);
    
    try {
        await axios.post(`${API_URL}?action=register_user`, {
            user_id: userId,
            username: msg.from.username || 'N/A',
            first_name: msg.from.first_name || 'N/A'
        });
    } catch (e) {
        console.log('⚠️  Aviso ao registrar usuário:', e.message);
    }
    
    let welcomeText = `
🎯 <b>BEM-VINDO AO BOT DE GERENCIAMENTO IPTV</b>

Consulte contas IPTV por servidor e gerencie sua infraestrutura.

<b>Comandos disponíveis:</b>
/servidores - 📋 Ver lista de servidores
/ajuda - 📚 Mostra ajuda completa
/menu - 🎛️ Menu operacional
    `.trim();

    if (isAdminUser) {
        welcomeText += `

<b>⚙️ FUNÇÕES ADMIN:</b>
/admin - Painel administrativo
/adicionar - ➕ Adicionar novo servidor
/importar - 📥 Importar servidores (arquivo)
        `;
    }

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: isAdminUser ? [
                [{ text: '📋 Servidores', callback_data: 'show_servers' }],
                [{ text: '⚙️ Admin', callback_data: 'admin_menu' }],
                [{ text: '📚 Ajuda', callback_data: 'help' }]
            ] : [
                [{ text: '📋 Servidores', callback_data: 'show_servers' }],
                [{ text: '📚 Ajuda', callback_data: 'help' }]
            ]
        }
    });
});

// ===================== MENU OPERACIONAL ======================
bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const menuText = `
🎛️ <b>MENU OPERACIONAL</b>

Escolha uma opção:
    `.trim();
    
    const buttons = [
        [{ text: '📋 Ver Servidores', callback_data: 'show_servers' }],
        [{ text: '🔍 Buscar Conta', callback_data: 'search_account' }],
        [{ text: '📊 Estatísticas', callback_data: 'stats' }]
    ];
    
    if (isAdmin(userId)) {
        buttons.push(
            [{ text: '⚙️ Painel Admin', callback_data: 'admin_menu' }]
        );
    }
    
    buttons.push([{ text: '❌ Fechar', callback_data: 'close' }]);
    
    bot.sendMessage(chatId, menuText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    });
});

// ===================== PAINEL ADMIN ======================
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, '❌ Acesso negado. Apenas admins podem usar este comando.');
        return;
    }
    
    showAdminMenu(chatId);
});

async function showAdminMenu(chatId) {
    const adminText = `
⚙️ <b>PAINEL ADMINISTRATIVO</b>

Escolha uma ação:
    `.trim();
    
    bot.sendMessage(chatId, adminText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 Listar Servidores', callback_data: 'admin_list_servers' }],
                [{ text: '➕ Adicionar Servidor', callback_data: 'admin_add_server' }],
                [{ text: '🗑️ Deletar Servidor', callback_data: 'admin_delete_server' }],
                [{ text: '📥 Importar via TXT', callback_data: 'admin_import' }],
                [{ text: '🔙 Voltar', callback_data: 'back_to_main' }]
            ]
        }
    });
}

// ===================== COMANDOS ADMIN ======================
bot.onText(/\/adicionar/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, '❌ Acesso negado.');
        return;
    }
    
    userStates[chatId] = { action: 'add_server_name' };
    bot.sendMessage(chatId, '📝 Digite o <b>nome</b> do servidor:', { parse_mode: 'HTML' });
});

bot.onText(/\/importar/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, '❌ Acesso negado.');
        return;
    }
    
    bot.sendMessage(chatId, `
📥 <b>IMPORTAR SERVIDORES</b>

Envie um arquivo .txt com este formato:
<code>
nome_servidor1|http://url1.com
nome_servidor2|http://url2.com
nome_servidor3|http://url3.com
</code>

Cada linha: <b>NOME|URL</b>
    `, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'close' }]]
        }
    });
    
    userStates[chatId] = { action: 'import_file' };
});

// ===================== MENSAGENS DE TEXTO ======================
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return; // Ignorar comandos
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const state = userStates[chatId];
    
    if (!state) return;
    
    // Adicionar servidor - Etapa 1: Nome
    if (state.action === 'add_server_name') {
        userStates[chatId] = { 
            action: 'add_server_url',
            name: msg.text
        };
        bot.sendMessage(chatId, '🔗 Agora digite a <b>URL</b> do servidor:', { parse_mode: 'HTML' });
        return;
    }
    
    // Adicionar servidor - Etapa 2: URL
    if (state.action === 'add_server_url') {
        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Acesso negado.');
            delete userStates[chatId];
            return;
        }
        
        const result = await addServer(state.name, msg.text);
        delete userStates[chatId];
        
        if (result.ok) {
            bot.sendMessage(chatId, `✅ Servidor <b>"${state.name}"</b> adicionado com sucesso!`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(chatId, `❌ Erro: ${result.erro || 'Erro desconhecido'}`, { parse_mode: 'HTML' });
        }
        return;
    }
});

// ===================== ARQUIVO - IMPORTAÇÃO ======================
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const state = userStates[chatId];
    
    if (!state || state.action !== 'import_file') return;
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, '❌ Acesso negado.');
        return;
    }
    
    if (!msg.document.file_name.endsWith('.txt')) {
        bot.sendMessage(chatId, '❌ Envie um arquivo .txt');
        return;
    }
    
    try {
        const file = await bot.getFile(msg.document.file_id);
        const fileStream = await axios.get(`https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`, 
            { responseType: 'arraybuffer' });
        
        const content = fileStream.data.toString('utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        let importCount = 0;
        let errorCount = 0;
        
        bot.sendMessage(chatId, `⏳ Importando ${lines.length} servidores...`);
        
        for (const line of lines) {
            const [name, url] = line.split('|').map(s => s.trim());
            
            if (name && url) {
                const result = await addServer(name, url);
                if (result.ok) {
                    importCount++;
                } else {
                    errorCount++;
                }
            }
        }
        
        delete userStates[chatId];
        bot.sendMessage(chatId, `
✅ <b>IMPORTAÇÃO CONCLUÍDA</b>

✔️ Adicionados: ${importCount}
❌ Erros: ${errorCount}
        `, { parse_mode: 'HTML' });
        
    } catch (error) {
        bot.sendMessage(chatId, `❌ Erro ao processar arquivo: ${error.message}`);
    }
});

// ===================== CALLBACKS ======================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    
    bot.sendChatAction(chatId, 'typing');
    
    // Menu principal
    if (data === 'show_servers') {
        await showServersCallback(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data === 'help') {
        showHelp(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data === 'admin_menu') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Acesso negado', show_alert: true });
            return;
        }
        showAdminMenu(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data === 'back_to_main') {
        const mainText = `🏠 <b>MENU PRINCIPAL</b>`;
        bot.editMessageText(mainText, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 Servidores', callback_data: 'show_servers' }],
                    [{ text: '⚙️ Admin', callback_data: 'admin_menu' }],
                    [{ text: '📚 Ajuda', callback_data: 'help' }]
                ]
            }
        });
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Admin Actions
    if (data === 'admin_list_servers') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Acesso negado', show_alert: true });
            return;
        }
        await showAdminServersCallback(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data === 'admin_add_server') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Acesso negado', show_alert: true });
            return;
        }
        userStates[chatId] = { action: 'add_server_name' };
        bot.sendMessage(chatId, '📝 Digite o <b>nome</b> do servidor:', { parse_mode: 'HTML' });
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data === 'admin_delete_server') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Acesso negado', show_alert: true });
            return;
        }
        await showDeleteServersCallback(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data === 'admin_import') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Acesso negado', show_alert: true });
            return;
        }
        userStates[chatId] = { action: 'import_file' };
        bot.sendMessage(chatId, `
📥 <b>IMPORTAR SERVIDORES</b>

Envie um arquivo .txt com este formato:
<code>
nome_servidor1|http://url1.com
nome_servidor2|http://url2.com
</code>
        `, { parse_mode: 'HTML' });
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Delete server
    if (data.startsWith('confirm_delete|')) {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Acesso negado', show_alert: true });
            return;
        }
        const serverId = data.split('|')[1];
        const result = await deleteServer(serverId);
        
        if (result.ok) {
            bot.editMessageText(
                `✅ Servidor deletado com sucesso!`,
                { chat_id: chatId, message_id: query.message.message_id }
            );
        } else {
            bot.sendMessage(chatId, `❌ Erro: ${result.erro || 'Erro ao deletar'}`);
        }
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data.startsWith('delete_server|')) {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Acesso negado', show_alert: true });
            return;
        }
        const serverId = data.split('|')[1];
        bot.editMessageText(
            `⚠️ Deletar servidor? Esta ação é irreversível!`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Confirmar', callback_data: `confirm_delete|${serverId}` },
                            { text: '❌ Cancelar', callback_data: 'admin_delete_server' }
                        ]
                    ]
                }
            }
        );
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Servidores normais
    if (data.startsWith('select_server|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
        bot.answerCallbackQuery(query.id);
        return;
    }
    
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
            bot.sendMessage(chatId, '❌ Erro ao carregar dados da conta.');
        }
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data.startsWith('page|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data === 'close') {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        bot.answerCallbackQuery(query.id);
        return;
    }
});

// ===================== FUNÇÕES DE CALLBACK ======================
async function showServersCallback(chatId) {
    const servers = await getServers();
    
    if (servers.length === 0) {
        bot.sendMessage(chatId, '❌ Nenhum servidor encontrado.');
        return;
    }
    
    let text = `📡 <b>SERVIDORES DISPONÍVEIS:</b>\n\n`;
    const buttons = [];
    
    servers.forEach((server) => {
        text += `🔗 ${server.host}\n`;
        buttons.push([{
            text: `📋 Ver Contas - ${server.host}`,
            callback_data: `select_server|${server.host}|1`
        }]);
    });
    
    buttons.push([{ text: '🏠 Menu', callback_data: 'back_to_main' }]);
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    });
}

async function showAdminServersCallback(chatId) {
    const servers = await getServers();
    
    if (servers.length === 0) {
        bot.sendMessage(chatId, '❌ Nenhum servidor encontrado.');
        return;
    }
    
    let text = `📋 <b>SERVIDORES CADASTRADOS:</b>\n\n`;
    
    servers.forEach((server, index) => {
        text += `${index + 1}. <b>${server.host}</b> - ${server.count} contas\n`;
    });
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'admin_menu' }]]
        }
    });
}

async function showDeleteServersCallback(chatId) {
    const servers = await getServers();
    
    if (servers.length === 0) {
        bot.sendMessage(chatId, '❌ Nenhum servidor para deletar.');
        return;
    }
    
    let text = `🗑️ <b>DELETAR SERVIDOR</b>\n\nEscolha qual deletar:\n\n`;
    const buttons = [];
    
    servers.forEach((server) => {
        text += `• ${server.host}\n`;
        buttons.push([{
            text: `🗑️ ${server.host}`,
            callback_data: `delete_server|${server.id}`
        }]);
    });
    
    buttons.push([[{ text: '🔙 Voltar', callback_data: 'admin_menu' }]]);
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    });
}

async function showAccounts(chatId, host, page = 1) {
    const result = await getAccounts(host, page);
    
    if (!result || !result.ok) {
        bot.sendMessage(chatId, '❌ Erro ao carregar contas.');
        return;
    }
    
    if (result.contas.length === 0) {
        bot.sendMessage(chatId, `❌ Nenhuma conta encontrada para ${host}`);
        return;
    }
    
    let text = `🌐 <b>SERVIDOR:</b> ${host}\n`;
    text += `📊 Página ${result.page} de ${result.pages}\n\n`;
    
    const buttons = [];
    
    result.contas.forEach((conta) => {
        const expira = conta.expira ? new Date(conta.expira).toLocaleDateString('pt-BR') : '-';
        const status = conta.dias_restantes > 0 ? '✅' : '❌';
        
        text += `${status} <b>#${conta.id}</b> | ${conta.username}\n`;
        text += `   Exp: ${expira} | Con: ${conta.con_ativas}/${conta.max_con}\n\n`;
        
        buttons.push([{
            text: `📌 #${conta.id}`,
            callback_data: `view_account|${conta.id}`
        }]);
    });
    
    const navButtons = [];
    if (result.page > 1) {
        navButtons.push({
            text: '⬅️',
            callback_data: `page|${host}|${result.page - 1}`
        });
    }
    if (result.page < result.pages) {
        navButtons.push({
            text: '➡️',
            callback_data: `page|${host}|${result.page + 1}`
        });
    }
    navButtons.push({
        text: '🏠',
        callback_data: 'show_servers'
    });
    
    buttons.push(navButtons);
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
    });
}

function showHelp(chatId) {
    const helpText = `
<b>📚 AJUDA - BOT DE GERENCIAMENTO IPTV</b>

<b>PARA TODOS:</b>
/start - Inicia o bot
/menu - Menu operacional
/servidores - Ver lista de servidores
/ajuda - Esta mensagem

<b>VISUALIZAÇÃO:</b>
1. Clique em um servidor
2. Veja a lista de contas com paginação
3. Clique no ID da conta para detalhes completos

<b>Dados exibidos:</b>
🌐 HOST | 👤 USER | 🔑 PASS
🔌 CONEXÕES ATIVAS | ⏰ DIAS RESTANTES
📆 EXPIRA | 🔗 M3U

<b>⚙️ FUNÇÕES ADMIN (se autorizado):</b>
/admin - Painel administrativo
/adicionar - Adicionar novo servidor
/importar - Importar de arquivo .txt
/menu - Menu com opção de deletar

<b>Formato de importação (TXT):</b>
<code>
servidor1|http://url1.com
servidor2|http://url2.com
</code>
    `.trim();
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
}

// ===================== ERROS ======================
bot.on('polling_error', (error) => {
    console.error('❌ Erro no polling:', error);
});

bot.on('error', (error) => {
    console.error('❌ Erro do bot:', error);
});

console.log('✅ Bot iniciado com sucesso!');
console.log(`🔗 Modo: ${WEBHOOK_URL ? 'Webhook' : 'Polling'}`);
console.log(`📡 API URL: ${API_URL}`);
console.log(`👮 Admins configurados: ${adminIds.length > 0 ? adminIds.join(', ') : 'nenhum'}`);
