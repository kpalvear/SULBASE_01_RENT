import type { WorkerBindings } from "../env";
import { canonicalRedirectTarget, isAppPath, legacyRedirectPath } from "../../shared/public-site";

function canonicalRedirectEnabled(env: WorkerBindings): boolean {
  return env.CANONICAL_REDIRECT === "true";
}

async function serveSpa(request: Request, assets: Fetcher): Promise<Response> {
  const url = new URL(request.url);
  const assetLike = url.pathname.startsWith("/app/assets/") || /\.[a-z0-9]+$/i.test(url.pathname);
  if (assetLike && url.pathname !== "/app/index.html") {
    return assets.fetch(request);
  }

  const indexUrl = new URL("/app/index.html", url.origin);
  const indexResponse = await assets.fetch(new Request(indexUrl));
  if (!indexResponse.ok) {
    return new Response("App shell missing", { status: 503 });
  }
  const headers = new Headers(indexResponse.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Cache-Control", "no-cache");
  return new Response(indexResponse.body, {
    status: indexResponse.status,
    statusText: indexResponse.statusText,
    headers,
  });
}

/** Public HTML, legacy redirects, and the /app shell. `/api/*` never reaches this function. */
export async function handlePublicRequest(
  request: Request,
  env: WorkerBindings,
): Promise<Response> {
  const url = new URL(request.url);
  const canonical = canonicalRedirectTarget(url, canonicalRedirectEnabled(env));
  if (canonical) return Response.redirect(canonical, 301);

  const legacy = legacyRedirectPath(url.pathname);
  if (legacy) {
    const destination = new URL(legacy, url.origin);
    destination.search = url.search;
    return Response.redirect(destination.toString(), 301);
  }

  if (isAppPath(url.pathname)) return serveSpa(request, env.ASSETS);
  return env.ASSETS.fetch(request);
}
