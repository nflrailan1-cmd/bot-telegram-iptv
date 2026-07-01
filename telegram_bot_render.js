const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Variáveis de ambiente (Render fornece)
const TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = process.env.API_URL;

if (!TOKEN || !API_URL) {
    console.error('❌ Erro: TOKEN ou API_URL não configurados!');
    console.error('Defina as variáveis de ambiente no Render Dashboard');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const userStates = {};

console.log('🤖 Bot iniciado com sucesso!');
console.log('📡 API URL:', API_URL);
console.log('Aguardando mensagens...');

// ===================== FUNÇÕES AUXILIARES ======================
async function getServers() {
    try {
        const res = await axios.get(`${API_URL}?action=get_servers`);
        return res.data.servers || [];
    } catch (error) {
        console.error('Erro ao obter servidores:', error.message);
        return [];
    }
}

async function getAccounts(host, page = 1) {
    try {
        const res = await axios.get(`${API_URL}?action=get_accounts&host=${encodeURIComponent(host)}&page=${page}`);
        return res.data;
    } catch (error) {
        console.error('Erro ao obter contas:', error.message);
        return null;
    }
}

async function getAccountDetails(id) {
    try {
        const res = await axios.get(`${API_URL}?action=format_account&id=${id}`);
        return res.data;
    } catch (error) {
        console.error('Erro ao obter detalhes:', error.message);
        return null;
    }
}

// Formatar data para DD/MM/YYYY
function formatarData(data) {
    if (!data) return '-';
    const d = new Date(data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

// Calcular dias restantes
function calcularDias(dataExpira) {
    if (!dataExpira) return 0;
    const hoje = new Date();
    const expira = new Date(dataExpira);
    const diff = expira - hoje;
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return dias > 0 ? dias : 0;
}

// ===================== COMANDO: START ======================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Registrar usuário
    try {
        await axios.post(`${API_URL}?action=register_user`, {
            user_id: userId,
            username: msg.from.username || 'N/A',
            first_name: msg.from.first_name || 'N/A'
        });
    } catch (e) {
        console.log('Erro ao registrar usuário:', e.message);
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
        buttons.push([{
            text: `${server.host}`,
            callback_data: `select_server|${server.host}|1`
        }]);
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
            const conta = result.conta;
            
            // Formatar dados melhorados
            const dataExpira = formatarData(conta.expira);
            const dataCriada = formatarData(conta.criada);
            const diasRestantes = calcularDias(conta.expira);
            
            let mensagem = `
<b>📌 ID:</b> <code>${conta.id}</code>

<b>🌐 HOST:</b> <code>${conta.host}</code>
<b>👤 USER:</b> <code>${conta.username}</code>
<b>🔑 PASS:</b> <code>${conta.password}</code>

<b>⏱️ CRIADA:</b> ${dataCriada}
<b>📆 EXPIRA:</b> ${dataExpira}
<b>⏰ DIAS RESTANTES:</b> <b>${diasRestantes} dias</b>

<b>🔌 CON.ATIVAS:</b> ${conta.con_ativas}/${conta.max_con}

<b>🔗 M3U LINK:</b>
<code>${conta.m3u_url}</code>
            `.trim();
            
            // Botão para copiar dados
            bot.sendMessage(chatId, mensagem, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📋 Copiar Dados', callback_data: `copy_account|${conta.id}` },
                        { text: '◀️ Voltar', callback_data: `select_server|${conta.host}|1` }
                    ]]
                }
            });
        } else {
            bot.sendMessage(chatId, '❌ Erro ao carregar dados da conta.');
        }
        
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    if (data.startsWith('copy_account|')) {
        const id = data.split('|')[1];
        const result = await getAccountDetails(id);
        
        if (result && result.ok) {
            const conta = result.conta;
            const dataCriada = formatarData(conta.criada);
            const dataExpira = formatarData(conta.expira);
            const diasRestantes = calcularDias(conta.expira);
            
            // Formatar dados para cópia
            const dadosCopia = `ID: ${conta.id}
HOST: ${conta.host}
USER: ${conta.username}
PASS: ${conta.password}
CRIADA: ${dataCriada}
EXPIRA: ${dataExpira}
DIAS RESTANTES: ${diasRestantes} dias
CONEXÕES: ${conta.con_ativas}/${conta.max_con}
M3U: ${conta.m3u_url}`;
            
            bot.sendMessage(chatId, `<pre>${dadosCopia}</pre>`, {
                parse_mode: 'HTML'
            });
            
            bot.answerCallbackQuery(query.id, '✅ Dados prontos para copiar!', true);
        } else {
            bot.answerCallbackQuery(query.id, '❌ Erro ao copiar dados', true);
        }
        return;
    }
    
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
        bot.sendMessage(chatId, `❌ Nenhuma conta encontrada para ${host}`);
        return;
    }
    
    let text = `🌐 <b>SERVIDOR:</b> ${host}\n`;
    text += `📊 Página ${result.page} de ${result.pages}\n\n`;
    text += `<b>CONTAS DISPONÍVEIS:</b>\n\n`;
    
    const buttons = [];
    
    result.contas.forEach((conta, index) => {
        const dataExpira = formatarData(conta.expira);
        const diasRestantes = calcularDias(conta.expira);
        const status = diasRestantes > 0 ? '✅' : '❌';
        
        text += `${status} <b>ID #${conta.id}</b> | Exp: ${dataExpira} | ${diasRestantes} dias\n`;
        
        buttons.push([{
            text: `📌 ID #${conta.id} (${diasRestantes}d)`,
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
1. Digite /servidores para ver lista de servidores
2. Clique no servidor desejado
3. Clique no ID da conta para ver detalhes completos
4. Use "Copiar Dados" para copiar todas as informações
5. Use "Próximo/Anterior" para paginar

<b>Dados exibidos:</b>
🔸 <b>ID</b> - Número da conta
🌐 <b>HOST</b> - Endereço do servidor
👤 <b>USER</b> - Usuário da conta
🔑 <b>PASS</b> - Senha da conta
⏱️ <b>CRIADA</b> - Data de criação
📆 <b>EXPIRA</b> - Data de expiração
⏰ <b>DIAS RESTANTES</b> - Exato de dias
🔌 <b>CON.ATIVAS</b> - Conexões ativas
👥 <b>MAX.CON</b> - Máximo de conexões
🔗 <b>M3U</b> - Link completo da lista

<b>Comandos:</b>
/start - Inicia o bot
/servidores - Lista servidores
/ajuda - Esta mensagem

<b>Botões:</b>
📋 Copiar Dados - Copia todas as informações
◀️ Voltar - Volta para lista de contas
🏠 Menu - Volta para menu de servidores

Dúvidas? Entre em contato com o admin! 📞
    `.trim();
    
    bot.sendMessage(chatId, helpText, {
        parse_mode: 'HTML'
    });
});

// ===================== TRATAMENTO DE ERROS ======================
bot.on('polling_error', (error) => {
    console.error('Erro no polling:', error);
});

bot.on('error', (error) => {
    console.error('Erro do bot:', error);
});

console.log('✅ Bot pronto e aguardando mensagens...');
