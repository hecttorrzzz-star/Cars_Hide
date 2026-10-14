# Car Hide — Frontend (proyecto Vite)

Esta carpeta contiene el frontend en forma **editable y compilable**.

## Origen y limitaciones

El código original no estaba disponible; solo el bundle compilado (`assets/index-BajZ5J3I.js`).
`src/main.js` es ese bundle **formateado con Prettier** (no minificado), y `src/style.css` el CSS
original formateado. Los nombres de variables siguen siendo los minificados (`ut`, `ct`, `Ve`, ...),
y las librerías (Leaflet, Leaflet-Geoman, socket.io-client) siguen incrustadas en el mismo archivo.
Es una base para trabajar, no el fuente original. Conviene ir extrayendo módulos con nombres claros
(socket, mapa, HUD, captura, ...) y sustituir las librerías incrustadas por dependencias de npm.

## Uso

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, con proxy a ../server (npm start, puerto 3000)
npm run build    # genera frontend/dist
```

Para desplegar el build actual, copia el contenido de `dist/` sobre la raíz del repo
(`index.html`, `assets/`, `filter-engine.js`, `style-override.css`, `favicon.svg`),
que es lo que sirve `server/server.js`. Los cambios sobre `public/` y `index.html` se hacen aquí.
