/**
 * Car Hide — capa de movimiento fluido.
 *
 * Principios (Apple, "Designing Fluid Interfaces"):
 *  - Todo movimiento táctil es un muelle interrumpible que parte del valor
 *    actual en pantalla y hereda la velocidad del dedo.
 *  - Las hojas se arrastran 1:1, ofrecen resistencia elástica en el borde y
 *    deciden cerrar o volver proyectando el impulso del gesto.
 *  - La vibración solo acompaña momentos con significado.
 */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ───────────────────────── Muelle ───────────────────────── */

// Muelle con los dos parámetros de Apple: amortiguación (damping ratio) y
// respuesta (en segundos). Integra en pasos fijos para poder redirigirse en
// cualquier momento conservando posición y velocidad.
export class Spring {
  constructor(value = 0) {
    this.value = value;
    this.velocity = 0;
    this.target = value;
    this.frame = 0;
    this.onUpdate = null;
    this.onRest = null;
  }

  set(value) {
    this.stop();
    this.value = this.target = value;
    this.velocity = 0;
    this.onUpdate && this.onUpdate(value);
  }

  to(target, { damping = 1, response = 0.4, velocity } = {}) {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    if (reducedMotion.matches) {
      this.set(target);
      this.onRest && this.onRest(target);
      return this;
    }
    const w = (2 * Math.PI) / response;
    const k = w * w;
    const c = 2 * damping * w;
    const dt = 1 / 240;
    let last = performance.now();
    cancelAnimationFrame(this.frame);
    const tick = (now) => {
      let elapsed = Math.min(0.064, (now - last) / 1000);
      last = now;
      while (elapsed > 0) {
        const h = Math.min(dt, elapsed);
        const accel = -k * (this.value - this.target) - c * this.velocity;
        this.velocity += accel * h;
        this.value += this.velocity * h;
        elapsed -= h;
      }
      const resting =
        Math.abs(this.value - this.target) < 0.25 && Math.abs(this.velocity) < 4;
      if (resting) {
        this.value = this.target;
        this.velocity = 0;
      }
      this.onUpdate && this.onUpdate(this.value);
      if (resting) {
        this.frame = 0;
        this.onRest && this.onRest(this.value);
      } else this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    return this;
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}

// Punto de reposo proyectado por la inercia (función de Apple).
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Resistencia progresiva más allá de un límite.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

/* ───────────────────────── Vibración ───────────────────────── */

const HAPTICS = {
  tap: [8],
  success: [14, 50, 22],
  warning: [24, 70, 24],
  error: [40, 50, 40, 50, 60],
};

export function haptic(kind = "tap") {
  try {
    navigator.vibrate && navigator.vibrate(HAPTICS[kind] || HAPTICS.tap);
  } catch (e) {}
}

/* ───────────────────────── Hojas inferiores ───────────────────────── */

// Convierte un panel que la app abre/cierra con la clase `.open` en una hoja
// con presentación por muelle y cierre arrastrando. La app sigue siendo la
// dueña del estado: para cerrar, la hoja pulsa el botón de cerrar de la app.
function attachSheet(el, { closeSelector, modal = false }) {
  if (!el || el.__sheet) return;
  const spring = new Spring(0);
  let open = el.classList.contains("open");
  let height = 0;
  let scrim = null;

  const offscreen = () => (height || el.offsetHeight || 400) + 48;

  if (modal) {
    scrim = document.createElement("div");
    scrim.className = "sheet-scrim";
    el.parentNode.insertBefore(scrim, el);
    scrim.addEventListener("click", () => close());
  }

  const render = (y) => {
    el.style.transform = `translate3d(0, ${y}px, 0)`;
    if (scrim) {
      const p = 1 - Math.min(1, Math.max(0, y / offscreen()));
      scrim.style.opacity = String(p);
    }
  };
  spring.onUpdate = render;

  const close = () => {
    const btn = closeSelector && el.querySelector(closeSelector);
    if (btn) btn.click();
    else el.classList.remove("open");
  };

  const present = (velocity = 0) => {
    el.style.visibility = "visible";
    if (scrim) scrim.classList.add("is-visible");
    height = el.offsetHeight;
    spring.onRest = null;
    spring.to(0, { damping: 1, response: 0.36, velocity });
  };

  const dismiss = (velocity = 0) => {
    spring.onRest = () => {
      if (!el.classList.contains("open")) {
        el.style.visibility = "hidden";
        if (scrim) scrim.classList.remove("is-visible");
      }
    };
    spring.to(offscreen(), { damping: 1, response: 0.34, velocity });
  };

  // Estado inicial
  height = el.offsetHeight;
  spring.set(open ? 0 : offscreen());
  el.style.visibility = open ? "visible" : "hidden";
  el.classList.add("is-sheet");

  let pendingVelocity = 0;
  new MutationObserver(() => {
    const now = el.classList.contains("open");
    if (now === open) return;
    open = now;
    const v = pendingVelocity;
    pendingVelocity = 0;
    if (open) {
      if (spring.value === 0 && !spring.frame) spring.set(offscreen());
      present(v);
    } else dismiss(v);
  }).observe(el, { attributes: true, attributeFilter: ["class"] });

  // ── Arrastre 1:1 con proyección de inercia ──
  let drag = null;
  el.addEventListener("pointerdown", (e) => {
    if (!open || e.button > 0) return;
    const scroller = e.target.closest(".chat-messages, .catch-panel-list");
    if (e.target.closest("input, textarea")) return;
    drag = {
      id: e.pointerId,
      startY: e.clientY,
      startValue: spring.value,
      active: false,
      scroller,
      history: [{ y: e.clientY, t: e.timeStamp }],
    };
  });

  el.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      // Histéresis de ~10px antes de comprometerse con el gesto
      if (Math.abs(dy) < 10) return;
      if (dy < 0 && drag.scroller) return (drag = null);
      if (drag.scroller && drag.scroller.scrollTop > 0) return (drag = null);
      drag.active = true;
      drag.startY = e.clientY;
      spring.stop();
      drag.startValue = spring.value;
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
    }
    const raw = drag.startValue + (e.clientY - drag.startY);
    render(raw < 0 ? rubberband(raw, height || 400) : raw);
    spring.value = raw < 0 ? rubberband(raw, height || 400) : raw;
    drag.history.push({ y: e.clientY, t: e.timeStamp });
    if (drag.history.length > 6) drag.history.shift();
    e.preventDefault();
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    el.classList.remove("is-dragging");

    const a = d.history[0];
    const b = d.history[d.history.length - 1];
    const dt = Math.max(1, b.t - a.t);
    const velocity = ((b.y - a.y) / dt) * 1000; // px/s
    const projected = spring.value + project(velocity);
    if (projected > offscreen() * 0.45 || velocity > 900) {
      pendingVelocity = velocity;
      close();
    } else {
      // Vuelta a su sitio heredando la velocidad; algo de rebote porque hubo inercia
      spring.to(0, { damping: 0.82, response: 0.34, velocity });
    }

    // Suprime el click real que el navegador emite tras soltar un arrastre
    const swallow = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    el.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => el.removeEventListener("click", swallow, true), 0);
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  el.__sheet = { present, dismiss, spring };
}

/* ───────────────────────── Avisos (toast) ───────────────────────── */

let currentToast = null;

// Aviso tipo cápsula que entra desde arriba y sale por el mismo camino.
export function toast(message) {
  if (currentToast) currentToast.dismiss(true);
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
  document.body.appendChild(el);

  // Entra y sale por el mismo borde: arriba en general, abajo durante la partida
  const off = document.documentElement.dataset.screen === "game" ? 140 : -120;
  const spring = new Spring(off);
  spring.onUpdate = (y) => {
    el.style.transform = `translate3d(-50%, ${y}px, 0)`;
    el.style.opacity = String(Math.max(0, Math.min(1, 1 - Math.abs(y) / 90)));
  };
  spring.set(off);
  spring.to(0, { damping: 1, response: 0.38 });

  let timer = 0;
  const handle = {
    dismiss(fast) {
      clearTimeout(timer);
      if (currentToast === handle) currentToast = null;
      if (fast) return el.remove();
      spring.onRest = () => el.remove();
      spring.to(off, { damping: 1, response: 0.32 });
    },
  };
  el.addEventListener("click", () => handle.dismiss());
  timer = setTimeout(() => handle.dismiss(), 3200);
  currentToast = handle;
  return handle;
}

/* ───────────────────────── Borde de scroll ───────────────────────── */

// La barra de navegación solo se convierte en material cuando el contenido
// pasa por debajo (efecto de borde de scroll en lugar de un divisor fijo).
function updateScrollEdge() {
  const screen = document.querySelector(".screen.active");
  if (!screen) return;
  const inner = screen.querySelector(".screen-content");
  const y = Math.max(
    window.scrollY || 0,
    inner && inner.scrollHeight > inner.clientHeight ? inner.scrollTop : 0,
  );
  screen.classList.toggle("is-scrolled", y > 4);
}

/* ───────────────────────── Arranque ───────────────────────── */

// El router llama a mount() cada vez que pinta una pantalla.
export function mount(screen, root) {
  document.documentElement.dataset.screen = screen;
  if (screen === "game") {
    attachSheet(root.querySelector("#catch-panel"), {
      closeSelector: "#btn-close-catch",
      modal: true,
    });
    attachSheet(root.querySelector("#chat-floating"), {
      closeSelector: "#btn-close-chat",
    });
  }
  requestAnimationFrame(updateScrollEdge);
}

function init() {
  // iOS solo aplica :active si hay algún listener táctil
  document.addEventListener("touchstart", () => {}, { passive: true });

  window.addEventListener("scroll", updateScrollEdge, { passive: true });
  document.addEventListener("scroll", updateScrollEdge, {
    passive: true,
    capture: true,
  });
}

window.CarHideFX = { Spring, project, rubberband, haptic, toast, mount };

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init);
else init();
