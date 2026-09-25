/**
 * Car Hide — Backend Servidor Node.js + Express + Socket.io (v1.2.0)
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
  maxHttpBufferSize: 1e7,
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..')));

const APP_RELEASE = {
  version: "1.3.0",
  deployedAt: "2026-09-19 17:22 (UTC+2)",
  latestCommit: "0ac3164",
  features: [
    "HUD táctil y Z-Index reforzado en móviles (Botón GPS y Chat flotante)",
    "Centrado GPS con rescate automático (getCurrentPosition)",
    "Visibilidad por rol (Buscadores solo ven buscadores, Escondidos solo escondidos)",
    "Temporizadores de fase sincronizados y reducción automática de zona",
    "Animación de 3s al revelar el rol al inicio",
    "Radar Sonar táctico para buscadores (cooldown 12s)",
    "Cámara y selfie con filtros AR (Ganador VIP vs Payaso 3D)"
  ]
};

app.get(['/api/version', '/version'], (_req, res) => {
  res.json({ status: 'ok', ...APP_RELEASE });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length, version: APP_RELEASE.version });
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
    initialRole: 'hider',
    isAlive: true,
    lat: null,
    lng: null,
    heading: 0,
    photo: photo || null,
    lastScanAt: 0,
    survivalTime: null,
    caughtAt: null,
    caughtBy: null,
    caughtPhoto: null,
    catchesCount: 0,
  };
}

function normalizeSettings(s = {}) {
  // Manejo robusto de tiempos (en segundos)
  let hideTimeSec = Number(s.hideTime);
  if (isNaN(hideTimeSec) || hideTimeSec <= 0) hideTimeSec = 300;
  else if (hideTimeSec < 60) hideTimeSec = hideTimeSec * 60; // Si enviaron minutos

  let gameDurationSec = Number(s.gameDuration);
  if (s.infiniteMode) gameDurationSec = 0;
  else if (isNaN(gameDurationSec) || gameDurationSec <= 0) gameDurationSec = 1800;
  else if (gameDurationSec < 60) gameDurationSec = gameDurationSec * 60;

  let shrinkIntervalSec = Number(s.zoneShrinkInterval);
  if (isNaN(shrinkIntervalSec) || shrinkIntervalSec <= 0) shrinkIntervalSec = 300;
  else if (shrinkIntervalSec < 60) shrinkIntervalSec = shrinkIntervalSec * 60;

  let transitionTimeSec = Number(s.zoneTransitionTime);
  if (isNaN(transitionTimeSec) || transitionTimeSec <= 0) transitionTimeSec = 120;
  else if (transitionTimeSec < 60) transitionTimeSec = transitionTimeSec * 60;

  return {
    hideTime:           hideTimeSec,
    gameDuration:       gameDurationSec,
    infiniteMode:       Boolean(s.infiniteMode),
    zoneShrinkInterval: shrinkIntervalSec,
    zoneTransitionTime: transitionTimeSec,
    outsideZoneLimit:   Number(s.outsideZoneLimit)   || 30,
    seekerCount:        Math.max(1, Math.floor(Number(s.seekerCount) || 1)),
    caughtBecomesSeeker: s.caughtBecomesSeeker       !== false,
    eliminatedBecomesSeeker: s.eliminatedBecomesSeeker !== false,
    sonarEnabled:       Boolean(s.sonarEnabled),
    photoEnabled:       Boolean(s.photoEnabled),
  };
}

function getPlayersArray(room) {
  const totalDuration = room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0;
  return Object.values(room.players).map(p => ({
    id:           p.id,
    name:         p.name,
    carColor:     p.carColor,
    carModel:     p.carModel,
    isHost:       p.isHost,
    role:         p.role,
    initialRole:  p.initialRole || p.role,
    isAlive:      p.isAlive,
    survivalTime: (p.survivalTime !== null && p.survivalTime !== undefined) ? p.survivalTime : ((p.role === 'hider' && p.isAlive) ? totalDuration : null),
    catchesCount: p.catchesCount || 0,
    photo:        p.photo || null,
    caughtPhoto:  p.caughtPhoto || null,
    caughtBy:     p.caughtBy || null,
  }));
}

function computeRanking(room, winner) {
  const totalDuration = room.startedAt ? Math.max(1, Math.floor((Date.now() - room.startedAt) / 1000)) : 0;
  const list = Object.values(room.players).map(p => {
    let sTime = p.survivalTime;
    if (sTime === null || sTime === undefined) {
      if (p.role === 'hider' && p.isAlive) {
        sTime = totalDuration;
      } else if (p.initialRole === 'seeker') {
        sTime = null;
      } else {
        sTime = totalDuration;
      }
    }
    return {
      id:           p.id,
      name:         p.name,
      carColor:     p.carColor,
      carModel:     p.carModel,
      isHost:       p.isHost,
      role:         p.role,
      initialRole:  p.initialRole || p.role,
      isAlive:      p.isAlive,
      survivalTime: sTime,
      catchesCount: p.catchesCount || 0,
      photo:        p.photo || null,
      caughtPhoto:  p.caughtPhoto || null,
      caughtBy:     p.caughtBy || null,
    };
  });

  return list.sort((a, b) => {
    const isSeekersWon = winner === 'seekers';
    const aIsWinner = isSeekersWon ? (a.role === 'seeker') : (a.role === 'hider' && a.isAlive !== false);
    const bIsWinner = isSeekersWon ? (b.role === 'seeker') : (b.role === 'hider' && b.isAlive !== false);

    if (aIsWinner && !bIsWinner) return -1;
    if (!aIsWinner && bIsWinner) return 1;

    if (aIsWinner && bIsWinner) {
      if (isSeekersWon) {
        if (a.initialRole === 'seeker' && b.initialRole !== 'seeker') return -1;
        if (a.initialRole !== 'seeker' && b.initialRole === 'seeker') return 1;
        if ((b.catchesCount || 0) !== (a.catchesCount || 0)) {
          return (b.catchesCount || 0) - (a.catchesCount || 0);
        }
        return (b.survivalTime || 0) - (a.survivalTime || 0);
      } else {
        return (b.survivalTime || 0) - (a.survivalTime || 0);
      }
    } else {
      if ((b.survivalTime || 0) !== (a.survivalTime || 0)) {
        return (b.survivalTime || 0) - (a.survivalTime || 0);
      }
      return (b.catchesCount || 0) - (a.catchesCount || 0);
    }
  });
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

function getCoordinatesFromGeoJson(geoJson) {
  if (!geoJson) return null;
  try {
    if (geoJson.geometry && geoJson.geometry.coordinates) {
      return geoJson.geometry.coordinates[0];
    }
    if (geoJson.coordinates) {
      return geoJson.coordinates[0];
    }
    if (geoJson.features && geoJson.features.length > 0) {
      const f = geoJson.features[0];
      return f.geometry ? f.geometry.coordinates[0] : (f.coordinates ? f.coordinates[0] : null);
    }
  } catch (e) {
    return null;
  }
  return null;
}

function shrinkPolygon(geoJson, factor = 0.70) {
  if (!geoJson) return null;
  try {
    const coords = getCoordinatesFromGeoJson(geoJson);
    if (!coords || coords.length < 3) return null;

    let sumLat = 0, sumLng = 0;
    const isClosed = coords.length > 1 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
    const n = isClosed ? coords.length - 1 : coords.length;
    for (let i = 0; i < n; i++) {
      sumLng += coords[i][0];
      sumLat += coords[i][1];
    }
    const cLng = sumLng / n;
    const cLat = sumLat / n;
    const newRing = coords.map(([lng, lat]) => [
      cLng + (lng - cLng) * factor,
      cLat + (lat - cLat) * factor
    ]);
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [newRing]
      },
      properties: {}
    };
  } catch (e) {
    console.error('[shrinkPolygon] Error:', e);
    return null;
  }
}

function isPointInPolygon(lat, lng, geoJson) {
  if (lat == null || lng == null || !geoJson) return true;
  const coords = getCoordinatesFromGeoJson(geoJson);
  if (!coords || coords.length < 3) return true;

  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function checkPlayerOutsideZone(room, p, socketObj) {
  if (!room || !room.currentZone || (room.phase !== 'SEEKING' && room.phase !== 'ZONE_WARNING')) return;
  if (!p || !p.isAlive || p.lat == null || p.lng == null) return;

  const isInside = isPointInPolygon(p.lat, p.lng, room.currentZone);
  const limitSec = room.settings.outsideZoneLimit || 30;

  if (!isInside) {
    if (!p.outsideSince) {
      p.outsideSince = Date.now();
    }
    const elapsedSec = Math.floor((Date.now() - p.outsideSince) / 1000);
    const remainingSec = Math.max(0, limitSec - elapsedSec);

    if (socketObj) {
      socketObj.emit('outside_zone_warning', {
        isOutside: true,
        remainingSec: remainingSec,
        limitSec: limitSec
      });
    }

    if (elapsedSec >= limitSec) {
      console.log(`[Tormenta] ${p.name} superó el tiempo fuera de zona (${limitSec}s) en sala ${room.code}`);
      p.outsideSince = null;
      if (socketObj) {
        socketObj.emit('outside_zone_warning', { isOutside: false });
      }

      const totalDuration = room.startedAt ? Math.max(1, Math.floor((Date.now() - room.startedAt) / 1000)) : 0;
      if (p.role === 'hider' && !p.survivalTime) {
        p.survivalTime = totalDuration;
      }

      if (room.settings.eliminatedBecomesSeeker) {
        p.role = 'seeker';
        p.isAlive = true;
        io.to(room.code).emit('player_role_changed', {
          playerId: p.id,
          newRole: 'seeker',
          reason: 'outside_zone'
        });
        io.to(room.code).emit('chat_message', {
          type: 'system',
          senderId: 'system',
          playerName: 'Sistema',
          carColor: '#FF453A',
          message: `☠️ ${p.name} ha muerto fuera de zona y ahora es BUSCADOR.`,
          timestamp: Date.now()
        });
      } else {
        p.isAlive = false;
        io.to(room.code).emit('player_eliminated', {
          playerId: p.id,
          playerName: p.name,
          reason: 'outside_zone'
        });
        io.to(room.code).emit('chat_message', {
          type: 'system',
          senderId: 'system',
          playerName: 'Sistema',
          carColor: '#FF453A',
          message: `☠️ ${p.name} ha sido eliminado por la tormenta (fuera de zona).`,
          timestamp: Date.now()
        });
      }

      const remainingHiders = Object.values(room.players).filter(pl => pl.role === 'hider' && pl.isAlive);
      if (remainingHiders.length === 0) {
        clearRoomTimers(room);
        room.phase = 'ENDED';
        const rankingArr = computeRanking(room, 'seekers');
        io.to(room.code).emit('game_over', {
          winner: 'seekers',
          reason: 'all_caught',
          duration: totalDuration,
          players: rankingArr,
          ranking: rankingArr,
          roomCode: room.code,
        });
        console.log(`[Partida ${room.code}] Fin de partida: Todos los hiders eliminados`);
      }
    }
  } else {
    if (p.outsideSince) {
      p.outsideSince = null;
      if (socketObj) {
        socketObj.emit('outside_zone_warning', { isOutside: false });
      }
    }
  }
}

function checkAllPlayersZone(room) {
  if (!room || (room.phase !== 'SEEKING' && room.phase !== 'ZONE_WARNING')) return;
  Object.values(room.players).forEach(p => {
    const s = io.sockets.sockets.get(p.id);
    checkPlayerOutsideZone(room, p, s);
  });
}

function triggerSonarPing(room) {
  if (!room || (room.phase !== 'SEEKING' && room.phase !== 'ZONE_WARNING')) return;

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
        message: '📡 ¡Barrido de Sonar recibido! Sectores marcados durante 15s'
      });
    } else {
      socketObj.emit('sonar_ping', {
        sectors: [],
        message: '⚠️ ¡ALERTA DE SONAR! El buscador ha recibido pistas de cuadrante'
      });
    }
  });

  console.log(`[Sonar Ping] Emitidos ${sectors.length} sectores en sala ${room.code}`);
}

function startZoneCycle(room) {
  if (!room || !room.currentZone || room.phase === 'ENDED') return;

  const shrinkIntervalMs = (room.settings.zoneShrinkInterval || 300) * 1000;

  room.zoneEndsAt = Date.now() + shrinkIntervalMs;

  io.to(room.code).emit('phase_change', {
    phase: 'SEEKING',
    phaseEndsAt: room.zoneEndsAt,
    gameEndsAt: room.gameEndsAt,
  });

  if (!room.timers.zoneCheckInterval) {
    room.timers.zoneCheckInterval = setInterval(() => checkAllPlayersZone(room), 1000);
  }

  room.timers.zoneTimer = setTimeout(() => {
    runZoneShrinkWarning(room);
  }, shrinkIntervalMs);
}

function runZoneShrinkWarning(room) {
  if (!room || room.phase === 'ENDED') return;

  const nextZone = shrinkPolygon(room.currentZone, 0.70);
  if (!nextZone) return;

  const transitionTimeMs = (room.settings.zoneTransitionTime || 120) * 1000;
  room.phase = 'ZONE_WARNING';
  room.nextZone = nextZone;
  room.zoneEndsAt = Date.now() + transitionTimeMs;

  io.to(room.code).emit('phase_change', {
    phase: 'ZONE_WARNING',
    phaseEndsAt: room.zoneEndsAt,
    gameEndsAt: room.gameEndsAt,
  });

  io.to(room.code).emit('zone_shrinking', {
    nextZone: nextZone,
    transitionTime: room.settings.zoneTransitionTime,
    zoneEndsAt: room.zoneEndsAt,
  });

  io.to(room.code).emit('chat_message', {
    type: 'system',
    senderId: 'system',
    playerName: 'Sistema',
    carColor: '#FF9500',
    message: '⚠️ ¡ALERTA DE ZONA! La zona se está reduciendo hacia la línea discontinua amarilla.',
    timestamp: Date.now()
  });

  room.timers.zoneTransition = setTimeout(() => {
    finalizeZoneShrink(room);
  }, transitionTimeMs);
}

function finalizeZoneShrink(room) {
  if (!room || room.phase === 'ENDED') return;

  room.currentZone = room.nextZone;
  room.nextZone = null;
  room.phase = 'SEEKING';

  const shrinkIntervalMs = (room.settings.zoneShrinkInterval || 300) * 1000;
  room.zoneEndsAt = Date.now() + shrinkIntervalMs;

  io.to(room.code).emit('zone_updated', {
    currentZone: room.currentZone,
  });

  io.to(room.code).emit('phase_change', {
    phase: 'SEEKING',
    phaseEndsAt: room.zoneEndsAt,
    gameEndsAt: room.gameEndsAt,
  });

  io.to(room.code).emit('chat_message', {
    type: 'system',
    senderId: 'system',
    playerName: 'Sistema',
    carColor: '#30D158',
    message: '⚡ ¡ZONA CERRADA! La tormenta ha avanzado. Permanece dentro del perímetro seguro.',
    timestamp: Date.now()
  });

  room.timers.zoneTimer = setTimeout(() => {
    runZoneShrinkWarning(room);
  }, shrinkIntervalMs);
}

function clearRoomTimers(room) {
  if (room.timers) {
    Object.values(room.timers).forEach(t => {
      clearTimeout(t);
      clearInterval(t);
    });
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

      console.log(`[Sala Creada] ${code} por ${playerName} (${JSON.stringify(rooms[code].settings)})`);
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
      p.initialRole = p.role;
      p.isAlive = true;
      p.survivalTime = null;
      p.caughtAt = null;
      p.caughtBy = null;
      p.caughtPhoto = null;
      p.catchesCount = 0;
    });

    room.phase = 'HIDING';
    room.startedAt = Date.now();
    const hideTimeMs = (room.settings.hideTime || 300) * 1000;
    const phaseEndsAt = Date.now() + hideTimeMs;
    const gameDurationMs = room.settings.infiniteMode ? 0 : (room.settings.gameDuration || 1800) * 1000;
    room.gameEndsAt = gameDurationMs > 0 ? (phaseEndsAt + gameDurationMs) : 0;

    playerList.forEach(p => {
      const socketObj = io.sockets.sockets.get(p.id);
      if (socketObj) {
        socketObj.emit('game_started', {
          phase: 'HIDING',
          phaseEndsAt: phaseEndsAt,
          gameEndsAt: room.gameEndsAt,
          yourRole: p.role,
          players: getPlayersArray(room),
          zone: room.zone,
          settings: room.settings,
          roomCode: room.code,
        });
      }
    });

    room.timers.hideTimer = setTimeout(() => {
      if (room.phase === 'ENDED') return;
      room.phase = 'SEEKING';
      const seekEndsAt = gameDurationMs > 0 ? Date.now() + gameDurationMs : 0;
      room.gameEndsAt = seekEndsAt;

      // Iniciar ciclo de reducción de zona
      startZoneCycle(room);

      // Sonar periódico si está activado (cada 4 min)
      if (room.settings.sonarEnabled) {
        room.timers.sonarInterval = setInterval(() => triggerSonarPing(room), 240_000);
      }

      // Fin de partida por tiempo (si no es infinito)
      if (!room.settings.infiniteMode && gameDurationMs > 0) {
        room.timers.seekTimer = setTimeout(() => {
          if (room.phase === 'ENDED') return;
          clearRoomTimers(room);
          room.phase = 'ENDED';
          const totalDuration = room.startedAt ? Math.max(1, Math.floor((Date.now() - room.startedAt) / 1000)) : 0;
          Object.values(room.players).forEach(p => {
            if (p.role === 'hider' && p.isAlive && !p.survivalTime) {
              p.survivalTime = totalDuration;
            }
          });
          const rankingArr = computeRanking(room, 'hiders');
          io.to(room.code).emit('game_over', {
            winner: 'hiders',
            reason: 'time_up',
            duration: totalDuration,
            players: rankingArr,
            ranking: rankingArr,
            roomCode: room.code,
          });
          console.log(`[Partida ${room.code}] Fin de tiempo: Ganaron los Hiders`);
        }, gameDurationMs);
      }

      console.log(`[Partida ${room.code}] Comienza la fase de Búsqueda (Duración: ${gameDurationMs / 1000}s)`);
    }, hideTimeMs);

    console.log(`[Partida Iniciada] ${room.code} con ${playerList.length} jugadores. Fase Esconderse: ${hideTimeMs / 1000}s`);
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

    // Verificar zona segura / tormenta para este jugador
    checkPlayerOutsideZone(room, p, socket);

    // Buscadores vivos con posición
    const activeSeekers = Object.values(room.players)
      .filter(pl => pl.role === 'seeker' && pl.isAlive && pl.lat && pl.lng)
      .map(pl => ({
        id: pl.id,
        name: pl.name,
        carColor: pl.carColor,
        lat: pl.lat,
        lng: pl.lng,
        heading: pl.heading,
      }));

    // Escondidos vivos con posición
    const activeHiders = Object.values(room.players)
      .filter(pl => pl.role === 'hider' && pl.isAlive && pl.lat && pl.lng)
      .map(pl => ({
        id: pl.id,
        name: pl.name,
        carColor: pl.carColor,
        lat: pl.lat,
        lng: pl.lng,
        heading: pl.heading,
      }));

    // Regla táctica:
    // 1. Buscadores solo ven la ubicación de otros buscadores.
    // 2. Escondidos solo ven la ubicación de otros escondidos (nunca a los buscadores).
    Object.values(room.players).forEach(pl => {
      const socketObj = io.sockets.sockets.get(pl.id);
      if (!socketObj) return;

      if (pl.role === 'seeker') {
        socketObj.emit('positions_update', activeSeekers);
      } else if (pl.role === 'hider') {
        socketObj.emit('positions_update', activeHiders);
      }
    });
  });

  // 6. CAPTURAR JUGADOR ("¡LO ENCONTRÉ!")
  socket.on('catch_player', (data) => {
    const { targetId, photo } = data || {};
    let room = getRoomByPlayer(socket.id);
    const roomCode = (typeof data === 'object' && data?.roomCode) ? data.roomCode.toUpperCase().trim() : null;
    if (!room && roomCode && rooms[roomCode]) {
      room = rooms[roomCode];
      socket.join(roomCode);
    }
    if (!room || room.phase === 'LOBBY' || room.phase === 'ENDED') return;

    let catcher = room.players[socket.id];
    if (!catcher) {
      catcher = Object.values(room.players).find(p => p.role === 'seeker');
    }
    const target = room.players[targetId];

    if (!catcher || catcher.role !== 'seeker') return;
    if (!target || !target.isAlive || target.role !== 'hider') return;

    const now = Date.now();
    if (!target.survivalTime && target.role === 'hider') {
      target.survivalTime = room.startedAt ? Math.max(1, Math.floor((now - room.startedAt) / 1000)) : 0;
      target.caughtAt = now;
    }
    catcher.catchesCount = (catcher.catchesCount || 0) + 1;
    target.caughtBy = catcher.name;

    if (photo && room.settings.photoEnabled) {
      target.caughtPhoto = photo;
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

    console.log(`[Captura Directa] ${target.name} cazado por ${catcher.name}`);

    const remainingHiders = Object.values(room.players).filter(pl => pl.role === 'hider' && pl.isAlive);
    if (remainingHiders.length === 0) {
      clearRoomTimers(room);
      room.phase = 'ENDED';
      const totalDuration = room.startedAt ? Math.max(1, Math.floor((Date.now() - room.startedAt) / 1000)) : 0;
      const rankingArr = computeRanking(room, 'seekers');
      io.to(room.code).emit('game_over', {
        winner: 'seekers',
        reason: 'all_caught',
        duration: totalDuration,
        players: rankingArr,
        ranking: rankingArr,
        roomCode: room.code,
      });
    }
  });

  // 7. CHAT
  socket.on('chat_message', (data) => {
    let room = getRoomByPlayer(socket.id);
    const roomCode = (typeof data === 'object' && data?.roomCode) ? data.roomCode.toUpperCase().trim() : null;
    if (!room && roomCode && rooms[roomCode]) {
      room = rooms[roomCode];
      socket.join(roomCode);
    }
    if (!room) {
      console.warn(`[Chat] Mensaje descartado: socket ${socket.id} no está en ninguna sala`);
      return;
    }

    const rawMsg = typeof data === 'string' ? data : (data?.message || data?.text || data?.msg || '');
    const txt = String(rawMsg || '').trim().slice(0, 250);
    if (!txt) return;

    let p = room.players[socket.id];
    if (!p) {
      p = Object.values(room.players).find(pl => pl.name === data?.playerName) || {
        id: socket.id,
        name: data?.playerName || 'Copiloto',
        carColor: data?.carColor || '#007aff'
      };
      room.players[socket.id] = p;
      socket.join(room.code);
    }

    const payload = {
      type: 'player',
      senderId: socket.id,
      playerName: p.name,
      carColor: p.carColor || '#007aff',
      playerColor: p.carColor || '#007aff',
      message: txt,
      timestamp: Date.now(),
    };

    console.log(`[Chat ${room.code}] ${p.name}: ${txt}`);
    io.to(room.code).emit('chat_message', payload);
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
  console.log(`\n🚗 Car Hide server listo en http://localhost:${PORT}\n`);
});
