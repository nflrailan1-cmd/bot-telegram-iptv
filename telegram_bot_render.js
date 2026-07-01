const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = process.env.API_URL;

if (!TOKEN || !API_URL) {
    console.error('❌ TOKEN ou API_URL não configurados!');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🤖 Bot iniciado!');
console.log('📡 API URL:', API_URL);

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

async function getServers() {
    try {
        const res = await axios.get(`${API_URL}?action=get_servers`);
        return res.data.servers || [];
    } catch (e) {
        return [];
    }
}

async function getAccounts(host, page = 1) {
    try {
        const res = await axios.get(`${API_URL}?action=get_accounts&host=${encodeURIComponent(host)}&page=${page}`);
        return res.data;
    } catch (e) {
        return null;
    }
}

async function getAccountDetails(id) {
    try {
        const res = await axios.get(`${API_URL}?action=format_account&id=${id}`);
        return res.data;
    } catch (e) {
        return null;
    }
}

// Marcar como em uso
async function marcarEmUso(id) {
    try {
        const res = await axios.post(`${API_URL}?action=mark_in_use`, { id });
        return res.data;
    } catch (e) {
        console.error('Erro ao marcar em uso:', e.message);
        return null;
    }
}

// Desmarcar em uso
async function desmarcarEmUso(id) {
    try {
        const res = await axios.post(`${API_URL}?action=mark_not_in_use`, { id });
        return res.data;
    } catch (e) {
        console.error('Erro ao desmarcar:', e.message);
        return null;
    }
}

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
    
    bot.sendMessage(chatId, '🎯 <b>BEM-VINDO!</b>\n\nClique em /servidores', {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: '📋 Ver Servidores', callback_data: 'show_servers' }]]
        }
    });
});

bot.onText(/\/servidores/, async (msg) => {
    await showServers(msg.chat.id);
});

async function showServers(chatId) {
    const servers = await getServers();
    if (!servers.length) {
        bot.sendMessage(chatId, '❌ Sem servidores');
        return;
    }
    
    let text = '📡 <b>SERVIDORES:</b>\n\n';
    const buttons = [];
    
    servers.forEach(s => {
        text += `${s.host} (${s.count})\n`;
        buttons.push([{ text: s.host, callback_data: `select_server|${s.host}|1` }]);
    });
    
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data === 'show_servers') {
        await showServers(chatId);
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
            
            const msg = `
<b>📌 ID:</b> <code>${c.id}</code>

<b>🌐 HOST:</b> <code>${c.host}</code>
<b>👤 USER:</b> <code>${c.username}</code>
<b>🔑 PASS:</b> <code>${c.password}</code>

<b>⏱️ CRIADA:</b> ${dataCria}
<b>📆 EXPIRA:</b> ${dataExp}
<b>⏰ DIAS:</b> <b>${dias}</b>

<b>🔌 ATIVAS:</b> ${c.con_ativas}/${c.max_con}

<b>📱 EM USO:</b> ${emUso}

<b>🔗 M3U:</b>
<code>${c.m3u_url}</code>
            `.trim();
            
            const botoes = [
                [
                    { text: '📋 Copiar', callback_data: `copy|${c.id}` },
                    { text: '◀️ Voltar', callback_data: `select_server|${c.host}|1` }
                ]
            ];
            
            // Botão de marcar/desmarcar em uso
            if (c.in_use) {
                botoes.push([{ text: '🔴 Marcar como NÃO Usado', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
            } else {
                botoes.push([{ text: '🟢 Marcar como USADO', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
            }
            
            bot.sendMessage(chatId, msg, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: botoes
                }
            });
        }
    } else if (data.startsWith('copy|')) {
        const id = data.split('|')[1];
        const result = await getAccountDetails(id);
        
        if (result && result.ok) {
            const c = result.conta;
            const dataExp = formatarData(c.expira);
            const dataCria = formatarData(c.criada);
            const dias = calcularDias(c.expira);
            const emUso = c.in_use ? 'SIM' : 'NÃO';
            
            const txt = `ID: ${c.id}
HOST: ${c.host}
USER: ${c.username}
PASS: ${c.password}
CRIADA: ${dataCria}
EXPIRA: ${dataExp}
DIAS: ${dias}
ATIVAS: ${c.con_ativas}/${c.max_con}
EM USO: ${emUso}
M3U: ${c.m3u_url}`;
            
            bot.sendMessage(chatId, `<pre>${txt}</pre>`, { parse_mode: 'HTML' });
        }
    } else if (data.startsWith('toggle_in_use|')) {
        const [, id, host] = data.split('|');
        const result = await getAccountDetails(id);
        
        if (result && result.ok) {
            const c = result.conta;
            let updateResult;
            
            if (c.in_use) {
                updateResult = await desmarcarEmUso(id);
            } else {
                updateResult = await marcarEmUso(id);
            }
            
            if (updateResult && updateResult.ok) {
                const novoStatus = c.in_use ? 'NÃO Usado' : 'USADO';
                bot.answerCallbackQuery(query.id, `✅ Marcado como ${novoStatus}!`, true);
                
                // Atualizar a mensagem
                await bot.editMessageText(
                    `<b>📌 ID:</b> <code>${id}</code>\n\n✅ <b>Status atualizado com sucesso!</b>\n\nAgora aparecerá no painel.`,
                    { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML' }
                );
            } else {
                bot.answerCallbackQuery(query.id, '❌ Erro ao atualizar', true);
            }
        }
    } else if (data.startsWith('page|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
    }
    
    bot.answerCallbackQuery(query.id);
});

async function showAccounts(chatId, host, page = 1) {
    const result = await getAccounts(host, page);
    
    if (!result) {
        bot.sendMessage(chatId, '❌ Erro');
        return;
    }
    
    let text = `🌐 ${host}\n📊 Pág ${result.page}/${result.pages}\n\n`;
    const buttons = [];
    
    result.contas.forEach(c => {
        const exp = formatarData(c.expira);
        const dias = calcularDias(c.expira);
        const status = dias > 0 ? '✅' : '❌';
        const emUso = c.in_use ? '📱' : '  ';
        text += `${status} ${emUso} #${c.id} | ${exp} | ${dias}d\n`;
        buttons.push([{ text: `📌 #${c.id} (${dias}d)`, callback_data: `view_account|${c.id}` }]);
    });
    
    const nav = [];
    if (result.page > 1) nav.push({ text: '⬅️ Ant', callback_data: `page|${host}|${result.page - 1}` });
    if (result.page < result.pages) nav.push({ text: 'Prox ➡️', callback_data: `page|${host}|${result.page + 1}` });
    nav.push({ text: '🏠 Menu', callback_data: 'show_servers' });
    buttons.push(nav);
    
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

bot.onText(/\/ajuda/, (msg) => {
    bot.sendMessage(msg.chat.id, '📚 <b>AJUDA</b>\n\n/start\n/servidores\n/ajuda\n\n📱 Clique em "Marcar como USADO" para indicar que já está usando a conta.', { parse_mode: 'HTML' });
});

console.log('✅ Bot aguardando mensagens...');
