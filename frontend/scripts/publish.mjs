// Copia el build (frontend/dist) a la raíz del repositorio, que es lo que
// sirve server/server.js en Render. Sustituye el bundle anterior.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const root = join(here, "..", "..");

if (!existsSync(join(dist, "index.html"))) {
  console.error("No hay build: ejecuta primero `npm run build`.");
  process.exit(1);
}

// Bundles con hash de despliegues anteriores y ficheros que ya no se usan
const rootAssets = join(root, "assets");
if (existsSync(rootAssets)) {
  for (const f of readdirSync(rootAssets)) {
    if (/^index-[\w-]+\.(js|css)$/.test(f) || f === "filter-engine.js")
      rmSync(join(rootAssets, f));
  }
}
rmSync(join(root, "style-override.css"), { force: true });

cpSync(dist, root, { recursive: true });
console.log("Build publicado en la raíz del repositorio.");
