// Proxy catch-all vers le backend Django — remplace les rewrites() de
// next.config.mjs (retirées). Cause du remplacement : en mode standalone
// (Docker), Next.js FIGE la destination d'un rewrite au moment du `next
// build`, pas à l'exécution — API_URL n'était donc jamais relu au démarrage
// du conteneur malgré la variable d'environnement correctement injectée.
// Un route handler s'exécute à chaque requête : process.env.API_URL est lu
// à la bonne étape (runtime), comme le fait team-tool avec le même pattern.
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8000";

async function proxy(request: NextRequest, path: string[]) {
  const target = `${API_URL}/api/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = { method: request.method, headers };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  // 204/205/304 doivent avoir un corps null (spec Fetch) — construire une
  // Response avec un ArrayBuffer même vide sur ces statuts fait planter
  // NextResponse (TypeError), transformant tout DELETE réussi (Django
  // renvoie 204 No Content) en faux 500 côté proxy alors que la suppression
  // a bien eu lieu en base. Bug trouvé le 2026-08-24 en testant la
  // suppression d'un type de matériel.
  const sansCorps = [204, 205, 304].includes(upstream.status);
  const body = sansCorps ? null : await upstream.arrayBuffer();
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(body, { status: upstream.status, headers: responseHeaders });
}

type Params = { params: { path: string[] } };

export async function GET(request: NextRequest, { params }: Params) { return proxy(request, params.path); }
export async function POST(request: NextRequest, { params }: Params) { return proxy(request, params.path); }
export async function PUT(request: NextRequest, { params }: Params) { return proxy(request, params.path); }
export async function PATCH(request: NextRequest, { params }: Params) { return proxy(request, params.path); }
export async function DELETE(request: NextRequest, { params }: Params) { return proxy(request, params.path); }
