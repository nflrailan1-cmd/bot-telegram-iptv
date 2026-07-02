const https = require('https');

const BOT_URL = process.env.BOT_URL || 'https://bot-telegram-iptv.onrender.com';

function keepAlive() {
    const url = new URL(BOT_URL);
    
    const options = {
        hostname: url.hostname,
        port: 443,
        path: '/',
        method: 'GET',
        timeout: 5000
    };
    
    const req = https.request(options, (res) => {
        console.log(`✅ Keepalive ping: ${res.statusCode}`);
    });
    
    req.on('error', (e) => {
        console.error(`❌ Keepalive erro: ${e.message}`);
    });
    
    req.setTimeout(5000, () => {
        req.destroy();
    });
    
    req.end();
}

// Executar a cada 14 minutos
setInterval(keepAlive, 14 * 60 * 1000);
keepAlive();

console.log('⏰ Keepalive iniciado (a cada 14 minutos)');
