/** Where Supabase email confirmation / magic links should return the user. */
export function getEmailRedirectUrl(): string {
  const explicit = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  const base = explicit || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/\/$/, "") + "/";
}

/** If the URL hash contains a Supabase auth error, return it and clean the hash. */
export function parseAndClearAuthHashError(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const error = params.get("error");
  if (!error) return null;
  const description = params.get("error_description");
  const message = description
    ? decodeURIComponent(description.replace(/\+/g, " "))
    : error;
  const clean = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", clean);
  return message;
}
