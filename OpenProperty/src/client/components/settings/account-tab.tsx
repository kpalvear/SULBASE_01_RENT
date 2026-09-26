import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountTab() {
  const auth = useAuth();
  const user = auth.user;
  const metadata = user?.user_metadata as { display_name?: string } | undefined;
  const [name, setName] = useState(metadata?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!user) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Los cambios de cuenta usan Supabase Auth. En el modo local sin inicio de sesión no hay un usuario que editar.
      </Card>
    );
  }

  async function run(key: string, action: () => Promise<void>, ok: string) {
    setError(null);
    setNotice(null);
    setBusy(key);
    try {
      await action();
      setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold">Nombre para mostrar</h2>
        <p className="mb-4 text-xs text-muted-foreground">Se guarda en tu perfil de Supabase.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="display-name">Nombre</Label>
            <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <Button
            type="button"
            disabled={busy !== null || !name.trim()}
            onClick={() =>
              void run("name", () => auth.updateDisplayName(name.trim()), "Nombre actualizado.")
            }
          >
            {busy === "name" ? "Guardando…" : "Guardar nombre"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold">Correo</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          El cambio se confirma por correo antes de aplicarse. El enlace vuelve a esta misma dirección.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="account-email">Correo</Label>
            <Input
              id="account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={busy !== null || !email.trim() || email.trim() === user.email}
            onClick={() =>
              void run(
                "email",
                () => auth.updateEmail(email.trim()),
                "Revisa tu correo para confirmar el cambio.",
              )
            }
          >
            {busy === "email" ? "Enviando…" : "Cambiar correo"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold">Contraseña</h2>
        <p className="mb-4 text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="account-password">Contraseña nueva</Label>
            <Input
              id="account-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="account-password-2">Confirmar</Label>
            <Input
              id="account-password-2"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            type="button"
            disabled={busy !== null || password.length < 6}
            onClick={() => {
              if (password !== confirm) {
                setNotice(null);
                setError("Las contraseñas no coinciden.");
                return;
              }
              void run("password", async () => {
                await auth.updatePassword(password);
                setPassword("");
                setConfirm("");
              }, "Contraseña actualizada.");
            }}
          >
            {busy === "password" ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold">Sesiones</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Cierra la sesión en este navegador y en el resto de dispositivos.
        </p>
        <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void auth.signOutEverywhere()}>
          Cerrar sesión en todos los dispositivos
        </Button>
      </Card>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
