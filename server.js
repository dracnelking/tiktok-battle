const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos de la carpeta 'public'
app.use(express.static('public'));

// Variable para guardar la conexión activa y no duplicarla
let tiktokConnection = null;

// ---------------------------------------------------------
// GESTIÓN DE SOCKETS (COMUNICACIÓN CON LA WEB)
// ---------------------------------------------------------
io.on('connection', (socket) => {
    console.log('Cliente web conectado (OBS o Navegador)');

    // Esperar a que la web nos diga a qué usuario conectar
    socket.on('setTiktokUser', (username) => {
        connectToTikTok(username);
    });
});

// ---------------------------------------------------------
// LÓGICA DE TIKTOK
// ---------------------------------------------------------
function connectToTikTok(username) {
    // Si ya estamos conectados a ese usuario, no hacemos nada
    if (tiktokConnection && tiktokConnection.username === username) {
        console.log(`Ya estabas conectado a ${username}`);
        return;
    }

    // Si había otra conexión abierta, la cerramos para limpiar
    if (tiktokConnection) {
        console.log('Cerrando conexión anterior...');
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
        console.error('NOTA: Asegúrate de que el usuario está EN VIVO realmente.');
    });

    // --- ESCUCHAR REGALOS ---
    connection.on('gift', (data) => {
        // 1. FILTRO DE COMBOS
        // Si el regalo es parte de un combo (giftType 1) y NO ha terminado el combo, lo ignoramos.
        // Solo actuamos cuando repeatEnd es true (el usuario dejó de pulsar enviar).
        if (data.giftType === 1 && !data.repeatEnd) {
            return;
        }

        // 2. OBTENER DATOS
        const giftName = data.giftName.toLowerCase();
        const sender = data.uniqueId;
        // Si repeatCount no viene definido, asumimos que es 1 (regalo único)
        const multiplier = data.repeatCount || 1;

        console.log(`🎁 RECIBIDO: ${giftName} (x${multiplier}) de ${sender}`);

        // 3. CONFIGURACIÓN DE PODER
        // basePower: Cuánto mueve la pared 1 sola unidad del regalo.
        // Lo ponemos bajo (0.5) porque si envían un x100, moverá 50% de golpe.
        let basePower = 0;
        let team = '';

        // --- EQUIPO GIRLS (Rosa) ---
        if (giftName === 'rose') {
            team = 'girl';
            basePower = 0.5; // 1 Rosa = 0.5% de movimiento
        } 
        else if (giftName === 'money gun') { // Ejemplo de regalo caro
            team = 'girl';
            basePower = 10; // Pistola de dinero = 10% directo (se multiplica si envían varias)
        }

        // --- EQUIPO BOYS (Azul) ---
        else if (giftName === 'gg' || giftName.includes('dumbbell')) {
            team = 'boy';
            basePower = 0.5; // 1 GG = 0.5% de movimiento
        } 
        else if (giftName === 'corgi') { // Ejemplo de regalo caro para boys
            team = 'boy';
            basePower = 10; 
        }

        // 4. ENVIAR A LA WEB
        if (team !== '' && basePower > 0) {
            // Calculamos el empujón total
            const totalPower = basePower * multiplier;

            console.log(`⚡ Acción: ${team} empuja con fuerza ${totalPower}%`);
            
            io.emit('gameUpdate', { 
                team: team, 
                power: totalPower 
            });
        }
    });
}

// ---------------------------------------------------------
// INICIAR SERVIDOR
// ---------------------------------------------------------
// Render nos da el puerto en process.env.PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});
