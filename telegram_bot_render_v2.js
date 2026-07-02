const { Telegraf } = require('telegraf');
const axios = require('axios');

// ===================== CONFIGURAÇÃO ======================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'SEU_TOKEN_AQUI';
const API_URL = 'https://mundofiaspo.com/gestor/telegram_api.php';
const bot = new Telegraf(TOKEN);

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
bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        await axios.post(`${API_URL}?action=register_user`, {
            user_id: userId,
            username: ctx.from.username || 'N/A',
            first_name: ctx.from.first_name || 'N/A'
        });
    } catch (e) {
        console.log('Erro ao registrar usuário:', e.message);
    }
    
    const welcomeText = `🎯 <b>BEM-VINDO AO BOT DE CONTAS IPTV</b>

Use este bot para consultar contas IPTV por servidor.

<b>Comandos disponíveis:</b>
/start - Exibe este menu
/servidores - Lista todos os servidores
/ajuda - Mostra ajuda

Clique em /servidores para começar! 👇`;
    
    await ctx.replyWithHTML(welcomeText, {
        reply_markup: {
            inline_keyboard: [[
                { text: '📋 Ver Servidores', callback_data: 'show_servers' }
            ]]
        }
    });
});

// ===================== COMANDO: SERVIDORES ======================
bot.command('servidores', async (ctx) => {
    await showServers(ctx);
});

async function showServers(ctx) {
    const servers = await getServers();
    
    if (servers.length === 0) {
        await ctx.reply('❌ Nenhum servidor encontrado.');
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
    
    await ctx.replyWithHTML(text, {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
}

// ===================== COMANDO: AJUDA ======================
bot.command('ajuda', async (ctx) => {
    const helpText = `<b>📚 AJUDA - BOT DE CONTAS IPTV</b>

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

Dúvidas? Entre em contato com o admin! 📞`;
    
    await ctx.replyWithHTML(helpText);
});

// ===================== COMANDO: ANALISAR ======================
bot.command('analisar', async (ctx) => {
    const servers = await getServers();
    
    if (servers.length === 0) {
        await ctx.reply('❌ Nenhum servidor encontrado.');
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
    
    await ctx.replyWithHTML(text, {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
});

// ===================== CALLBACK QUERIES ======================
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    if (data === 'show_servers') {
        await showServers(ctx);
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('select_server|')) {
        const [, host, page] = data.split('|');
        await showAccounts(ctx, host, parseInt(page));
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('view_account|')) {
        const id = data.split('|')[1];
        const result = await getAccountDetails(id);
        
        if (result && result.ok) {
            await ctx.replyWithHTML(result.mensagem, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '◀️ Voltar', callback_data: `select_server|${result.conta.host}|1` }
                    ]]
                }
            });
        } else {
            await ctx.reply('❌ Erro ao carregar dados da conta.');
        }
        
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('analisar_host|')) {
        const host = data.split('|')[1];
        await ctx.editMessageText('⏳ Analisando todas as contas deste host...\n\nIsso pode levar alguns minutos...');
        await analisarHostCompleto(ctx, host);
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('page|')) {
        const [, host, page] = data.split('|');
        await showAccounts(ctx, host, parseInt(page));
        await ctx.answerCbQuery();
        return;
    }
});

async function showAccounts(ctx, host, page = 1) {
    const result = await getAccounts(host, page);
    
    if (!result || !result.ok) {
        await ctx.reply('❌ Erro ao carregar contas.');
        return;
    }
    
    if (result.contas.length === 0) {
        await ctx.reply(`❌ Nenhuma conta encontrada para ${host}`);
        return;
    }
    
    let text = `🌐 <b>SERVIDOR:</b> ${host}\n`;
    text += `📊 Página ${result.page} de ${result.pages}\n\n`;
    
    const buttons = [];
    
    result.contas.forEach((conta) => {
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
    
    await ctx.replyWithHTML(text, {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
}

// ===================== FUNÇÃO: ANALISAR HOST COMPLETO ======================
async function analisarHostCompleto(ctx, host) {
    try {
        const res = await axios.get(`${API_URL}?action=get_all_accounts&host=${encodeURIComponent(host)}`);
        
        if (!res.data.ok) {
            await ctx.reply('❌ Erro ao obter contas: ' + res.data.erro);
            return;
        }
        
        const contas = res.data.contas || [];
        
        if (contas.length === 0) {
            await ctx.editMessageText(`❌ Nenhuma conta encontrada para ${host}`);
            return;
        }
        
        let ativas = 0;
        let expiradas = 0;
        
        for (let i = 0; i < contas.length; i++) {
            if (i % 10 === 0) {
                await ctx.editMessageText(
                    `⏳ Analisando... ${i}/${contas.length}\n\n` +
                    `✅ Ativas: ${ativas}\n` +
                    `❌ Inativas: ${expiradas}`
                );
            }
            
            try {
                const analise = await axios.get(`${API_URL}?action=analisar_conta&id=${contas[i].id}`);
                if (analise.data.ok && (analise.data.renovada || analise.data.status === 'ativa')) {
                    ativas++;
                } else {
                    expiradas++;
                }
            } catch (e) {
                expiradas++;
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
        
        const resultado = `<b>✅ ANÁLISE CONCLUÍDA!</b>

🌐 <b>Host:</b> ${host}
📊 <b>Analisadas:</b> ${ativas + expiradas}/${contas.length}

<b>Resultado:</b>
✅ <b>Ativas:</b> ${ativas}
❌ <b>Inativas:</b> ${expiradas}

📈 <b>Taxa:</b> ${((ativas / contas.length) * 100).toFixed(1)}% ativa`;
        
        await ctx.editMessageText(resultado, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🏠 Menu', callback_data: 'show_servers' }
                ]]
            }
        });
        
    } catch (error) {
        console.error('Erro ao analisar host:', error.message);
        await ctx.reply('❌ Erro ao analisar: ' + error.message);
    }
}

// ===================== INICIAR BOT ======================
bot.launch();

console.log('🤖 Bot iniciado com sucesso!');
console.log(`📡 API URL: ${API_URL}`);
console.log('Aguardando mensagens...');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
