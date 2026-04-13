type Props = {
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function StaticPageShell({ label, title, description, children }: Props) {
  return (
    <div className="mx-auto max-w-screen-lg px-4 pb-16 pt-6">
      <section className="site-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(56,189,248,0.16), transparent 32%), radial-gradient(circle at right center, rgba(251,146,60,0.12), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        />

        <div className="relative">
          <span className="section-label">{label}</span>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{description}</p>
        </div>
      </section>

      <section className="site-panel mt-6 px-6 py-6 sm:px-8 sm:py-8">
        <div className="space-y-8 text-sm leading-7 text-slate-300">{children}</div>
      </section>
    </div>
  );
}
