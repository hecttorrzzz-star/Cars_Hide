# Car Hide — Servidor

Backend reconstruido a partir del frontend descargado de ch-slue.onrender.com.

## Estructura

```
Cars_Hide/
├── index.html          ← Frontend (Vite build)
├── favicon.svg
├── assets/
│   ├── index-BajZ5J3I.js
│   └── index-DYysjeVV.css
└── server/
    ├── server.js       ← Este servidor
    ├── package.json
    └── .env.example
```

## Instalar y arrancar

```bash
cd server
npm install
npm start
```

Luego abre http://localhost:3000

## Para desarrollo (auto-recarga)

```bash
npm run dev
```

## Desplegar en Render.com

1. Sube todo a GitHub
2. En Render: New Web Service → conecta el repo
3. Root directory: `server`
4. Build command: `npm install`
5. Start command: `npm start`
6. El frontend lo sirve automáticamente desde `../`

## Eventos Socket.io implementados

### Cliente → Servidor
| Evento | Payload |
|--------|---------|
| `create_room` | `{settings, zone, playerName, carColor, carModel}` |
| `join_room` | `{code, playerName, carColor, carModel}` |
| `leave_room` | — |
| `start_game` | `{roomCode}` |
| `player_position` | `{lat, lng, ...}` |
| `catch_player` | `{targetId}` |
| `chat_message` | `{message}` |
| `request_lobby` | `{roomCode}` |

### Servidor → Cliente
| Evento | Descripción |
|--------|-------------|
| `room_created` | Sala creada OK |
| `room_joined` | Unión confirmada |
| `lobby_update` | Estado del lobby actualizado |
| `game_started` | Partida iniciada |
| `player_caught` | Jugador atrapado |
| `player_role_changed` | Cambio de rol (hider → seeker) |
| `player_eliminated` | Jugador eliminado |
| `game_over` | Fin de partida + resultados |
| `chat_message` | Mensaje de chat |
| `error` | Error con mensaje |
