import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { CANONICAL_ORIGIN, jsonLdGraph } from "../shared/public-site";
import { LandingPage } from "./landing-page";

const routes = [
  {
    path: "/",
    id: "landing",
    Component: LandingPage,
  },
];

const LANDING_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", system-ui, sans-serif; background: #f4f1ea; color: #1c1915; }
body { margin: 0; }
a { color: #1f4d3a; }
.top, main, footer { width: min(42rem, calc(100% - 2.5rem)); margin-inline: auto; }
.top { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 0; }
.brand { font-weight: 700; letter-spacing: 0.08em; text-decoration: none; color: inherit; }
.enter { text-decoration: none; font-weight: 600; }
.enter.solid { display: inline-block; margin-top: 0.5rem; background: #1f4d3a; color: #f4f1ea; padding: 0.65rem 1rem; }
.hero h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); line-height: 1.15; letter-spacing: -0.02em; margin: 0.2rem 0 1rem; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.75rem; margin: 0; }
.lead { font-size: 1.125rem; }
section { padding: 0.25rem 0 1.5rem; }
h2 { font-size: 1.25rem; margin-bottom: 0.4rem; }
ul { padding-left: 1.15rem; }
li { margin: 0.35rem 0; }
footer { display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid #d9d3c7; padding: 1.25rem 0 2rem; }
`;

function htmlDocument(body: string): string {
  const jsonLd = JSON.stringify(jsonLdGraph()).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RENT — Gestión de arrendamientos</title>
  <meta name="description" content="RENT de Sulbase: aplicación privada para administrar propiedades, unidades, inquilinos, contratos, rentas y mantenimiento.">
  <link rel="canonical" href="${CANONICAL_ORIGIN}/">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es">
  <meta property="og:site_name" content="RENT">
  <meta property="og:title" content="RENT — Gestión de arrendamientos">
  <meta property="og:description" content="Aplicación privada de Sulbase para administrar propiedades, contratos, rentas y mantenimiento.">
  <meta property="og:url" content="${CANONICAL_ORIGIN}/">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <script type="application/ld+json">${jsonLd}</script>
  <style>${LANDING_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** Pre-rendered public landing. Crawlers receive the full document; there is no client bundle. */
export async function renderLandingDocument(): Promise<string> {
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`${CANONICAL_ORIGIN}/`));
  if (context instanceof Response) {
    throw new Error(`Landing prerender returned HTTP ${context.status}`);
  }
  const router = createStaticRouter(handler.dataRoutes, context);
  const body = renderToString(createElement(StaticRouterProvider, { router, context }));
  const html = htmlDocument(body);
  if (html.includes("noindex")) {
    throw new Error("The public landing must stay indexable");
  }
  return html;
}
