const http = require('http');

// URL do seu bot no Render (substitua pela sua URL real)
const BOT_URL = process.env.BOT_URL || 'https://seu-bot.onrender.com';

// Faz requisição a cada 14 minutos (para não hibernar)
const INTERVAL = 14 * 60 * 1000; // 14 minutos

function keepAlive() {
    http.get(BOT_URL, (res) => {
        console.log(`[${new Date().toLocaleString()}] Keepalive - Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`[${new Date().toLocaleString()}] Keepalive Error: ${err.message}`);
    });
}

// Executa imediatamente e depois a cada intervalo
keepAlive();
setInterval(keepAlive, INTERVAL);

console.log(`✓ Keepalive iniciado. Requisições a cada ${INTERVAL / 60000} minutos`);
console.log(`  URL: ${BOT_URL}`);
