const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Almacenamos la conexión activa
let tiktokConnection = null;

// Escuchamos cuando un cliente (la web) se conecta
io.on('connection', (socket) => {
    console.log('Cliente web conectado');

    // El cliente web nos dirá a qué usuario conectar mediante un evento
    socket.on('setTiktokUser', (username) => {
        connectToTikTok(username);
    });
});

function connectToTikTok(username) {
    // Si ya estamos conectados al mismo usuario, no hacemos nada
    if (tiktokConnection && tiktokConnection.username === username) return;
    
    // Si hay una conexión vieja, la cerramos
    if (tiktokConnection) {
        tiktokConnection.disconnect();
    }

    console.log(`Intentando conectar a: ${username}`);
    let connection = new WebcastPushConnection(username);

    connection.connect().then(state => {
        console.info(`✅ Conectado al stream de ${state.roomId}`);
        tiktokConnection = connection; // Guardamos la ref
        tiktokConnection.username = username; // Guardamos el nombre para comprobar luego
    }).catch(err => {
        console.error('❌ Error al conectar (¿Está en vivo?):', err);
    });

    connection.on('gift', (data) => {
        if (data.giftType === 1 && !data.repeatEnd) return; // Filtro de combos

        const giftName = data.giftName.toLowerCase();
        
        // LOGICA DE PUNTOS
        // Aquí puedes cambiar "rose" o "gg" por lo que quieras
        if (giftName === 'rose') {
            io.emit('gameUpdate', { team: 'girl', power: 2 }); // Rosas empujan 2%
        } else if (giftName === 'gg' || giftName.includes('dumbbell')) {
            io.emit('gameUpdate', { team: 'boy', power: 2 }); // GG empuja 2%
        } 
        // Puedes añadir regalos caros aquí
        else if (giftName === 'money gun') {
             // Si envían pistola de dinero, empujón grande
             io.emit('gameUpdate', { team: 'girl', power: 20 });
        }
    });
}

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Servidor escuchando en puerto ${port}`);
});