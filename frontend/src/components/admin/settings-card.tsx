"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { ApiError, errorReference } from "@/lib/api/client";
import { getSystemSettings, saveSystemSettings, type DeploymentInfo, type SystemSettings } from "@/lib/api/admin";
import { FILL_OPTIONS, FRONT_ROW_OPTIONS, ORDER_OPTIONS, SPACING_OPTIONS, VERSION_OPTIONS } from "@/lib/seating-options";
import { Button, Input, Select, Skeleton } from "@/components";
import { Group } from "./settings-group";
import { SignInSettingsCard } from "./sign-in-settings";
import { RetentionDue } from "./retention-due";

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
  const setStamp = (key: keyof SystemSettings["paper_stamp"], value: boolean) =>
    set("paper_stamp", { ...form.paper_stamp, [key]: value });
  const setRetention = (key: keyof SystemSettings["retention"], value: string) =>
    set("retention", { ...form.retention, [key]: value.trim() === "" ? null : Number(value) });
  const setSeating = (key: keyof SystemSettings["default_seating"], value: string) =>
    set("default_seating", {
      ...form.default_seating,
      [key]: key === "versions" ? Number(value) : key === "front_row_empty" ? value === "empty" : value,
    });

  const save = async () => {
    setSaving(true);
    try {
      load(await saveSystemSettings(next));
      toast.success("Settings saved.");
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
            Changes apply from the next timetable sync, new exam, upload or document. Courses and exams already in
            ExamFlow stay as they are; papers follow the paper settings when next updated. Every change is recorded
            under Activity.
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

          <Group title="New exams" text="What a new exam starts with; staff can still change each exam, including its seating rules on the Seating page.">
            <Input label="Duration (minutes)" type="number" min={15} max={600} value={form.default_duration_minutes}
              onChange={(e) => set("default_duration_minutes", Number(e.target.value))} />
            <Input label="Start time" type="time" value={form.default_start_time}
              onChange={(e) => set("default_start_time", e.target.value)} hint="Leave empty for none." />
            <Select label="Seat order" id="default-order" options={ORDER_OPTIONS} value={form.default_seating.order}
              onChange={(e) => setSeating("order", e.target.value)} />
            <Select label="Spacing" id="default-spacing" options={SPACING_OPTIONS} value={form.default_seating.spacing}
              onChange={(e) => setSeating("spacing", e.target.value)} />
            <Select label="Paper versions" id="default-versions" options={VERSION_OPTIONS}
              value={String(form.default_seating.versions)} onChange={(e) => setSeating("versions", e.target.value)} />
            <Select label="Rooms" id="default-fill" options={FILL_OPTIONS} value={form.default_seating.fill}
              onChange={(e) => setSeating("fill", e.target.value)} />
            <Select label="Front row" id="default-front-row" options={FRONT_ROW_OPTIONS}
              value={form.default_seating.front_row_empty ? "empty" : "use"}
              onChange={(e) => setSeating("front_row_empty", e.target.value)} />
          </Group>

          <Group
            title="Exam papers"
            text="What is printed on each student's paper. Room, seat and the QR code are always printed. Changing this makes papers already made out of date, so they are regenerated with the next update."
          >
            <div className="space-y-2.5 md:col-span-2">
              <Check checked={form.paper_stamp.show_name} onChange={(v) => setStamp("show_name", v)}
                label="Print the student's name"
                text="Turn off for anonymous marking: the paper then shows the student number instead." />
              <Check checked={form.paper_stamp.show_utorid} onChange={(v) => setStamp("show_utorid", v)}
                label="Print the student's UTORid" text="Next to the student number." />
              <Check checked={form.paper_stamp.every_page} onChange={(v) => setStamp("every_page", v)}
                label="Stamp every page"
                text="A slim line on each later page, so a page that comes loose can be matched to its student." />
            </div>
            <Input label="Largest exam paper upload (MB)" type="number" min={1} max={200}
              value={form.max_upload_mb}
              onChange={(e) => set("max_upload_mb", Number(e.target.value))}
              hint="Between 1 and 200 MB." />
          </Group>

          <Group
            title="Keeping data"
            text="How many days after the exam its data is deleted. Leave empty to keep it. Set these only once the periods are approved (see DATA-CLASSIFICATION.md). Deletion runs daily, archives the exam, and can't be undone."
          >
            <Input label="Students' papers (days)" type="number" min={1} max={3650}
              value={form.retention.papers_days ?? ""} placeholder="Keep"
              onChange={(e) => setRetention("papers_days", e.target.value)}
              hint="Each student's stamped paper. Suggested: 365." />
            <Input label="Uploaded exam papers (days)" type="number" min={1} max={3650}
              value={form.retention.exam_papers_days ?? ""} placeholder="Keep"
              onChange={(e) => setRetention("exam_papers_days", e.target.value)}
              hint="The exam paper PDFs staff uploaded. Suggested: 730." />
            <Input label="Rosters and seating (days)" type="number" min={1} max={3650}
              value={form.retention.rosters_days ?? ""} placeholder="Keep"
              onChange={(e) => setRetention("rosters_days", e.target.value)}
              hint="Roster, seats, attendance and accommodations, with the papers. Student records no exam uses go too. Suggested: 730." />
            <div className="md:col-span-2">
              <RetentionDue saved={saved.retention} />
            </div>
          </Group>

          <Group title="Exam-day documents" text="Signature lists, seating lists, seating maps and the exam summary.">
            <Input label="Heading" value={form.document_heading} maxLength={150}
              placeholder="University of Toronto · Department of Computer Science"
              onChange={(e) => set("document_heading", e.target.value)}
              hint="Printed above each document's title. Leave empty for none." />
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

function Check({ checked, onChange, label, text }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; text: string;
}) {
  return (
    <label className="flex cursor-pointer select-none items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-3">{text}</span>
      </span>
    </label>
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
