const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(express.json());

// ==================== CONFIGURAÇÕES ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const API_URL = process.env.PANEL_API_URL || 'http://localhost/telegram_api.php';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// ==================== FUNÇÕES AUXILIARES ====================
async function sendMessage(chatId, text, keyboard = null, parseMode = 'HTML') {
    try {
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: parseMode
        };
        
        if (keyboard) {
            payload.reply_markup = keyboard;
        }
        
        await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error.message);
    }
}

async function editMessage(chatId, messageId, text, keyboard = null) {
    try {
        const payload = {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML'
        };
        
        if (keyboard) {
            payload.reply_markup = keyboard;
        }
        
        await axios.post(`${TELEGRAM_API}/editMessageText`, payload);
    } catch (error) {
        console.error('Erro ao editar mensagem:', error.message);
    }
}

async function answerCallback(callbackId, text = '', showAlert = false) {
    try {
        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
            callback_query_id: callbackId,
            text: text,
            show_alert: showAlert
        });
    } catch (error) {
        console.error('Erro ao responder callback:', error.message);
    }
}

async function sendChatAction(chatId, action = 'typing') {
    try {
        await axios.post(`${TELEGRAM_API}/sendChatAction`, {
            chat_id: chatId,
            action: action
        });
    } catch (error) {
        console.error('Erro ao enviar ação:', error.message);
    }
}

// ==================== API CALLS ====================
async function getServers() {
    try {
        const res = await axios.get(`${API_URL}?action=get_servers`, { timeout: 5000 });
        return res.data.servers || [];
    } catch (error) {
        console.error('Erro ao obter servidores:', error.message);
        return [];
    }
}

async function getAccounts(host, page = 1) {
    try {
        const res = await axios.get(`${API_URL}?action=get_accounts&host=${encodeURIComponent(host)}&page=${page}`, { timeout: 5000 });
        return res.data;
    } catch (error) {
        console.error('Erro ao obter contas:', error.message);
        return null;
    }
}

async function getAccountDetails(id) {
    try {
        const res = await axios.get(`${API_URL}?action=format_account&id=${id}`, { timeout: 5000 });
        return res.data;
    } catch (error) {
        console.error('Erro ao obter detalhes:', error.message);
        return null;
    }
}

async function markInUse(id, inUse) {
    try {
        const res = await axios.post(`${API_URL}?action=mark_in_use`, {
            id: id,
            in_use: inUse ? 1 : 0
        }, { timeout: 5000 });
        return res.data;
    } catch (error) {
        console.error('Erro ao marcar conta:', error.message);
        return { ok: false };
    }
}

async function deleteServer(host) {
    try {
        const res = await axios.post(`${API_URL}?action=delete_server`, {
            host: host
        }, { timeout: 5000 });
        return res.data;
    } catch (error) {
        console.error('Erro ao deletar servidor:', error.message);
        return { ok: false };
    }
}

async function registerUser(userId, username, firstName) {
    try {
        await axios.post(`${API_URL}?action=register_user`, {
            user_id: userId,
            username: username || 'N/A',
            first_name: firstName || 'N/A'
        }, { timeout: 5000 });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error.message);
    }
}

// ==================== HANDLERS ====================
async function handleStart(chatId, userId, username, firstName) {
    await registerUser(userId, username, firstName);
    
    const text = `🎯 <b>BEM-VINDO AO BOT DE CONTAS IPTV</b>

Use este bot para consultar contas IPTV por servidor.

<b>Comandos disponíveis:</b>
/servidores - Lista todos os servidores
/ajuda - Mostra ajuda

Clique em Ver Servidores para começar! 👇`;
    
    const keyboard = {
        inline_keyboard: [[
            { text: '📋 Ver Servidores', callback_data: 'show_servers' }
        ]]
    };
    
    await sendMessage(chatId, text, keyboard);
}

async function handleServidores(chatId) {
    await sendChatAction(chatId);
    const servers = await getServers();
    
    if (servers.length === 0) {
        await sendMessage(chatId, '❌ Nenhum servidor encontrado.');
        return;
    }
    
    let text = `📡 <b>SERVIDORES DISPONÍVEIS:</b>\n\n`;
    const buttons = [];
    
    servers.forEach((server, index) => {
        text += `${index + 1}. <b>${server.host}</b> (${server.count} contas)\n`;
        buttons.push([{
            text: `${server.host} (${server.count})`,
            callback_data: `select_server|${server.host}|1`
        }]);
    });
    
    buttons.push([{
        text: '🔄 Atualizar',
        callback_data: 'show_servers'
    }]);
    
    await sendMessage(chatId, text, { inline_keyboard: buttons });
}

async function handleAjuda(chatId) {
    const text = `<b>📚 AJUDA - BOT DE CONTAS IPTV</b>

<b>Como usar:</b>
1️⃣ Digite /servidores para ver lista de servidores
2️⃣ Clique no servidor desejado
3️⃣ Clique no ID da conta para ver detalhes
4️⃣ Use os botões para navegar

<b>Dados exibidos:</b>
🌐 HOST - Servidor
👤 USER - Usuário
🔑 PASS - Senha
🔌 CON.ATIVAS - Conexões ativas
📆 EXPIRA - Data de expiração
⏰ DIAS - Dias restantes
🔗 M3U - Link da lista

<b>Funções:</b>
✅ Marcar em uso
❌ Marcar não usada
📋 Copiar dados da conta
⬅️➡️ Navegar entre contas

<b>Comandos:</b>
/start - Inicia o bot
/servidores - Lista servidores
/ajuda - Esta mensagem

Dúvidas? Contate o administrador! 📞`;
    
    await sendMessage(chatId, text);
}

async function showAccounts(chatId, messageId, host, page = 1) {
    await sendChatAction(chatId);
    const result = await getAccounts(host, page);
    
    if (!result || !result.ok) {
        await answerCallback(messageId, '❌ Erro ao carregar contas', true);
        return;
    }
    
    if (result.contas.length === 0) {
        await answerCallback(messageId, `Nenhuma conta para ${host}`, true);
        return;
    }
    
    let text = `🌐 <b>${host}</b>\n`;
    text += `📊 Página ${result.page}/${result.pages} (${result.total} contas)\n\n`;
    
    const buttons = [];
    
    result.contas.forEach((conta) => {
        const expira = conta.expira ? new Date(conta.expira).toLocaleDateString('pt-BR') : '-';
        const diasRestantes = conta.dias_restantes || 0;
        const status = diasRestantes > 0 ? '✅' : '❌';
        
        text += `${status} <b>#${conta.id}</b> | ${conta.username}\n`;
        text += `   Exp: ${expira} | ${diasRestantes}d | ${conta.con_ativas}/${conta.max_con}\n\n`;
        
        buttons.push([
            { text: `📌 #${conta.id}`, callback_data: `view_account|${conta.id}|${host}|${page}` }
        ]);
    });
    
    // Paginação
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
    
    if (messageId) {
        await editMessage(chatId, messageId, text, { inline_keyboard: buttons });
    } else {
        await sendMessage(chatId, text, { inline_keyboard: buttons });
    }
}

async function showAccountDetails(chatId, messageId, id, host, page) {
    await sendChatAction(chatId);
    const result = await getAccountDetails(id);
    
    if (!result || !result.ok) {
        await answerCallback(messageId, '❌ Erro ao carregar dados', true);
        return;
    }
    
    const conta = result.conta;
    const criada = conta.criada ? new Date(conta.criada).toLocaleDateString('pt-BR') : '-';
    const expira = conta.expira ? new Date(conta.expira).toLocaleDateString('pt-BR') : '-';
    const inUse = conta.in_use ? '✅ Em uso' : '❌ Não usada';
    
    let text = `<b>📋 DETALHES DA CONTA</b>\n\n`;
    text += `<b>ID:</b> ${conta.id}\n`;
    text += `<b>Host:</b> <code>${conta.host}</code>\n`;
    text += `<b>Usuário:</b> <code>${conta.username}</code>\n`;
    text += `<b>Senha:</b> <code>${conta.password}</code>\n\n`;
    
    text += `<b>Status:</b> ${inUse}\n`;
    text += `<b>Criada:</b> ${criada}\n`;
    text += `<b>Expira:</b> ${expira}\n`;
    text += `<b>Dias restantes:</b> ${conta.dias_restantes || 0}\n`;
    text += `<b>Conexões:</b> ${conta.con_ativas}/${conta.max_con}\n\n`;
    
    if (conta.m3u_url) {
        text += `<b>M3U:</b> <code>${conta.m3u_url}</code>\n`;
    }
    
    const statusText = conta.in_use ? 'Marcar não usada' : 'Marcar em uso';
    const statusCallback = conta.in_use ? 'mark_unused' : 'mark_used';
    
    const buttons = [[
        { text: '📋 Copiar', callback_data: `copy_data|${id}` },
        { text: `✅ ${statusText}`, callback_data: `${statusCallback}|${id}|${host}|${page}` }
    ], [
        { text: '⬅️ Voltar', callback_data: `select_server|${host}|${page}` }
    ]];
    
    await editMessage(chatId, messageId, text, { inline_keyboard: buttons });
}

// ==================== WEBHOOK ====================
app.post('/webhook', async (req, res) => {
    try {
        const message = req.body.message;
        const query = req.body.callback_query;
        
        // Mensagens de texto
        if (message) {
            const chatId = message.chat.id;
            const text = message.text || '';
            const userId = message.from.id;
            const username = message.from.username || '';
            const firstName = message.from.first_name || '';
            
            if (text === '/start') {
                await handleStart(chatId, userId, username, firstName);
            } else if (text === '/servidores') {
                await handleServidores(chatId);
            } else if (text === '/ajuda') {
                await handleAjuda(chatId);
            } else {
                await sendMessage(chatId, '❓ Comando não reconhecido. Digite /ajuda para ver os comandos disponíveis.');
            }
        }
        
        // Callback queries (botões)
        if (query) {
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;
            const data = query.data;
            const callbackId = query.id;
            
            await answerCallback(callbackId);
            
            if (data === 'show_servers') {
                await handleServidores(chatId);
            } else if (data.startsWith('select_server|')) {
                const [, host, page] = data.split('|');
                await showAccounts(chatId, messageId, host, parseInt(page));
            } else if (data.startsWith('view_account|')) {
                const [, id, host, page] = data.split('|');
                await showAccountDetails(chatId, messageId, id, host, page);
            } else if (data.startsWith('page|')) {
                const [, host, page] = data.split('|');
                await showAccounts(chatId, messageId, host, parseInt(page));
            } else if (data.startsWith('mark_used|')) {
                const [, id, host, page] = data.split('|');
                const result = await markInUse(id, true);
                if (result.ok) {
                    await answerCallback(callbackId, '✅ Marcado como em uso');
                    await showAccountDetails(chatId, messageId, id, host, page);
                } else {
                    await answerCallback(callbackId, '❌ Erro ao marcar', true);
                }
            } else if (data.startsWith('mark_unused|')) {
                const [, id, host, page] = data.split('|');
                const result = await markInUse(id, false);
                if (result.ok) {
                    await answerCallback(callbackId, '✅ Marcado como não usada');
                    await showAccountDetails(chatId, messageId, id, host, page);
                } else {
                    await answerCallback(callbackId, '❌ Erro ao marcar', true);
                }
            } else if (data.startsWith('copy_data|')) {
                const id = data.split('|')[1];
                const result = await getAccountDetails(id);
                if (result && result.ok) {
                    const conta = result.conta;
                    const copyText = `HOST: ${conta.host}\nUSUÁRIO: ${conta.username}\nSENHA: ${conta.password}\nM3U: ${conta.m3u_url || '-'}`;
                    await sendMessage(chatId, `<code>${copyText}</code>`, null, 'HTML');
                }
            }
        }
        
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(200).json({ ok: true });
    }
});

// ==================== SETUP WEBHOOK ====================
app.get('/setup-webhook', async (req, res) => {
    try {
        await axios.post(`${TELEGRAM_API}/setWebhook`, {
            url: WEBHOOK_URL,
            max_connections: 40,
            allowed_updates: ['message', 'callback_query']
        });
        res.json({ ok: true, message: 'Webhook configurado com sucesso' });
    } catch (error) {
        res.json({ ok: false, error: error.message });
    }
});

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🤖 Bot Telegram iniciado na porta ${PORT}`);
    console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`🔗 API URL: ${API_URL}`);
});
