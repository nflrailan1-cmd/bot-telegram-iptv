const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ===================== CONFIGURAÇÃO ======================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN;
const API_URL = process.env.API_URL;

if (!TOKEN || !API_URL) {
    console.error('❌ TOKEN ou API_URL não configurados!');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🤖 Bot iniciado!');
console.log('📡 API URL:', API_URL);

const userStates = {};
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(Number) : [];

// ===================== FUNÇÕES AUXILIARES ======================
function formatarData(data) {
    if (!data) return '-';
    const d = new Date(data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

function calcularDias(dataExpira) {
    if (!dataExpira) return 0;
    const hoje = new Date();
    const expira = new Date(dataExpira);
    const diff = expira - hoje;
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return dias > 0 ? dias : 0;
}

function isAdmin(userId) {
    return adminIds.includes(userId);
}

async function getServers() {
    try {
        const res = await axios.get(`${API_URL}?action=get_servers`);
        return res.data.servers || [];
    } catch (e) {
        console.error('❌ Erro ao obter servidores:', e.message);
        return [];
    }
}

async function getAccounts(host, page = 1) {
    try {
        const res = await axios.get(`${API_URL}?action=get_accounts&host=${encodeURIComponent(host)}&page=${page}`);
        return res.data;
    } catch (e) {
        console.error('❌ Erro ao obter contas:', e.message);
        return null;
    }
}

async function getAccountDetails(id) {
    try {
        const res = await axios.get(`${API_URL}?action=format_account&id=${id}`);
        return res.data;
    } catch (e) {
        console.error('❌ Erro ao obter detalhes:', e.message);
        return null;
    }
}

async function marcarEmUso(id) {
    try {
        const res = await axios.post(`${API_URL}?action=mark_in_use`, { id });
        return res.data;
    } catch (e) {
        return null;
    }
}

async function desmarcarEmUso(id) {
    try {
        const res = await axios.post(`${API_URL}?action=mark_not_in_use`, { id });
        return res.data;
    } catch (e) {
        return null;
    }
}

async function deleteServer(id) {
    try {
        const res = await axios.post(`${API_URL}?action=delete_server&id=${id}`);
        return res.data;
    } catch (e) {
        return { ok: false, erro: e.message };
    }
}

async function addServer(name, url) {
    try {
        const res = await axios.post(`${API_URL}?action=add_server`, { name, url });
        return res.data;
    } catch (e) {
        return { ok: false, erro: e.message };
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
    } catch (e) {}
    
    let texto = '🎯 <b>BEM-VINDO!</b>\n\n📋 /servidores\n❓ /ajuda';
    if (isAdmin(userId)) {
        texto += '\n\n⚙️ /admin - Painel Admin';
    }
    
    bot.sendMessage(chatId, texto, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 Ver Servidores', callback_data: 'show_servers' }],
                [{ text: '❓ Ajuda', callback_data: 'help' }]
            ]
        }
    });
});

// ===================== COMANDOS ======================
bot.onText(/\/servidores/, async (msg) => {
    await showServers(msg.chat.id);
});

bot.onText(/\/admin/, async (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) {
        bot.sendMessage(msg.chat.id, '❌ Acesso negado.');
        return;
    }
    showAdminMenu(msg.chat.id);
});

bot.onText(/\/adicionar/, async (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) {
        bot.sendMessage(msg.chat.id, '❌ Acesso negado.');
        return;
    }
    userStates[msg.chat.id] = { action: 'add_server_name' };
    bot.sendMessage(msg.chat.id, '📝 Digite o <b>nome</b> do servidor:', { parse_mode: 'HTML' });
});

bot.onText(/\/importar/, async (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) {
        bot.sendMessage(msg.chat.id, '❌ Acesso negado.');
        return;
    }
    userStates[msg.chat.id] = 'awaiting_file';
    bot.sendMessage(msg.chat.id, '📤 Envie um arquivo .TXT com as contas (NOME|URL por linha)');
});

bot.onText(/\/ajuda/, (msg) => {
    const helpText = `<b>📚 AJUDA</b>

<b>Comandos Públicos:</b>
/start - Menu inicial
/servidores - Ver servidores
/ajuda - Esta mensagem

<b>Comandos Admin:</b>
/admin - Painel administrativo
/adicionar - Adicionar servidor
/importar - Importar de arquivo .txt`;
    
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'HTML' });
});

// ===================== CALLBACKS ======================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    
    bot.sendChatAction(chatId, 'typing');
    
    if (data === 'show_servers') {
        await showServers(chatId);
    } else if (data === 'help') {
        const helpText = `<b>📚 AJUDA</b>

<b>Como usar:</b>
1. /servidores - Ver lista
2. Clique no servidor
3. Clique no ID da conta
4. Veja dados completos`;
        bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
    } else if (data === 'admin_menu') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, '❌ Acesso negado', true);
            return;
        }
        showAdminMenu(chatId);
    } else if (data === 'admin_add_server') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, '❌ Acesso negado', true);
            return;
        }
        userStates[chatId] = { action: 'add_server_name' };
        bot.sendMessage(chatId, '📝 Digite o <b>nome</b> do servidor:', { parse_mode: 'HTML' });
    } else if (data === 'admin_delete_server') {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, '❌ Acesso negado', true);
            return;
        }
        await showDeleteServers(chatId);
    } else if (data.startsWith('delete_server|')) {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, '❌ Acesso negado', true);
            return;
        }
        const serverId = data.split('|')[1];
        bot.editMessageText(
            '⚠️ Deletar servidor? (Irreversível)',
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
    } else if (data.startsWith('confirm_delete|')) {
        if (!isAdmin(userId)) {
            bot.answerCallbackQuery(query.id, '❌ Acesso negado', true);
            return;
        }
        const serverId = data.split('|')[1];
        const result = await deleteServer(serverId);
        
        if (result.ok) {
            bot.editMessageText('✅ Servidor deletado!', {
                chat_id: chatId,
                message_id: query.message.message_id
            });
        } else {
            bot.sendMessage(chatId, `❌ Erro: ${result.erro}`);
        }
    } else if (data.startsWith('select_server|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
    } else if (data.startsWith('view_account|')) {
        const id = data.split('|')[1];
        const result = await getAccountDetails(id);
        
        if (result && result.ok) {
            const c = result.conta;
            const dataExp = formatarData(c.expira);
            const dataCria = formatarData(c.criada);
            const dias = calcularDias(c.expira);
            const emUso = c.in_use ? '✅ SIM' : '❌ NÃO';
            
            const msg = `<b>📌 ID:</b> <code>${c.id}</code>\n\n<b>🌐 HOST:</b> <code>${c.host}</code>\n<b>👤 USER:</b> <code>${c.username}</code>\n<b>🔑 PASS:</b> <code>${c.password}</code>\n\n<b>⏱️ CRIADA:</b> ${dataCria}\n<b>📆 EXPIRA:</b> ${dataExp}\n<b>⏰ DIAS:</b> <b>${dias}</b>\n\n<b>🔌 ATIVAS:</b> ${c.con_ativas}/${c.max_con}\n\n<b>📱 EM USO:</b> ${emUso}\n\n<b>🔗 M3U:</b>\n<code>${c.m3u_url || 'N/A'}</code>`;
            
            const botoes = [[{ text: '◀️ Voltar', callback_data: `select_server|${c.host}|1` }]];
            
            if (c.in_use) {
                botoes.push([{ text: '🔴 Desmarcar Uso', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
            } else {
                botoes.push([{ text: '🟢 Marcar Uso', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
            }
            
            bot.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: botoes } });
        }
    } else if (data.startsWith('toggle_in_use|')) {
        const [, id, host] = data.split('|');
        const result = await getAccountDetails(id);
        
        if (result && result.ok) {
            const c = result.conta;
            if (c.in_use) {
                await desmarcarEmUso(id);
            } else {
                await marcarEmUso(id);
            }
            bot.answerCallbackQuery(query.id, '✅ Status atualizado!', true);
        }
    } else if (data.startsWith('page|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
    }
    
    bot.answerCallbackQuery(query.id);
});

// ===================== MENSAGENS DE TEXTO ======================
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const state = userStates[chatId];
    
    if (!state) return;
    
    if (state.action === 'add_server_name') {
        userStates[chatId] = { action: 'add_server_url', name: msg.text };
        bot.sendMessage(chatId, '🔗 Digite a <b>URL</b> do servidor:', { parse_mode: 'HTML' });
    } else if (state.action === 'add_server_url') {
        if (!isAdmin(userId)) {
            bot.sendMessage(chatId, '❌ Acesso negado.');
            delete userStates[chatId];
            return;
        }
        
        const result = await addServer(state.name, msg.text);
        delete userStates[chatId];
        
        if (result.ok) {
            bot.sendMessage(chatId, `✅ Servidor <b>"${state.name}"</b> adicionado!`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(chatId, `❌ Erro: ${result.erro}`, { parse_mode: 'HTML' });
        }
    }
});

// ===================== PROCESSAMENTO DE ARQUIVO ======================
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name || 'arquivo';
    
    if (userStates[chatId] !== 'awaiting_file') {
        bot.sendMessage(chatId, '❌ Use /importar para fazer upload');
        return;
    }
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, '❌ Acesso negado.');
        return;
    }
    
    if (!fileName.toLowerCase().endsWith('.txt')) {
        bot.sendMessage(chatId, '❌ Envie apenas arquivo .TXT');
        return;
    }
    
    try {
        bot.sendMessage(chatId, '⏳ Processando...');
        
        const fileStream = await bot.getFileStream(fileId);
        let fileContent = '';
        
        fileStream.on('data', (chunk) => {
            fileContent += chunk.toString();
        });
        
        fileStream.on('end', async () => {
            const linhas = fileContent.split('\n').filter(l => l.trim());
            let adicionadas = 0;
            let erros = 0;
            
            for (const linha of linhas) {
                const [name, url] = linha.split('|').map(s => s.trim());
                if (name && url) {
                    const result = await addServer(name, url);
                    if (result.ok) adicionadas++;
                    else erros++;
                }
            }
            
            bot.sendMessage(chatId, `✅ <b>IMPORTAÇÃO CONCLUÍDA!</b>\n\n📊 Adicionadas: ${adicionadas}\n❌ Erros: ${erros}`, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '📋 Ver Servidores', callback_data: 'show_servers' }]] }
            });
            
            delete userStates[chatId];
        });
        
        fileStream.on('error', (err) => {
            bot.sendMessage(chatId, `❌ Erro: ${err.message}`);
            delete userStates[chatId];
        });
        
    } catch (e) {
        bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
        delete userStates[chatId];
    }
});

// ===================== FUNÇÕES DE EXIBIÇÃO ======================
async function showServers(chatId) {
    const servers = await getServers();
    
    if (!servers.length) {
        bot.sendMessage(chatId, '❌ Nenhum servidor encontrado.');
        return;
    }
    
    let text = '📡 <b>SERVIDORES:</b>\n\n';
    const buttons = [];
    
    servers.forEach(s => {
        text += `🔗 ${s.host}\n`;
        buttons.push([{ text: `📋 ${s.host}`, callback_data: `select_server|${s.host}|1` }]);
    });
    
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

async function showAccounts(chatId, host, page = 1) {
    const result = await getAccounts(host, page);
    
    if (!result) {
        bot.sendMessage(chatId, '❌ Erro ao carregar contas.');
        return;
    }
    
    if (!result.contas.length) {
        bot.sendMessage(chatId, `❌ Sem contas em ${host}`);
        return;
    }
    
    let text = `🌐 <b>${host}</b>\n📊 Página ${result.page}/${result.pages}\n\n`;
    const buttons = [];
    
    result.contas.forEach(c => {
        const exp = formatarData(c.expira);
        const dias = calcularDias(c.expira);
        const status = dias > 0 ? '✅' : '❌';
        const emUso = c.in_use ? '📱' : '  ';
        text += `${status} ${emUso} #${c.id} | ${exp} | ${dias}d\n`;
        buttons.push([{ text: `📌 #${c.id}`, callback_data: `view_account|${c.id}` }]);
    });
    
    const nav = [];
    if (result.page > 1) nav.push({ text: '⬅️', callback_data: `page|${host}|${result.page - 1}` });
    if (result.page < result.pages) nav.push({ text: '➡️', callback_data: `page|${host}|${result.page + 1}` });
    nav.push({ text: '🏠', callback_data: 'show_servers' });
    buttons.push(nav);
    
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

function showAdminMenu(chatId) {
    const text = '⚙️ <b>PAINEL ADMIN</b>\n\nEscolha uma ação:';
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ Adicionar', callback_data: 'admin_add_server' }],
                [{ text: '🗑️ Deletar', callback_data: 'admin_delete_server' }]
            ]
        }
    });
}

async function showDeleteServers(chatId) {
    const servers = await getServers();
    
    if (!servers.length) {
        bot.sendMessage(chatId, '❌ Sem servidores.');
        return;
    }
    
    let text = '🗑️ <b>DELETAR SERVIDOR:</b>\n\n';
    const buttons = [];
    
    servers.forEach(s => {
        text += `• ${s.host}\n`;
        buttons.push([{ text: `🗑️ ${s.host}`, callback_data: `delete_server|${s.id}` }]);
    });
    
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

// ===================== INICIALIZAÇÃO ======================
console.log('✅ Bot aguardando mensagens...');
