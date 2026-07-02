const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ===================== CONFIGURAÇÃO ======================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'SEU_TOKEN_AQUI';
const API_URL = 'https://seu-painel.com/telegram_api.php'; // Altere para sua URL
const bot = new TelegramBot(TOKEN, { polling: true });

// Armazenar estado dos usuários
const userStates = {};

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
    
    // Mostrar "digitando"
    bot.sendChatAction(chatId, 'typing');
    
    if (data === 'show_servers') {
        await showServers(chatId);
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // Select server | host | page
    if (data.startsWith('select_server|')) {
        const [, host, page] = data.split('|');
        await showAccounts(chatId, host, parseInt(page));
        bot.answerCallbackQuery(query.id);
        return;
    }
    
    // View account detail | id
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
    
    // Analisar host completo
    if (data.startsWith('analisar_host|')) {
        const host = data.split('|')[1];
        
        bot.editMessageText('⏳ Analisando todas as contas deste host...\n\nIsso pode levar alguns minutos...', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
        });
        
        await analisarHostCompleto(chatId, host, query.message.message_id);
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
        bot.sendMessage(chatId, `❌ Nenhuma conta encontrada para ${host}`);
        return;
    }
    
    let text = `🌐 <b>SERVIDOR:</b> ${host}\n`;
    text += `📊 Página ${result.page} de ${result.pages}\n\n`;
    
    const buttons = [];
    
    result.contas.forEach((conta, index) => {
        const expira = conta.expira ? new Date(conta.expira).toLocaleDateString('pt-BR') : '-';
        const status = conta.dias_restantes > 0 ? '✅' : '❌';
        
        text += `${status} <b>#${conta.id}</b> | ${conta.username}\n`;
        text += `   Exp: ${expira} (${conta.dias_restantes} dias)\n`;
        text += `   Con: ${conta.con_ativas}/${conta.max_con}\n\n`;
        
        buttons.push([{
            text: `📌 ID #${conta.id}`,
            callback_data: `view_account|${conta.id}`
        }]);
    });
    
    // Botões de paginação
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
4. Use "Próximo/Anterior" para paginar

<b>Dados exibidos:</b>
🌐 HOST - Endereço do servidor
👤 USER - Usuário da conta
🔑 PASS - Senha da conta
🔌 CON.ATIVAS - Conexões ativas
👥 MAX.CON - Máximo de conexões
⏱️ CRIADA - Data de criação
📆 EXPIRA - Data de expiração
⏰ DIAS - Dias restantes
🔗 M3U - Link da lista

<b>Comandos:</b>
/start - Inicia o bot
/servidores - Lista servidores
/analisar - Analisa todas as contas de um host
/ajuda - Esta mensagem

Dúvidas? Entre em contato com o admin! 📞
    `.trim();
    
    bot.sendMessage(chatId, helpText, {
        parse_mode: 'HTML'
    });
});

// ===================== COMANDO: ANALISAR ======================
bot.onText(/\/analisar/, async (msg) => {
    const chatId = msg.chat.id;
    const servers = await getServers();
    
    if (servers.length === 0) {
        bot.sendMessage(chatId, '❌ Nenhum servidor encontrado.');
        return;
    }
    
    let text = `🔍 <b>SELECIONE UM HOST PARA ANALISAR:</b>\n\n`;
    const buttons = [];
    
    servers.forEach((server) => {
        text += `🌐 ${server.host}\n`;
        buttons.push([{
            text: `Analisar ${server.host}`,
            callback_data: `analisar_host|${server.host}`
        }]);
    });
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: buttons
        }
    });
});

// ===================== FUNÇÃO: ANALISAR HOST COMPLETO ======================
async function analisarHostCompleto(chatId, host, messageId) {
    try {
        // Buscar todas as contas do host
        const res = await axios.get(`${API_URL}?action=get_all_accounts&host=${encodeURIComponent(host)}`);
        
        if (!res.data.ok) {
            bot.sendMessage(chatId, '❌ Erro ao obter contas: ' + res.data.erro);
            return;
        }
        
        const contas = res.data.contas || [];
        
        if (contas.length === 0) {
            bot.editMessageText(`❌ Nenhuma conta encontrada para ${host}`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML'
            });
            return;
        }
        
        let ativas = 0;
        let expiradas = 0;
        let analisadas = 0;
        
        // Analisar cada conta
        for (let i = 0; i < contas.length; i++) {
            const conta = contas[i];
            
            // Mostrar progresso a cada 10 contas
            if (i % 10 === 0) {
                bot.editMessageText(
                    `⏳ Analisando... ${i}/${contas.length}\n\n` +
                    `✅ Ativas: ${ativas}\n` +
                    `❌ Inativas: ${expiradas}`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'HTML'
                    }
                );
            }
            
            // Chamar API para analisar
            try {
                const analise = await axios.get(`${API_URL}?action=analisar_conta&id=${conta.id}`);
                
                if (analise.data.ok) {
                    if (analise.data.renovada || analise.data.status === 'ativa') {
                        ativas++;
                    } else {
                        expiradas++;
                    }
                } else {
                    expiradas++;
                }
                analisadas++;
            } catch (e) {
                expiradas++;
                analisadas++;
            }
            
            // Delay entre requisições (não sobrecarrega o servidor)
            await new Promise(r => setTimeout(r, 500));
        }
        
        // Resultado final
        const resultado = `
<b>✅ ANÁLISE CONCLUÍDA!</b>

🌐 <b>Host:</b> ${host}
📊 <b>Analisadas:</b> ${analisadas}/${contas.length}

<b>Resultado:</b>
✅ <b>Ativas:</b> ${ativas}
❌ <b>Inativas:</b> ${expiradas}

📈 <b>Taxa:</b> ${((ativas / contas.length) * 100).toFixed(1)}% ativa
        `.trim();
        
        bot.editMessageText(resultado, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🏠 Menu', callback_data: 'show_servers' }
                ]]
            }
        });
        
    } catch (error) {
        console.error('Erro ao analisar host:', error.message);
        bot.sendMessage(chatId, '❌ Erro ao analisar: ' + error.message);
    }
}

// ===================== TRATAMENTO DE ERROS ======================
bot.on('polling_error', (error) => {
    console.error('Erro no polling:', error);
});

bot.on('error', (error) => {
    console.error('Erro do bot:', error);
});

console.log('🤖 Bot iniciado com sucesso!');
console.log(`📡 API URL: ${API_URL}`);
console.log('Aguardando mensagens...');
