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

// Armazenar estado de upload
const userStates = {};

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

// Importar arquivo TXT
async function importarArquivo(fileContent) {
    try {
        const res = await axios.post(`${API_URL}?action=import_file`, 
            { conteudo: fileContent },
            { headers: { 'Content-Type': 'application/json' } }
        );
        return res.data;
    } catch (e) {
        console.error('Erro ao importar:', e.message);
        return { ok: false, erro: e.message };
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
    
    bot.sendMessage(chatId, '🎯 <b>BEM-VINDO!</b>\n\n📋 /servidores\n📤 /importar\n❓ /ajuda', {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 Ver Servidores', callback_data: 'show_servers' }],
                [{ text: '📤 Importar TXT', callback_data: 'import_menu' }]
            ]
        }
    });
});

bot.onText(/\/servidores/, async (msg) => {
    await showServers(msg.chat.id);
});

bot.onText(/\/importar/, async (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = 'awaiting_file';
    
    bot.sendMessage(chatId, '📤 <b>IMPORTAR ARQUIVO</b>\n\nEnvie um arquivo .TXT com as contas:\n\n<code>NΔTΔN\n├🔸🌐 𝐇𝐎𝐒𝐓 = http://host:80\n├♦️👤 𝐔𝐒𝐄𝐑 = usuario\n├🔸🔑 𝐏𝐀𝐒𝐒 = senha\n...</code>', {
        parse_mode: 'HTML'
    });
});

bot.onText(/\/ajuda/, (msg) => {
    bot.sendMessage(msg.chat.id, 
`📚 <b>AJUDA</b>

<b>Comandos:</b>
/start - Menu inicial
/servidores - Ver servidores
/importar - Importar arquivo TXT
/ajuda - Esta mensagem

<b>Importar TXT:</b>
1. /importar
2. Envie um arquivo .TXT
3. Bot processa e carrega no servidor

<b>Marcar em Uso:</b>
- Clique em "Marcar como USADO" para indicar que está usando a conta
- Aparecerá no painel com status "Em uso"

<b>Formatos:</b>
✅ Formato UPA.txt com texto negrito
✅ Formato emoji tradicional
✅ Qualquer formato com HOST, USER, PASS`, 
        { parse_mode: 'HTML' }
    );
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
    } else if (data === 'import_menu') {
        userStates[chatId] = 'awaiting_file';
        bot.sendMessage(chatId, '📤 Envie um arquivo .TXT para importar:', { reply_markup: { remove_keyboard: true } });
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
            
            if (c.in_use) {
                botoes.push([{ text: '🔴 Marcar como NÃO Usado', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
            } else {
                botoes.push([{ text: '🟢 Marcar como USADO', callback_data: `toggle_in_use|${c.id}|${c.host}` }]);
            }
            
            bot.sendMessage(chatId, msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: botoes }
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
            
            if (c.in_use) {
                await desmarcarEmUso(id);
            } else {
                await marcarEmUso(id);
            }
            
            const novoStatus = c.in_use ? 'NÃO Usado' : 'USADO';
            bot.answerCallbackQuery(query.id, `✅ Marcado como ${novoStatus}!`, true);
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

// Receber arquivo
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name || 'arquivo';
    
    if (userStates[chatId] !== 'awaiting_file') {
        bot.sendMessage(chatId, '❌ Use /importar para fazer upload de arquivo');
        return;
    }
    
    // Verificar se é arquivo TXT
    if (!fileName.toLowerCase().endsWith('.txt')) {
        bot.sendMessage(chatId, '❌ Envie apenas arquivo .TXT');
        return;
    }
    
    try {
        bot.sendMessage(chatId, '⏳ Processando arquivo...');
        
        // Baixar arquivo
        const fileStream = await bot.getFileStream(fileId);
        let fileContent = '';
        
        fileStream.on('data', (chunk) => {
            fileContent += chunk.toString();
        });
        
        fileStream.on('end', async () => {
            // Importar arquivo
            const resultado = await importarArquivo(fileContent);
            
            if (resultado.ok) {
                bot.sendMessage(chatId, `
✅ <b>ARQUIVO IMPORTADO COM SUCESSO!</b>

📊 <b>Resumo:</b>
• Contas adicionadas: ${resultado.adicionadas || 0}
• Contas atualizadas: ${resultado.atualizadas || 0}
• Erros: ${resultado.erros || 0}

🎯 As contas já estão disponíveis no servidor!`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[{ text: '📋 Ver Servidores', callback_data: 'show_servers' }]]
                    }
                });
            } else {
                bot.sendMessage(chatId, `❌ <b>Erro ao importar:</b>\n${resultado.erro || 'Erro desconhecido'}`, {
                    parse_mode: 'HTML'
                });
            }
            
            delete userStates[chatId];
        });
        
        fileStream.on('error', (err) => {
            bot.sendMessage(chatId, `❌ Erro ao baixar arquivo: ${err.message}`);
            delete userStates[chatId];
        });
        
    } catch (e) {
        bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
        delete userStates[chatId];
    }
});

console.log('✅ Bot aguardando mensagens...');
