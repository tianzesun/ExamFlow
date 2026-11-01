"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { ApiError, errorReference } from "@/lib/api/client";
import { getSystemSettings, saveSystemSettings, type DeploymentInfo, type SystemSettings } from "@/lib/api/admin";
import { ORDER_OPTIONS, SPACING_OPTIONS, VERSION_OPTIONS } from "@/lib/seating-options";
import { Button, Input, Select, Skeleton } from "@/components";
import { Group } from "./settings-group";
import { SignInSettingsCard } from "./sign-in-settings";

/** Settings an administrator changes, and the server's set-up (read only, from its environment). */
export function SettingsCard() {
  const [saved, setSaved] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<SystemSettings | null>(null);
  // Typed as text so "CSC, MAT" can be edited freely; split on save.
  const [subjects, setSubjects] = useState("");
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = (page: { settings: SystemSettings; deployment: DeploymentInfo }) => {
    setSaved(page.settings);
    setForm(page.settings);
    setSubjects(page.settings.ttb_subjects.join(", "));
    setDeployment(page.deployment);
  };

  useEffect(() => {
    getSystemSettings()
      .then(load)
      .catch((err) => setError(`Settings couldn't be loaded. Try again in a moment.${errorReference(err)}`));
  }, []);

  if (error) return <section className="surface-card px-5 py-6 text-sm text-danger">{error}</section>;
  if (!form || !saved || !deployment) {
    return (
      <section className="surface-card space-y-2 p-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </section>
    );
  }

  const next: SystemSettings = {
    ...form,
    ttb_subjects: subjects.split(/[\s,]+/).filter(Boolean).map((s) => s.toUpperCase()),
  };
  const dirty = JSON.stringify(next) !== JSON.stringify(saved);
  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => setForm({ ...form, [key]: value });
  const setSeating = (key: keyof SystemSettings["default_seating"], value: string) =>
    set("default_seating", { ...form.default_seating, [key]: key === "versions" ? Number(value) : value });

  const save = async () => {
    setSaving(true);
    try {
      load(await saveSystemSettings(next));
      toast.success("Settings saved. They apply from the next sync, new exam or upload.");
    } catch (err) {
      // A value the server refused says why; anything else stays generic.
      const reason = err instanceof ApiError && err.status === 422 ? err.message.replace(/Value error, /g, "") : null;
      toast.error(reason ?? `Settings couldn't be saved. Try again.${errorReference(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Settings</h2>
          <p className="text-xs text-ink-3">
            Changes apply from the next timetable sync, new exam or upload. Courses, exams and papers already in
            ExamFlow stay as they are. Every change is recorded under Activity.
          </p>
        </div>

        <div className="divide-y divide-line">
          <Group title="Department and Timetable Builder" text="Which courses the sync on the Courses page brings in.">
            <Input label="Department name" value={form.department_name} maxLength={120}
              onChange={(e) => set("department_name", e.target.value)}
              hint="Given to courses the sync adds." />
            <Input label="Division code" value={form.ttb_division} maxLength={10}
              onChange={(e) => set("ttb_division", e.target.value.toUpperCase())}
              hint="The Timetable Builder division, e.g. ARTSC (Arts & Science)." />
            <Input label="Course code prefixes" value={subjects} onChange={(e) => setSubjects(e.target.value)}
              hint="Separate with commas, e.g. CSC, MAT. Only courses starting with these are synced." />
          </Group>

          <Group title="Seating for new exams" text="Each exam starts with these rules; staff can still change them on its Seating page.">
            <Select label="Seat order" id="default-order" options={ORDER_OPTIONS} value={form.default_seating.order}
              onChange={(e) => setSeating("order", e.target.value)} />
            <Select label="Spacing" id="default-spacing" options={SPACING_OPTIONS} value={form.default_seating.spacing}
              onChange={(e) => setSeating("spacing", e.target.value)} />
            <Select label="Paper versions" id="default-versions" options={VERSION_OPTIONS}
              value={String(form.default_seating.versions)} onChange={(e) => setSeating("versions", e.target.value)} />
          </Group>

          <Group title="Exam papers" text="Limits on what can be uploaded.">
            <Input label="Largest exam paper upload (MB)" type="number" min={1} max={200}
              value={form.max_upload_mb}
              onChange={(e) => set("max_upload_mb", Number(e.target.value))}
              hint="Between 1 and 200 MB." />
          </Group>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
          {dirty && (
            <Button variant="ghost" onClick={() => load({ settings: saved, deployment })} disabled={saving}>
              Undo changes
            </Button>
          )}
          <Button onClick={save} loading={saving} disabled={!dirty}>Save settings</Button>
        </div>
      </section>

      <SignInSettingsCard />

      <section className="surface-card overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">This server</h2>
          <p className="text-xs text-ink-3">
            Set when ExamFlow is deployed (see OPERATIONS.md), not here. Ask whoever runs the server to change these.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <Fact label="Environment">{deployment.environment}</Fact>
          <Fact label="Test accounts"><OnOff on={deployment.test_accounts} onText="On" offText="Off" /></Fact>
          <Fact label="Rate limits"><OnOff on={deployment.rate_limits} onText="On" offText="Off" /></Fact>
          <Fact label="QR codes on papers link to"><span className="font-mono text-xs">{deployment.public_app_url}</span></Fact>
          <Fact label="File storage">{deployment.storage}</Fact>
        </dl>
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate text-ink">{children}</dd>
    </div>
  );
}

function OnOff({ on, onText, offText }: { on: boolean; onText: string; offText: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> {onText}</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-ink-3"><CircleSlash className="h-4 w-4" /> {offText}</span>
  );
}
