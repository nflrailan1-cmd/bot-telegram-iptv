const { Telegraf } = require('telegraf');
const axios = require('axios');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = 'https://mundofiaspo.com/gestor/telegram_api.php';

if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não configurado!');
    process.exit(1);
}

const bot = new Telegraf(TOKEN);

// Funções auxiliares
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

// Comandos
bot.command('start', async (ctx) => {
    try {
        await axios.post(`${API_URL}?action=register_user`, {
            user_id: ctx.from.id,
            username: ctx.from.username || 'N/A',
            first_name: ctx.from.first_name || 'N/A'
        }, { timeout: 5000 });
    } catch (e) {
        console.log('Erro ao registrar:', e.message);
    }
    
    await ctx.replyWithHTML(
        `🎯 <b>BEM-VINDO!</b>\n\nUse /servidores para começar!`,
        { reply_markup: { inline_keyboard: [[{ text: '📋 Servidores', callback_data: 'show_servers' }]]} }
    );
});

bot.command('servidores', async (ctx) => {
    const servers = await getServers();
    if (servers.length === 0) {
        await ctx.reply('❌ Nenhum servidor');
        return;
    }
    let text = '📡 <b>SERVIDORES:</b>\n\n';
    const buttons = servers.map(s => [{ text: s.host, callback_data: `select_server|${s.host}|1` }]);
    await ctx.replyWithHTML(text + servers.map((s, i) => `${i+1}. ${s.host} (${s.count})`).join('\n'), 
        { reply_markup: { inline_keyboard: buttons } });
});

bot.command('ajuda', async (ctx) => {
    await ctx.replyWithHTML(`<b>📚 AJUDA</b>\n\n/start - Menu\n/servidores - Lista\n/analisar - Analisar`);
});

bot.command('analisar', async (ctx) => {
    const servers = await getServers();
    if (servers.length === 0) {
        await ctx.reply('❌ Nenhum servidor');
        return;
    }
    const buttons = servers.map(s => [{ text: `Analisar ${s.host}`, callback_data: `analisar_host|${s.host}` }]);
    await ctx.replyWithHTML('🔍 <b>ANALISAR:</b>', { reply_markup: { inline_keyboard: buttons } });
});

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    if (data === 'show_servers') {
        const servers = await getServers();
        let text = '📡 <b>SERVIDORES:</b>\n\n';
        const buttons = servers.map(s => [{ text: s.host, callback_data: `select_server|${s.host}|1` }]);
        await ctx.editMessageText(text + servers.map((s, i) => `${i+1}. ${s.host}`).join('\n'), 
            { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('select_server|')) {
        const [, host, page] = data.split('|');
        const result = await getAccounts(host, parseInt(page));
        if (!result || !result.ok) {
            await ctx.reply('❌ Erro ao carregar');
            return;
        }
        let text = `🌐 ${host}\n📊 Página ${result.page}/${result.pages}\n\n`;
        const buttons = result.contas.map(c => [{ text: `#${c.id}`, callback_data: `view_account|${c.id}` }]);
        const nav = [];
        if (result.page > 1) nav.push({ text: '⬅️', callback_data: `page|${host}|${result.page-1}` });
        if (result.page < result.pages) nav.push({ text: '➡️', callback_data: `page|${host}|${result.page+1}` });
        nav.push({ text: '🏠', callback_data: 'show_servers' });
        buttons.push(nav);
        await ctx.editMessageText(text + result.contas.map(c => `✅ ${c.username}`).join('\n'), 
            { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('view_account|')) {
        const result = await getAccountDetails(data.split('|')[1]);
        if (result && result.ok) {
            await ctx.replyWithHTML(result.mensagem, 
                { reply_markup: { inline_keyboard: [[{ text: '◀️ Voltar', callback_data: `select_server|${result.conta.host}|1` }]]} });
        }
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('analisar_host|')) {
        const host = data.split('|')[1];
        await ctx.editMessageText('⏳ Analisando...');
        const res = await axios.get(`${API_URL}?action=get_all_accounts&host=${encodeURIComponent(host)}`, { timeout: 10000 });
        if (!res.data.ok) {
            await ctx.reply('❌ Erro');
            return;
        }
        const contas = res.data.contas || [];
        let ativas = 0, expiradas = 0;
        for (let i = 0; i < contas.length; i++) {
            if (i % 20 === 0) {
                await ctx.editMessageText(`⏳ ${i}/${contas.length}\n✅ ${ativas}\n❌ ${expiradas}`);
            }
            try {
                const a = await axios.get(`${API_URL}?action=analisar_conta&id=${contas[i].id}`, { timeout: 5000 });
                if (a.data.ok && (a.data.renovada || a.data.status === 'ativa')) ativas++;
                else expiradas++;
            } catch { expiradas++; }
            await new Promise(r => setTimeout(r, 300));
        }
        await ctx.editMessageText(
            `<b>✅ CONCLUÍDO</b>\n\n🌐 ${host}\n✅ Ativas: ${ativas}\n❌ Inativas: ${expiradas}\n📈 ${((ativas/contas.length)*100).toFixed(1)}%`,
            { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🏠', callback_data: 'show_servers' }]]} }
        );
        await ctx.answerCbQuery();
        return;
    }
    
    if (data.startsWith('page|')) {
        const [, host, page] = data.split('|');
        const result = await getAccounts(host, parseInt(page));
        if (!result || !result.ok) {
            await ctx.reply('❌ Erro');
            return;
        }
        let text = `🌐 ${host}\n📊 ${result.page}/${result.pages}\n\n`;
        const buttons = result.contas.map(c => [{ text: `#${c.id}`, callback_data: `view_account|${c.id}` }]);
        const nav = [];
        if (result.page > 1) nav.push({ text: '⬅️', callback_data: `page|${host}|${result.page-1}` });
        if (result.page < result.pages) nav.push({ text: '➡️', callback_data: `page|${host}|${result.page+1}` });
        nav.push({ text: '🏠', callback_data: 'show_servers' });
        buttons.push(nav);
        await ctx.editMessageText(text + result.contas.map(c => `${c.username}`).join('\n'), 
            { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
        await ctx.answerCbQuery();
        return;
    }
});

bot.launch();
console.log('✅ Bot iniciado!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
