import type { Sql } from "../db";

type PropertyRow = {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  color: string;
};

/** In-memory properties for route-level org isolation tests (no real Postgres). */
export function createOrgIsolationSql(seed: PropertyRow[]): Sql {
  const byId = new Map(seed.map((p) => [p.id, p]));

  const unsafe = async (text: string, params: unknown[] = []) => {
    if (text.includes("FROM properties p WHERE p.organization_id")) {
      const org = params[0] as string;
      return seed.filter((p) => p.organization_id === org);
    }

    if (text.includes("SELECT * FROM properties WHERE id = $1 AND organization_id = $2")) {
      const [id, org] = params as [string, string];
      const row = byId.get(id);
      return row && row.organization_id === org ? [row] : [];
    }

    if (text.includes("DELETE FROM properties WHERE id = $1 AND organization_id = $2")) {
      const [id, org] = params as [string, string];
      const row = byId.get(id);
      if (row && row.organization_id === org) {
        byId.delete(id);
        return [{ count: 1 }];
      }
      return [{ count: 0 }];
    }

    if (text.includes("INSERT INTO properties")) {
      const org = params[0] as string;
      const name = params[1] as string;
      const id = `gen-${byId.size + 1}`;
      const row: PropertyRow = {
        id,
        organization_id: org,
        name,
        type: "single_family",
        color: "sky",
      };
      byId.set(id, row);
      return [row];
    }

    return [];
  };

  return { unsafe } as Sql;
}
