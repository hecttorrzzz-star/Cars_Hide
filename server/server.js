/**
 * Car Hide — Backend Servidor Node.js + Express + Socket.io (v1.1.0)
 * 100% Compatible con las firmas y eventos exactos del frontend + Captura Táctica por Mapa
 */

const express    = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? generateCode() : code;
}

function createPlayer(socketId, name, carColor, carModel, isHost = false, photo = null) {
  return {
    id: socketId,
    name: name || 'Jugador',
    carColor: carColor || '#007aff',
    carModel: carModel || '',
    isHost: isHost,
    role: 'hider',
    isAlive: true,
    lat: null,
    lng: null,
    heading: 0,
    photo: photo || null,
    lastScanAt: 0,
  };
}

function normalizeSettings(s = {}) {
  return {
    hideTime:           Number(s.hideTime)           || 5,
    gameDuration:       Number(s.gameDuration)       || 30,
    infiniteMode:       Boolean(s.infiniteMode),
    zoneShrinkInterval: Number(s.zoneShrinkInterval) || 5,
    zoneTransitionTime: Number(s.zoneTransitionTime) || 2,
    outsideZoneLimit:   Number(s.outsideZoneLimit)   || 30,
    seekerCount:        Number(s.seekerCount)        || 1,
    caughtBecomesSeeker: s.caughtBecomesSeeker       !== false,
    eliminatedBecomesSeeker: s.eliminatedBecomesSeeker !== false,
    sonarEnabled:       Boolean(s.sonarEnabled),
    photoEnabled:       Boolean(s.photoEnabled),
  };
}

function getPlayersArray(room) {
  return Object.values(room.players).map(p => ({
    id:       p.id,
    name:     p.name,
    carColor: p.carColor,
    carModel: p.carModel,
    isHost:   p.isHost,
    role:     p.role,
    isAlive:  p.isAlive,
    photo:    p.photo || null,
  }));
}

function getRoomByPlayer(socketId) {
  for (const code in rooms) {
    if (rooms[code].players[socketId]) return rooms[code];
  }
  return null;
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


function triggerSonarPing(room) {
  if (!room || room.phase !== 'SEEKING') return;

  const aliveHiders = Object.values(room.players).filter(p => p.role === 'hider' && p.isAlive && p.lat && p.lng);
  if (aliveHiders.length === 0) return;

  // Generar sectores aproximados con dispersión aleatoria (~200m)
  const sectors = aliveHiders.map(h => ({
    lat: h.lat + (Math.random() - 0.5) * 0.0025,
    lng: h.lng + (Math.random() - 0.5) * 0.0025,
    radius: 220
  }));

  // Notificar a buscadores con los sectores marcados
  Object.values(room.players).forEach(p => {
    const socketObj = io.sockets.sockets.get(p.id);
    if (!socketObj) return;

    if (p.role === 'seeker') {
      socketObj.emit('sonar_ping', {
        sectors: sectors,
        message: ' ¡Barrido de Sonar recibido! Sectores marcados durante 15s'
      });
    } else {
      socketObj.emit('sonar_ping', {
        sectors: [],
        message: '️ ¡ALERTA DE SONAR! El buscador ha recibido pistas de cuadrante'
      });
    }
  });

  console.log(`[Sonar Ping] Emitidos ${sectors.length} sectores en sala ${room.code}`);
}

function clearRoomTimers(room) {
  if (room.timers) {
    Object.values(room.timers).forEach(t => clearTimeout(t));
    room.timers = {};
  }
}

io.on('connection', (socket) => {
  console.log(`[+] Conexión: ${socket.id}`);

  // 1. CREAR SALA
  socket.on('create_room', ({ settings, zone, playerName, carColor, carModel, photo }) => {
    try {
      const code = generateCode();
      const hostPlayer = createPlayer(socket.id, playerName, carColor, carModel, true, photo);

      rooms[code] = {
        code,
        hostId: socket.id,
        phase: 'LOBBY',
        settings: normalizeSettings(settings),
        zone: zone || null,
        currentZone: zone || null,
        players: { [socket.id]: hostPlayer },
        timers: {},
        startedAt: null,
      };

      socket.join(code);

      socket.emit('room_created', {
        roomCode: code,
        settings: rooms[code].settings,
        zone: rooms[code].zone,
        players: getPlayersArray(rooms[code]),
        isHost: true,
      });

      console.log(`[Sala Creada] ${code} por ${playerName}`);
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Error al crear la partida' });
    }
  });

  // 2. UNIRSE A SALA
  socket.on('join_room', ({ code, playerName, carColor, carModel, photo }) => {
    const roomCode = code?.toUpperCase?.()?.trim?.();
    const room = rooms[roomCode];

    if (!room) return socket.emit('error', { message: 'Sala no encontrada' });
    if (room.phase !== 'LOBBY') return socket.emit('error', { message: 'La partida ya ha comenzado' });
    if (Object.keys(room.players).length >= 12) return socket.emit('error', { message: 'Sala llena' });

    room.players[socket.id] = createPlayer(socket.id, playerName, carColor, carModel, false, photo);
    socket.join(roomCode);

    socket.emit('room_joined', {
      roomCode: room.code,
      settings: room.settings,
      zone: room.zone,
      players: getPlayersArray(room),
      ranking: getPlayersArray(room),
      isHost: false,
    });

    io.to(room.code).emit('lobby_update', getPlayersArray(room));
    console.log(`[Jugador Unido] ${playerName} entró a ${room.code}`);
  });

  // 3. LOBBY
  socket.on('request_lobby', ({ roomCode }) => {
    const room = rooms[roomCode?.toUpperCase?.()];
    if (!room) return;
    socket.emit('lobby_update', getPlayersArray(room));
  });

  // 4. INICIAR PARTIDA
  socket.on('start_game', ({ roomCode }) => {
    const room = rooms[roomCode?.toUpperCase?.()];
    if (!room) return socket.emit('error', { message: 'Sala no encontrada' });
    if (room.hostId !== socket.id) return socket.emit('error', { message: 'Solo el anfitrión puede iniciar' });

    const playerList = Object.values(room.players);
    if (playerList.length < 2) {
      return socket.emit('error', { message: 'Se necesitan al menos 2 jugadores' });
    }

    const seekerCount = Math.min(room.settings.seekerCount || 1, playerList.length - 1);
    const shuffled = [...playerList].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, idx) => {
      p.role = idx < seekerCount ? 'seeker' : 'hider';
      p.isAlive = true;
    });

    room.phase = 'HIDING';
    room.startedAt = Date.now();
    const hideTimeMs = (room.settings.hideTime || 5) * 60_000;
    const phaseEndsAt = Date.now() + hideTimeMs;

    playerList.forEach(p => {
      const socketObj = io.sockets.sockets.get(p.id);
      if (socketObj) {
        socketObj.emit('game_started', {
          phase: 'HIDING',
          phaseEndsAt: phaseEndsAt,
          yourRole: p.role,
          players: getPlayersArray(room),
          zone: room.zone,
        });
      }
    });

    room.timers.hideTimer = setTimeout(() => {
      if (room.phase === 'ENDED') return;
      room.phase = 'SEEKING';
      const gameDurationMs = room.settings.infiniteMode ? 0 : (room.settings.gameDuration || 30) * 60_000;
      const seekEndsAt = gameDurationMs > 0 ? Date.now() + gameDurationMs : 0;

      io.to(room.code).emit('phase_change', {
        phase: 'SEEKING',
        phaseEndsAt: seekEndsAt,
      });

      if (!room.settings.infiniteMode && gameDurationMs > 0) {
        room.timers.seekTimer = setTimeout(() => {
          if (room.phase === 'ENDED') return;
          clearRoomTimers(room);
          room.phase = 'ENDED';
          const playersArr = getPlayersArray(room);
          io.to(room.code).emit('game_over', {
            winner: 'hiders',
            reason: 'time_up',
            duration: room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0,
            players: playersArr,
            ranking: playersArr,
            roomCode: room.code,
          });
          console.log(`[Partida ${room.code}] Fin de tiempo: Ganaron los Hiders`);
        }, gameDurationMs);
      }

      console.log(`[Partida ${room.code}] Comienza la fase de Búsqueda`);
    }, hideTimeMs);

    console.log(`[Partida Iniciada] ${room.code} con ${playerList.length} jugadores`);
  });

  // 5. POSICIÓN
  socket.on('player_position', (pos) => {
    const room = getRoomByPlayer(socket.id);
    if (!room || room.phase === 'LOBBY' || room.phase === 'ENDED') return;

    const p = room.players[socket.id];
    if (!p || !p.isAlive) return;

    p.lat = pos.lat;
    p.lng = pos.lng;
    p.heading = pos.heading || 0;

    const activeSeekers = Object.values(room.players)
      .filter(pl => pl.role === 'seeker' && pl.lat && pl.lng)
      .map(pl => ({
        id: pl.id,
        name: pl.name,
        carColor: pl.carColor,
        lat: pl.lat,
        lng: pl.lng,
        heading: pl.heading,
      }));

    if (activeSeekers.length > 0) {
      io.to(room.code).emit('positions_update', activeSeekers);
    }
  });

  // 6. AVISTAR / CAPTURAR POR MAPA (SPOT ON MAP)
  socket.on('spot_player', ({ lat, lng }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room || (room.phase !== 'SEEKING' && room.phase !== 'ZONE_WARNING')) {
      return socket.emit('spot_miss', { message: 'Solo puedes escanear en fase de búsqueda' });
    }

    const seeker = room.players[socket.id];
    if (!seeker || seeker.role !== 'seeker') {
      return socket.emit('spot_miss', { message: 'Solo los buscadores pueden escanear' });
    }

    const COOLDOWN_MS = 12000; // 12 segundos de recarga anti-spam
    const now = Date.now();
    const timeSinceLastScan = now - (seeker.lastScanAt || 0);

    if (timeSinceLastScan < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - timeSinceLastScan) / 1000);
      return socket.emit('spot_cooldown', {
        remaining: remainingSec,
        message: `Radar en enfriamiento. Espera ${remainingSec}s.`
      });
    }

    seeker.lastScanAt = now;
    if (!seeker || seeker.role !== 'seeker') {
      return socket.emit('spot_miss', { message: 'Solo los buscadores pueden escanear' });
    }

    const CAPTURE_RADIUS_METERS = 85; // Margen de 85m en calle
    const aliveHiders = Object.values(room.players).filter(p => p.role === 'hider' && p.isAlive && p.lat && p.lng);

    let caughtTarget = null;
    let minDistance = Infinity;

    for (const hider of aliveHiders) {
      const dist = getDistanceMeters(lat, lng, hider.lat, hider.lng);
      if (dist <= CAPTURE_RADIUS_METERS && dist < minDistance) {
        minDistance = dist;
        caughtTarget = hider;
      }
    }

    if (caughtTarget) {
      if (photo) {
      target.photo = photo;
    }
    const becomesSeeker = room.settings.caughtBecomesSeeker;
      if (becomesSeeker) {
        caughtTarget.role = 'seeker';
        caughtTarget.isAlive = true;
      } else {
        caughtTarget.isAlive = false;
      }

      io.to(room.code).emit('player_caught', {
        playerId: caughtTarget.id,
        playerName: caughtTarget.name,
        catcherId: seeker.id,
        catcherName: seeker.name,
        position: { lat: caughtTarget.lat, lng: caughtTarget.lng },
        caughtBecomesSeeker: becomesSeeker,
      });

      console.log(`[Spot Exitoso] ${seeker.name} pilló a ${caughtTarget.name} a ${Math.round(minDistance)}m`);

      const remainingHiders = Object.values(room.players).filter(pl => pl.role === 'hider' && pl.isAlive);
      if (remainingHiders.length === 0) {
        clearRoomTimers(room);
        room.phase = 'ENDED';
        const playersArr = getPlayersArray(room);
        io.to(room.code).emit('game_over', {
          winner: 'seekers',
          reason: 'all_caught',
          duration: room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0,
          players: playersArr,
          ranking: playersArr,
          roomCode: room.code,
        });
      }
    } else {
      socket.emit('spot_miss', {
        lat,
        lng,
        message: '¡Nadie en este punto! (Radio 85m)',
        cooldown: 10,
      });
    }
  });

  // 6.2 CAPTURAR MANUAL / DIRECTO
  socket.on('catch_player', ({ targetId, photo }) => {
    const room = getRoomByPlayer(socket.id);
    if (!room || (room.phase !== 'SEEKING' && room.phase !== 'ZONE_WARNING')) return;

    const catcher = room.players[socket.id];
    const target = room.players[targetId];

    if (!catcher || catcher.role !== 'seeker') return;
    if (!target || !target.isAlive || target.role !== 'hider') return;

    if (photo) {
      target.photo = photo;
    }

    const becomesSeeker = room.settings.caughtBecomesSeeker;
    if (becomesSeeker) {
      target.role = 'seeker';
      target.isAlive = true;
    } else {
      target.isAlive = false;
    }

    io.to(room.code).emit('player_caught', {
      playerId: target.id,
      playerName: target.name,
      catcherId: catcher.id,
      catcherName: catcher.name,
      position: { lat: target.lat, lng: target.lng },
      caughtBecomesSeeker: becomesSeeker,
    });

    console.log(`[Captura] ${target.name} cazado por ${catcher.name}`);

    const remainingHiders = Object.values(room.players).filter(pl => pl.role === 'hider' && pl.isAlive);
    if (remainingHiders.length === 0) {
      clearRoomTimers(room);
      room.phase = 'ENDED';
      const playersArr = getPlayersArray(room);
      io.to(room.code).emit('game_over', {
        winner: 'seekers',
        reason: 'all_caught',
        duration: room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0,
        players: playersArr,
        ranking: playersArr,
        roomCode: room.code,
      });
    }
  });

  // 7. CHAT
  socket.on('chat_message', ({ message }) => {
    const room = getRoomByPlayer(socket.id);
    const p = room?.players[socket.id];
    if (!room || !p) return;

    const txt = message?.trim?.().slice(0, 250);
    if (!txt) return;

    io.to(room.code).emit('chat_message', {
      senderId: socket.id,
      playerName: p.name,
      carColor: p.carColor,
      message: txt,
      timestamp: Date.now(),
    });
  });

  // 8. DESCONEXIÓN
  socket.on('leave_room', () => handleLeave(socket));
  socket.on('disconnect', () => {
    console.log(`[-] Desconexión: ${socket.id}`);
    handleLeave(socket);
  });
});

function handleLeave(socket) {
  const room = getRoomByPlayer(socket.id);
  if (!room) return;

  const player = room.players[socket.id];
  delete room.players[socket.id];
  socket.leave(room.code);

  const remainingCount = Object.keys(room.players).length;
  console.log(`[Salida] ${player?.name || socket.id} de ${room.code}. Restantes: ${remainingCount}`);

  if (remainingCount === 0) {
    clearRoomTimers(room);
    delete rooms[room.code];
    return;
  }

  if (socket.id === room.hostId) {
    const newHostId = Object.keys(room.players)[0];
    room.hostId = newHostId;
    room.players[newHostId].isHost = true;
  }

  io.to(room.code).emit('lobby_update', getPlayersArray(room));
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n Car Hide server listo en http://localhost:${PORT}\n`);
});
