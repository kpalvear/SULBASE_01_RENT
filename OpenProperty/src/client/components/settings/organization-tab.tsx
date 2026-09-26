import { useEffect, useState } from "react";
import { useApp } from "@/context";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";

const TIMEZONES = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
];

type OrgProfile = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  language: "es" | "en";
  date_format: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  area_unit: "m2" | "ft2";
};

export function OrganizationTab() {
  const app = useApp();
  const { role } = useAuth();
  const canEdit = role === "owner" || role === "manager";
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(app.settings.timezone);
  const [currency, setCurrency] = useState(app.settings.currency);
  const [language, setLanguage] = useState(app.settings.language);
  const [dateFormat, setDateFormat] = useState(app.settings.date_format);
  const [areaUnit, setAreaUnit] = useState(app.settings.area_unit);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ organization: OrgProfile }>("GET", "/api/settings/organization")
      .then((res) => {
        if (cancelled) return;
        setName(res.organization.name);
        setTimezone(res.organization.timezone);
        setCurrency(res.organization.currency);
        setLanguage(res.organization.language);
        setDateFormat(res.organization.date_format);
        setAreaUnit(res.organization.area_unit);
      })
      .catch((err: Error) => app.setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [app.setError]);

  const zones = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await api<{ settings: Record<string, string> }>("PATCH", "/api/settings/organization", {
        name: name.trim(),
        timezone,
        currency: currency.trim().toUpperCase(),
        language,
        date_format: dateFormat,
        area_unit: areaUnit,
      });
      app.applySettings(res.settings);
      setNotice("Organización actualizada.");
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold">Organización</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Nombre, zona horaria, moneda, idioma y formato de fecha y área. La organización activa la elige el servidor.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="org-name">Nombre</Label>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        </div>
        <div>
          <Label>Zona horaria</Label>
          <Select value={timezone} onValueChange={setTimezone} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>{zone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="org-currency">Moneda</Label>
          <Input
            id="org-currency"
            value={currency}
            maxLength={3}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Idioma</Label>
          <Select value={language} onValueChange={(v) => setLanguage(v as "es" | "en")} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Formato de fecha</Label>
          <Select
            value={dateFormat}
            onValueChange={(v) => setDateFormat(v as OrgProfile["date_format"])}
            disabled={!canEdit}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dd/MM/yyyy">dd/MM/aaaa</SelectItem>
              <SelectItem value="MM/dd/yyyy">MM/dd/aaaa</SelectItem>
              <SelectItem value="yyyy-MM-dd">aaaa-MM-dd</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Área</Label>
          <Select value={areaUnit} onValueChange={(v) => setAreaUnit(v as "m2" | "ft2")} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="m2">Metros cuadrados (m²)</SelectItem>
              <SelectItem value="ft2">Pies cuadrados (ft²)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {canEdit && (
        <div className="mt-4">
          <Button type="button" onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? "Guardando…" : "Guardar organización"}
          </Button>
        </div>
      )}
      {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
    </Card>
  );
}
