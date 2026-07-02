const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

const TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = process.env.API_URL;
const ADMIN_ID = process.env.ADMIN_ID || null;

if (!TOKEN || !API_URL) {
    console.error('❌ TOKEN ou API_URL não configurados!');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🤖 Bot iniciado com sucesso!');
console.log('📡 API URL:', API_URL);
if (ADMIN_ID) console.log('👨‍💼 Admin ID:', ADMIN_ID);

// Cache para reduzir requisições à API
const cache = {
    servers: { data: null, time: 0, ttl: 300000 }, // 5 min
    accounts: {}
};

const userStates = {};
const userSessions = {};

// ==================== UTILITÁRIOS ====================

function log(level, msg) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${msg}`);
}

function isAdmin(userId) {
    return ADMIN_ID && userId.toString() === ADMIN_ID.toString();
}

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

function getStatusEmoji(dias) {
    if (dias === 0) return '⛔';
    if (dias <= 7) return '🔴';
    if (dias <= 15) return '🟠';
    if (dias <= 30) return '🟡';
    return '🟢';
}

// ==================== API CALLS ====================

async function getServers() {
    try {
        // Verifica cache
        if (cache.servers.data && Date.now() - cache.servers.time < cache.servers.ttl) {
            return cache.servers.data;
        }

        const res = await axios.get(`${API_URL}?action=get_servers`, { timeout: 10000 });
        cache.servers.data = res.data.servers || [];
        cache.servers.time = Date.now();
        return cache.servers.data;
    } catch (e) {
        log('ERROR', `getServers: ${e.message}`);
        return [];
    }
}

async function getAccounts(host, page = 1, search = null) {
    try {
        let url = `${API_URL}?action=get_accounts&host=${encodeURIComponent(host)}&page=${page}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const res = await axios.get(url, { timeout: 15000 });
        
        // Cache
        const cacheKey = `${host}_${page}_${search || 'all'}`;
        cache.accounts[cacheKey] = res.data;
        
        return res.data;
    } catch (e) {
        log('ERROR', `getAccounts: ${e.message}`);
        return null;
    }
}

async function getAccountDetails(id) {
    try {
        const res = await axios.get(`${API_URL}?action=format_account&id=${id}`, { timeout: 10000 });
        return res.data;
    } catch (e) {
        log('ERROR', `getAccountDetails: ${e.message}`);
        return null;
    }
}

async function marcarEmUso(id) {
    try {
        const res = await axios.post(`${API_URL}?action=mark_in_use`, { id }, { timeout: 10000 });
        log('INFO', `Account #${id} marcada em uso`);
        return res.data;
    } catch (e) {
        log('ERROR', `marcarEmUso: ${e.message}`);
        return null;
    }
}

async function desmarcarEmUso(id) {
    try {
        const res = await axios.post(`${API_URL}?action=mark_not_in_use`, { id }, { timeout: 10000 });
        log('INFO', `Account #${id} desmarcada`);
        return res.data;
    } catch (e) {
        log('ERROR', `desmarcarEmUso: ${e.message}`);
        return null;
    }
}

async function importarArquivo(fileContent) {
    try {
        const res = await axios.post(`${API_URL}?action=import_file`, 
            { conteudo: fileContent },
            { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        log('INFO', `Import: ${res.data.adicionadas} adicionadas, ${res.data.atualizadas} atualizadas`);
        return res.data;
    } catch (e) {
        log('ERROR', `importarArquivo: ${e.message}`);
        return { ok: false, erro: e.message };
    }
}

async function deletarAccount(id) {
    try {
        const res = await axios.post(`${API_URL}?action=delete_account`, { id }, { timeout: 10000 });
        log('INFO', `Account #${id} deletada`);
        return res.data;
    } catch (e) {
        log('ERROR', `deletarAccount: ${e.message}`);
        return null;
    }
}

async function registrarUsuario(userId, username, firstName) {
    try {
        await axios.post(`${API_URL}?action=register_user`, {
            user_id: userId,
            username: username || 'N/A',
            first_name: firstName || 'N/A'
        }, { timeout: 5000 });
    } catch (e) {
        // Silent fail
    }
}

// ==================== COMANDOS ====================

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    await registrarUsuario(userId, msg.from.username, msg.from.first_name);
    
    const textStart = isAdmin(userId)
        ? '🎯 <b>BEM-VINDO ADMIN!</b>\n\n📋 /servidores\n🔍 /buscar\n📤 /importar\n📊 /stats\n❓ /ajuda'
        : '🎯 <b>BEM-VINDO!</b>\n\n📋 /servidores\n🔍 /buscar\n📤 /importar\n❓ /ajuda';
    
    bot.sendMessage(chatId, textStart, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 Ver Servidores', callback_data: 'show_servers' }],
                [{ text: '🔍 Buscar Conta', callback_data: 'search_menu' }],
                [{ text: '📤 Importar TXT', callback_data: 'import_menu' }]
            ]
        }
    });
    
    log('INFO', `User ${userId} iniciou bot`);
});

bot.onText(/\/servidores/, async (msg) => {
    await showServers(msg.chat.id);
});

bot.onText(/\/buscar/, async (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = 'awaiting_search';
    bot.sendMessage(chatId, '🔍 <b>BUSCA</b>\n\nDigite o ID ou parte do username da conta:', {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
    });
});

bot.onText(/\/importar/, async (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = 'awaiting_file';
    bot.sendMessage(chatId, '📤 <b>IMPORTAR ARQUIVO</b>\n\nEnvie um arquivo .TXT com as contas\n\nFormato esperado:\nhost|username|password|...', {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
    });
});

bot.onText(/\/stats/, async (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) {
        bot.sendMessage(msg.chat.id, '❌ Acesso negado!');
        return;
    }
    
    // Limpa cache para atualizar
    cache.servers.data = null;
    
    const servers = await getServers();
    const totalContas = servers.reduce((acc, s) => acc + (s.count || 0), 0);
    
    const stats = `📊 <b>ESTATÍSTICAS</b>\n\n`;
    let statsText = stats + `🖥️ Servidores: ${servers.length}\n📱 Total de Contas: ${totalContas}\n\n<b>Servidores:</b>\n`;
    
    servers.forEach(s => {
        statsText += `• ${s.host}: ${s.count} contas\n`;
    });
    
    bot.sendMessage(msg.chat.id, statsText, { parse_mode: 'HTML' });
});

bot.onText(/\/ajuda/, (msg) => {
    const isAdminUser = isAdmin(msg.from.id);
    const commands = `📚 <b>AJUDA</b>\n\n<b>Comandos:</b>\n/start - Menu principal\n/servidores - Ver servidores\n/buscar - Buscar conta\n/importar - Importar TXT\n/ajuda - Esta mensagem`;
    const adminCmd = isAdminUser ? `\n\n<b>Admin:</b>\n/stats - Estatísticas\n/limpar_cache - Limpar cache` : '';
    
    bot.sendMessage(msg.chat.id, commands + adminCmd, { parse_mode: 'HTML' });
});

bot.onText(/\/limpar_cache/, async (msg) => {
    const userId = msg.from.id;
    if (!isAdmin(userId)) {
        bot.sendMessage(msg.chat.id, '❌ Acesso negado!');
        return;
    }
    
    cache.servers.data = null;
    cache.accounts = {};
    bot.sendMessage(msg.chat.id, '✅ Cache limpo!');
    log('INFO', 'Cache limpo por admin');
});

// ==================== CALLBACK QUERIES ====================

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    
    try {
        if (data === 'show_servers') {
            await showServers(chatId);
        } else if (data === 'import_menu') {
            userStates[chatId] = 'awaiting_file';
            bot.sendMessage(chatId, '📤 Envie um arquivo .TXT com as contas:', { reply_markup: { remove_keyboard: true } });
        } else if (data === 'search_menu') {
            userStates[chatId] = 'awaiting_search';
            bot.sendMessage(chatId, '🔍 Digite o ID ou username para buscar:', { reply_markup: { remove_keyboard: true } });
        } else if (data.startsWith('select_server|')) {
            const [, host, page] = data.split('|');
            await showAccounts(chatId, host, parseInt(page));
        } else if (data.startsWith('view_account|')) {
            const id = data.split('|')[1];
            await showAccountDetail(chatId, id, userId);
        } else if (data.startsWith('copy|')) {
            const id = data.split('|')[1];
            await copyAccountInfo(chatId, id);
        } else if (data.startsWith('toggle_in_use|')) {
            const [, id, host] = data.split('|');
            await toggleInUse(query, chatId, id, host);
        } else if (data.startsWith('delete_account|')) {
            const [, id, host] = data.split('|');
            if (isAdmin(userId)) {
                await deleteAccountConfirm(query, chatId, id, host);
            }
        } else if (data.startsWith('confirm_delete|')) {
            const [, id, host] = data.split('|');
            if (isAdmin(userId)) {
                await confirmDelete(query, chatId, id, host);
            }
        } else if (data.startsWith('page|')) {
            const [, host, page] = data.split('|');
            await showAccounts(chatId, host, parseInt(page));
        }
        
        bot.answerCallbackQuery(query.id);
    } catch (e) {
        log('ERROR', `Callback error: ${e.message}`);
        bot.answerCallbackQuery(query.id, '❌ Erro', true);
    }
});

// ==================== FUNÇÕES DE EXIBIÇÃO ====================

async function showServers(chatId) {
    const servers = await getServers();
    if (!servers.length) {
        bot.sendMessage(chatId, '❌ Sem servidores disponíveis');
        return;
    }
    
    let text = '📡 <b>SERVIDORES</b>\n\n';
    const buttons = [];
    
    servers.forEach(s => {
        const count = s.count || 0;
        text += `${s.host} (${count})\n`;
        buttons.push([{ text: `🖥️ ${s.host}`, callback_data: `select_server|${s.host}|1` }]);
    });
    
    buttons.push([{ text: '🔄 Atualizar', callback_data: 'show_servers' }]);
    
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

async function showAccounts(chatId, host, page = 1) {
    const result = await getAccounts(host, page);
    
    if (!result) {
        bot.sendMessage(chatId, '❌ Erro ao carregar contas');
        return;
    }
    
    if (!result.contas || result.contas.length === 0) {
        bot.sendMessage(chatId, `❌ Nenhuma conta encontrada em ${host}`);
        return;
    }
    
    let text = `🌐 <b>${host}</b>\n📊 Página ${result.page}/${result.pages}\n\n`;
    const buttons = [];
    
    result.contas.forEach(c => {
        const exp = formatarData(c.expira);
        const dias = calcularDias(c.expira);
        const status = getStatusEmoji(dias);
        const emUso = c.in_use ? '📱' : '  ';
        text += `${status} ${emUso} #${c.id} | ${exp} | ${dias}d\n`;
        buttons.push([{ text: `📌 #${c.id} (${dias}d)`, callback_data: `view_account|${c.id}` }]);
    });
    
    const nav = [];
    if (result.page > 1) nav.push({ text: '⬅️ Anterior', callback_data: `page|${host}|${result.page - 1}` });
    if (result.page < result.pages) nav.push({ text: 'Próximo ➡️', callback_data: `page|${host}|${result.page + 1}` });
    nav.push({ text: '🏠 Menu', callback_data: 'show_servers' });
    buttons.push(nav);
    
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

async function showAccountDetail(chatId, id, userId) {
    const result = await getAccountDetails(id);
    
    if (!result || !result.ok) {
        bot.sendMessage(chatId, '❌ Conta não encontrada');
        return;
    }
    
    const c = result.conta;
    const dataExp = formatarData(c.expira);
    const dataCria = formatarData(c.criada);
    const dias = calcularDias(c.expira);
    const emUso = c.in_use ? '✅ SIM' : '❌ NÃO';
    const status = getStatusEmoji(dias);
    
    const msg = `${status} <b>ID:</b> <code>${c.id}</code>\n\n<b>🌐 HOST:</b> <code>${c.host}</code>\n<b>👤 USER:</b> <code>${c.username}</code>\n<b>🔑 PASS:</b> <code>${c.password}</code>\n\n<b>⏱️ CRIADA:</b> ${dataCria}\n<b>📆 EXPIRA:</b> ${dataExp}\n<b>⏰ DIAS:</b> <b>${dias}</b>\n\n<b>🔌 ATIVAS:</b> ${c.con_ativas}/${c.max_con}\n<b>📱 EM USO:</b> ${emUso}\n\n<b>🔗 M3U:</b>\n<code>${c.m3u_url}</code>`;
    
    const botoes = [[{ text: '📋 Copiar', callback_data: `copy|${c.id}` }, { text: '◀️ Voltar', callback_data: `select_server|${c.host}|1` }]];
    
    if (c.in_use) {
        botoes.push([{ text: '🔴 Remover do uso', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
    } else {
        botoes.push([{ text: '🟢 Marcar como USADO', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
    }
    
    if (isAdmin(userId)) {
        botoes.push([{ text: '🗑️ Deletar', callback_data: `delete_account|${c.id}|${c.host}` }]);
    }
    
    bot.sendMessage(chatId, msg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: botoes } });
}

async function copyAccountInfo(chatId, id) {
    const result = await getAccountDetails(id);
    
    if (!result || !result.ok) return;
    
    const c = result.conta;
    const dataExp = formatarData(c.expira);
    const dataCria = formatarData(c.criada);
    const dias = calcularDias(c.expira);
    const emUso = c.in_use ? 'SIM' : 'NÃO';
    
    const txt = `ID: ${c.id}\nHOST: ${c.host}\nUSER: ${c.username}\nPASS: ${c.password}\nCRIADA: ${dataCria}\nEXPIRA: ${dataExp}\nDIAS: ${dias}\nATIVAS: ${c.con_ativas}/${c.max_con}\nEM USO: ${emUso}\nM3U: ${c.m3u_url}`;
    
    bot.sendMessage(chatId, `<pre>${txt}</pre>`, { parse_mode: 'HTML' });
}

async function toggleInUse(query, chatId, id, host) {
    const result = await getAccountDetails(id);
    
    if (result && result.ok) {
        const c = result.conta;
        if (c.in_use) {
            await desmarcarEmUso(id);
        } else {
            await marcarEmUso(id);
        }
        
        // Recarrega detalhes
        setTimeout(() => showAccountDetail(chatId, id, query.from.id), 500);
        bot.answerCallbackQuery(query.id, '✅ Status atualizado!', true);
    }
}

async function deleteAccountConfirm(query, chatId, id, host) {
    bot.sendMessage(chatId, `⚠️ <b>ATENÇÃO!</b>\n\nTem certeza que deseja deletar a conta #${id}?`, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Sim, deletar', callback_data: `confirm_delete|${id}|${host}` },
                    { text: '❌ Cancelar', callback_data: `select_server|${host}|1` }
                ]
            ]
        }
    });
}

async function confirmDelete(query, chatId, id, host) {
    const result = await deletarAccount(id);
    
    if (result && result.ok) {
        bot.sendMessage(chatId, '✅ Conta deletada com sucesso!', {
            reply_markup: { inline_keyboard: [[{ text: '📋 Voltar', callback_data: `select_server|${host}|1` }]] }
        });
    } else {
        bot.sendMessage(chatId, '❌ Erro ao deletar conta');
    }
}

// ==================== MENSAGENS DE TEXTO ====================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    if (userStates[chatId] === 'awaiting_search' && text && !text.startsWith('/')) {
        const query = text.trim();
        
        // Tenta buscar em todos os servidores
        const servers = await getServers();
        let found = false;
        
        for (const server of servers) {
            const result = await getAccounts(server.host, 1, query);
            if (result && result.contas && result.contas.length > 0) {
                found = true;
                
                let searchText = `🔍 <b>RESULTADOS</b>\n\nBusca: "${query}"\n\n`;
                const buttons = [];
                
                result.contas.forEach(c => {
                    const dias = calcularDias(c.expira);
                    const status = getStatusEmoji(dias);
                    searchText += `${status} #${c.id} | ${c.username} | ${dias}d\n`;
                    buttons.push([{ text: `📌 #${c.id} - ${c.username}`, callback_data: `view_account|${c.id}` }]);
                });
                
                buttons.push([{ text: '🏠 Menu', callback_data: 'show_servers' }]);
                
                bot.sendMessage(chatId, searchText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
                break;
            }
        }
        
        if (!found) {
            bot.sendMessage(chatId, `❌ Nenhuma conta encontrada com "${query}"`);
        }
        
        delete userStates[chatId];
    }
});

// ==================== UPLOAD DE ARQUIVO ====================

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name || 'arquivo';
    
    if (userStates[chatId] !== 'awaiting_file') {
        bot.sendMessage(chatId, '❌ Use /importar para fazer upload');
        return;
    }
    
    if (!fileName.toLowerCase().endsWith('.txt')) {
        bot.sendMessage(chatId, '❌ Envie apenas arquivo .TXT');
        return;
    }
    
    try {
        const loadMsg = await bot.sendMessage(chatId, '⏳ Processando arquivo...');
        
        const fileStream = await bot.getFileStream(fileId);
        let fileContent = '';
        
        fileStream.on('data', (chunk) => {
            fileContent += chunk.toString();
        });
        
        fileStream.on('end', async () => {
            const resultado = await importarArquivo(fileContent);
            
            // Limpa cache após import
            cache.servers.data = null;
            cache.accounts = {};
            
            if (resultado.ok) {
                bot.editMessageText(`✅ <b>ARQUIVO IMPORTADO!</b>\n\n📊 Adicionadas: ${resultado.adicionadas}\n📊 Atualizadas: ${resultado.atualizadas}\n❌ Erros: ${resultado.erros}`, {
                    chat_id: chatId,
                    message_id: loadMsg.message_id,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[{ text: '📋 Ver Servidores', callback_data: 'show_servers' }]] }
                });
            } else {
                bot.editMessageText(`❌ <b>Erro na importação:</b>\n${resultado.erro}`, {
                    chat_id: chatId,
                    message_id: loadMsg.message_id,
                    parse_mode: 'HTML'
                });
            }
            
            delete userStates[chatId];
        });
        
        fileStream.on('error', (err) => {
            bot.sendMessage(chatId, `❌ Erro: ${err.message}`);
            delete userStates[chatId];
        });
        
    } catch (e) {
        log('ERROR', `File upload: ${e.message}`);
        bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
        delete userStates[chatId];
    }
});

// ==================== ERROR HANDLING ====================

bot.on('polling_error', (error) => {
    log('ERROR', `Polling error: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', `Unhandled Rejection: ${reason}`);
});

log('INFO', '✅ Bot aguardando mensagens...');
