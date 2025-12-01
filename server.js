const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos de la carpeta 'public'
app.use(express.static('public'));

let tiktokConnection = null;

// ---------------------------------------------------------
// GESTIÓN DE SOCKETS
// ---------------------------------------------------------
io.on('connection', (socket) => {
    console.log('Cliente web conectado');

    socket.on('setTiktokUser', (username) => {
        connectToTikTok(username);
    });
});

// ---------------------------------------------------------
// LÓGICA DE TIKTOK
// ---------------------------------------------------------
function connectToTikTok(username) {
    if (tiktokConnection && tiktokConnection.username === username) {
        console.log(`Ya estabas conectado a ${username}`);
        return;
    }

    if (tiktokConnection) {
        tiktokConnection.disconnect();
    }

    console.log(`Iniciando conexión con: @${username}`);
    let connection = new WebcastPushConnection(username);

    connection.connect().then(state => {
        console.info(`✅ Conectado exitosamente al Room ID: ${state.roomId}`);
        tiktokConnection = connection;
        tiktokConnection.username = username;
    }).catch(err => {
        console.error('❌ Error al conectar con TikTok:', err);
    });

    // --- ESCUCHAR REGALOS ---
    connection.on('gift', (data) => {
        if (data.giftType === 1 && !data.repeatEnd) {
            return;
        }

        const giftName = data.giftName.toLowerCase();
        const multiplier = data.repeatCount || 1;

        // console.log(`🎁 RECIBIDO: ${giftName} (x${multiplier})`); // Descomentar para depurar

        let basePower = 0;
        let team = '';

        // --- EQUIPO GIRLS (Izquierda) ---
        if (giftName === 'rose') {
            team = 'girl';
            basePower = 1; // FUERZA CAMBIADA A 1
        } 
        // Puedes añadir más regalos aquí
        // else if (giftName === 'otro_regalo_girl') { team = 'girl'; basePower = 5; }


        // --- EQUIPO BOYS (Derecha) ---
        // CAMBIO AQUÍ: Ahora detecta 'tiktok' en lugar de 'gg'
        else if (giftName === 'tiktok') {
            team = 'boy';
            basePower = 1; // FUERZA CAMBIADA A 1
        } 
        // Puedes añadir más regalos aquí
        // else if (giftName === 'otro_regalo_boy') { team = 'boy'; basePower = 5; }


        // 4. ENVIAR A LA WEB
        if (team !== '' && basePower > 0) {
            const totalPower = basePower * multiplier;
            console.log(`⚡ Acción: ${team} empuja con fuerza ${totalPower}`);
            
            io.emit('gameUpdate', { 
                team: team, 
                power: totalPower 
            });
        }
    });
}

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});
