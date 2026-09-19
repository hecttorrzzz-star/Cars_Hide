# 🚗 Car Hide — Escondite Multijugador con Coches en Tiempo Real

Juego multijugador táctico en tiempo real de escondite con coches. Escóndete dentro de la zona de juego, sobrevive al cierre de la tormenta, usa radares tácticos y esquiva al buscador para ganar.

---

## 📱 Características Principales

- **🗺️ Delimitación Táctica de Zonas:** El anfitrión dibuja el perímetro del mapa en tiempo real con indicador GPS visual.
- **⚡ Radar Táctico y Sonar:** Detección de sectores y rastreo de posiciones en tiempo real mediante WebSockets.
- **🌀 Sistema de Tormenta Dinámico:** La zona segura se reduce periódicamente, obligando a los jugadores a desplazarse.
- **🎭 Filtros Faciales 3D (MediaPipe FaceMesh):** Ficha policial para los cazados (*Payaso*) y corona VIP para los ganadores (*Millonario*).
- **🛡️ Modo Copiloto Obligatorio:** Diseñado para jugar en equipo de forma segura con un copiloto gestionando la app.

---

## 🚀 Despliegue Rápido en Render.com (Gratis)

El backend en Node.js + WebSockets puede alojarse directamente en Render:

1. Crea una cuenta en [Render.com](https://render.com).
2. Haz clic en **New +** → **Web Service**.
3. Conecta este repositorio de GitHub.
4. Configura los siguientes parámetros:
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Una vez desplegado, obtendrás una URL pública (ejemplo: `https://cars-hide.onrender.com`).
6. Si deseas alojar el frontend por separado (ej. Netlify/Vercel), puedes configurar la URL del servidor ejecutando en la consola del navegador:
   ```javascript
   localStorage.setItem('carhide_server_url', 'https://cars-hide.onrender.com');
   ```
   O definiendo `window.SERVER_URL = "https://cars-hide.onrender.com"`.

---

## 💻 Ejecución Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/<tu-usuario>/<tu-repo>.git
cd Cars_Hide
```

### 2. Instalar dependencias del servidor
```bash
cd server
npm install
```

### 3. Iniciar el servidor
```bash
npm start
```
Abre tu navegador en `http://localhost:3000`.
