/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // build Docker minimal (team-tool utilise le même pattern)
  // /api/* est géré par src/app/api/[...path]/route.ts (proxy catch-all vers
  // Django, résolu à l'exécution) — pas par rewrites(), figées au build en
  // mode standalone (voir le commentaire dans route.ts pour le pourquoi).
};

export default nextConfig;
