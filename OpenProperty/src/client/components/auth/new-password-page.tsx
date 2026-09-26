import { useState } from "react";
import { useAuth } from "../../hooks/use-auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function NewPasswordPage() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">RENT</h1>
          <p className="text-sm text-muted-foreground">Elige una contraseña nueva</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="new-password">Contraseña nueva</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Espera…" : "Guardar contraseña"}
          </Button>
        </form>
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => void signOut()}
        >
          Cancelar y cerrar sesión
        </button>
      </div>
    </div>
  );
}
