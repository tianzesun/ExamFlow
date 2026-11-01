"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { ApiError, errorReference } from "@/lib/api/client";
import { getSignInSettings, saveSignInSettings, type SignInSettings, type SignInSettingsPage } from "@/lib/api/admin";
import { Badge, Button, Input, Skeleton } from "@/components";
import { Group } from "./settings-group";

const ROLE_FIELDS = [
  ["ADMIN", "Administrator"],
  ["STAFF", "Exam office"],
  ["INSTRUCTOR", "Instructor"],
  ["TA", "Teaching assistant"],
] as const;

/** The Entra app registration UTORid sign-in uses. Set here unless the server's environment sets it. */
export function SignInSettingsCard() {
  const [page, setPage] = useState<SignInSettingsPage | null>(null);
  const [form, setForm] = useState<SignInSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = (p: SignInSettingsPage) => {
    setPage(p);
    setForm(p.sign_in);
  };

  useEffect(() => {
    getSignInSettings()
      .then(load)
      .catch((err) => setError(`Sign-in settings couldn't be loaded. Try again in a moment.${errorReference(err)}`));
  }, []);

  if (error) return <section className="surface-card px-5 py-6 text-sm text-danger">{error}</section>;
  if (!page || !form) return <section className="surface-card p-5"><Skeleton className="h-40 w-full" /></section>;

  const locked = page.source === "environment";
  const dirty = JSON.stringify(form) !== JSON.stringify(page.sign_in);
  const set = (key: "tenant_id" | "client_id" | "api_scope", value: string) => setForm({ ...form, [key]: value });
  const setRole = (role: keyof SignInSettings["role_values"], value: string) =>
    setForm({ ...form, role_values: { ...form.role_values, [role]: value } });

  const save = async () => {
    const turningOff = !form.tenant_id.trim() && !form.client_id.trim();
    const changesApp = form.tenant_id !== page.sign_in.tenant_id || form.client_id !== page.sign_in.client_id;
    if (page.enabled && changesApp && !confirm(
      turningOff
        ? "Turn UTORid sign-in off? Only test accounts will be able to sign in."
        : "Switch to this app registration? Everyone signed in with a UTORid will need to sign in again, and if the IDs are wrong nobody can sign in with a UTORid until they're fixed.",
    )) return;
    setSaving(true);
    try {
      load(await saveSignInSettings(form));
      toast.success("Sign-in settings saved. They apply to the next sign-in.");
    } catch (err) {
      // The server says what's wrong with a refused value; anything else stays generic.
      const reason = err instanceof ApiError && (err.status === 400 || err.status === 422)
        ? err.message.replace(/Value error, /g, "") : null;
      toast.error(reason ?? `Sign-in settings couldn't be saved. Try again.${errorReference(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-ink">UTORid sign-in (Microsoft Entra ID)</h2>
          <p className="text-xs text-ink-3">
            The ExamFlow app registration in the university&apos;s Entra tenant. No client secret is needed: the browser
            signs in directly with Microsoft. See SSO-INTEGRATION.md for setting up the registration.
          </p>
        </div>
        {locked ? (
          <Badge variant="default"><Lock className="h-3 w-3" /> Set by the server</Badge>
        ) : page.enabled ? (
          <Badge variant="success">On</Badge>
        ) : (
          <Badge variant="default">Not set up</Badge>
        )}
      </div>

      {locked && (
        <p className="border-b border-line bg-surface-2 px-5 py-2.5 text-xs text-ink-2">
          These come from the server&apos;s environment file, which takes priority over this page. Ask whoever runs the
          server to change them there.
        </p>
      )}

      <div className="divide-y divide-line">
        <Group title="App registration" text="From the registration's Overview page in the Entra admin centre.">
          <Input label="Directory (tenant) ID" value={form.tenant_id} disabled={locked} spellCheck={false}
            placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-xs"
            onChange={(e) => set("tenant_id", e.target.value)} />
          <Input label="Application (client) ID" value={form.client_id} disabled={locked} spellCheck={false}
            placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-xs"
            onChange={(e) => set("client_id", e.target.value)} />
          <Input label="API scope" value={form.api_scope} disabled={locked} spellCheck={false}
            onChange={(e) => set("api_scope", e.target.value)}
            hint={`Under "Expose an API": api://<client ID>/${form.api_scope || "…"}`} />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Redirect URI to register</p>
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink-2">{window.location.origin}/login</p>
            <p className="text-xs text-ink-3">Add it under Authentication as a single-page application.</p>
          </div>
        </Group>

        <Group title="Roles" text="The app role value in Entra that gives each ExamFlow role. Someone with none of them can't use ExamFlow.">
          {ROLE_FIELDS.map(([role, label]) => (
            <Input key={role} label={label} value={form.role_values[role] ?? ""} disabled={locked} spellCheck={false}
              onChange={(e) => setRole(role, e.target.value)} />
          ))}
        </Group>
      </div>

      {!locked && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-5 py-3">
          <p className="text-xs text-ink-3">
            {page.test_accounts
              ? "Leave both IDs empty to turn UTORid sign-in off."
              : "UTORid sign-in can't be turned off here, as it's the only way to sign in."}
          </p>
          <div className="flex gap-2">
            {dirty && <Button variant="ghost" onClick={() => setForm(page.sign_in)} disabled={saving}>Undo changes</Button>}
            <Button onClick={save} loading={saving} disabled={!dirty}>Save sign-in settings</Button>
          </div>
        </div>
      )}
    </section>
  );
}
