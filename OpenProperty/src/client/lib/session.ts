const ORG_STORAGE_KEY = "rent_active_organization_id";

export function getStoredOrganizationId(): string | null {
  try {
    return localStorage.getItem(ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredOrganizationId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ORG_STORAGE_KEY, id);
    else localStorage.removeItem(ORG_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
