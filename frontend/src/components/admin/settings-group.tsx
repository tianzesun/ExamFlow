/** One group of settings: its name and purpose on the left, the fields on the right. */
export function Group({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-5 py-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
      <div>
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-ink-3">{text}</p>
      </div>
      <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}
