# Car Hide — Frontend (proyecto Vite)

Código editable y compilable del frontend.

## Estructura

```
frontend/
├── index.html            ← Plantilla HTML (metadatos, PWA, imagen social)
├── src/
│   ├── main.js           ← App (pantallas, socket, mapa). Ver «Origen» más abajo
│   ├── style.css         ← CSS base original + Leaflet / Leaflet-Geoman
│   ├── theme.css         ← Sistema de diseño «Nocturna» (manda sobre style.css)
│   └── fluid.js          ← Movimiento: muelles, hojas arrastrables, avisos, vibración
├── public/               ← Iconos, manifest, imagen social, filter-engine.js
└── scripts/publish.mjs   ← Copia el build a la raíz del repositorio
```

## Diseño «Nocturna»

Una persecución nocturna por la ciudad: asfalto casi negro, ámbar de farola como
acento, rojo de piloto trasero para quien busca y azul noche para quien se esconde.
Sigue los principios de interfaz fluida de Apple:

- **Materiales translúcidos** sobre el mapa (isla de estado, botones, hojas).
- **Controles familiares de iOS**: listas agrupadas, interruptores, botones cápsula.
- **Tipografía del sistema** (SF Pro en iPhone, Roboto en Android) con tracking
  según tamaño; `1rem` sigue al Texto dinámico de iOS.
- **Movimiento por muelles** (damping / response): las hojas de chat y captura se
  arrastran 1:1 y se cierran proyectando la inercia del dedo.
- **Accesibilidad**: respeta *reducir movimiento*, *reducir transparencia* y
  *aumentar contraste*.

Los colores, radios, tipografía y curvas de muelle son tokens en `:root` de
`src/theme.css`.

## Uso

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173, con proxy a ../server (npm start, puerto 3000)
npm run build     # genera frontend/dist
npm run release   # build + copia a la raíz del repo, que es lo que se despliega
```

Después de `npm run release`, haz commit de los cambios de la raíz
(`index.html`, `assets/`, iconos…) para que Render los sirva.

## Origen y limitaciones

El código fuente original no estaba disponible; `src/main.js` parte del bundle
compilado y formateado con Prettier. Por eso los nombres de variables siguen
minificados (`ut`, `ct`, `Ve`…) y Leaflet, Leaflet-Geoman y socket.io-client están
incrustados en el mismo archivo. Las pantallas de la app (desde `function Jl` para
el inicio) ya están reescritas y son legibles.
