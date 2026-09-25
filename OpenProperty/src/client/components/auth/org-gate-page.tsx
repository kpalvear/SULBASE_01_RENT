import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAuth } from "../../hooks/use-auth";

export function OrgGatePage() {
  const { memberships, bootstrapOrganization, setActiveOrganization, signOut } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (memberships.length > 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8">
          <h1 className="text-xl font-semibold">Choose organization</h1>
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.organization_id}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => void setActiveOrganization(m.organization_id)}
                >
                  {m.name}
                  <span className="ml-auto text-xs text-muted-foreground">{m.role}</span>
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </div>
    );
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await bootstrapOrganization(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create organization");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Set up your organization</h1>
          <p className="text-sm text-muted-foreground">
            This workspace will hold your properties, tenants, and leases.
          </p>
        </div>
        <form className="space-y-4" onSubmit={createOrg}>
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Property Management"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Continue"}
          </Button>
        </form>
        <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
