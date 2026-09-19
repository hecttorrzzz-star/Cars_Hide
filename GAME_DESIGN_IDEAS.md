# 🚗 Car Hide — Game Design & Roadmap de Mejoras

Documento de ideas, mecánicas y mejoras de diseño para la evolución de Car Hide.

---

## 🎯 1. Sistema de Captura Táctico por Mapa (Reconocimiento / "Spotting")

### Concepto:
En lugar de abrir un menú con una lista de nombres, el Buscador (Seeker) interactúa **directamente sobre el mapa**:

* **Mecánica:**
  1. El Seeker ve físicamente un coche en una calle o rotonda.
  2. En su pantalla, toca la posición de la calle en el mapa donde ha visto el coche.
  3. Se genera un **"Radar Ping"** en ese punto.
  4. El servidor comprueba por GPS si algún Hider está dentro del radio (ej: 75 metros) de ese punto marcado.
  5. **Si acierta:** ¡Jugador cazado! Salta la alarma global y se revela la baja.
  6. **Si falla:** Se aplica un *cooldown* de 30 segundos para evitar que el buscador haga spam de toques en el mapa.

### Ventajas:
* 100% interactivo y visual en el mapa.
* Evita trampas sin necesidad de que el Seeker sepa el nombre exacto de la persona que va en ese coche.
* Crea una experiencia de "reconocimiento militar / satélite táctico".

---

## 📡 2. Pings de Sonar Periódicos (Dinámica de Partida)

* **Problema:** En zonas grandes o con pocos coches, el juego puede ralentizarse.
* **Solución:** Cada 4 o 5 minutos, la app emite un **pulso de sonar**:
  * Durante 10 segundos, en el mapa del Seeker se ilumina el **distrito / sector general** donde hay coches escondidos (sin dar la calle exacta).
  * A los Hiders les avisa: *"¡Sonar detectado! El Seeker conoce tu sector aproximado"*.

---

## ⚡ 3. Habilidades y Power-ups Tácticos

### Para el Buscador (Seeker):
* **Modo Fantasma (Stealth):** Apaga su señal de GPS en el radar de los rivales durante 45 segundos para realizar una emboscada silenciosa.
* **Escáner Térmico (UAV):** Revela durante 5 segundos la dirección general en la que se mueve el Hider más cercano.

### Para los Escondidos (Hiders):
* **Señuelo GPS (Decoy):** Coloca un coche señuelo falso en una calle para despistar al Seeker.
* **Inmunidad de Tormenta Temporal:** 60 segundos extra para cruzar una zona cerrada sin recibir daño ni alerta.

---

## 🛡️ 4. Seguridad y Dinámica Piloto / Copiloto

* **Modo Copiloto Obligatorio:** Bloqueo de pantalla si se detecta velocidad sin confirmación del copiloto.
* **Alerta de Exceso de Velocidad:** Si el GPS detecta más de la velocidad legal de la vía (ej: >50 km/h en ciudad), la app advierte o inhabilita temporalmente habilidades para priorizar la seguridad vial.
