import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid-bg flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-blue-500/[0.03] blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-2xl animate-fade-in">
        {/* Tag */}
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5">
          <span className="status-dot active" />
          <span className="text-xs font-medium text-amber-400 tracking-wider uppercase">Lead Distribution System</span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl md:text-6xl font-semibold text-white leading-[1.1] mb-5">
          Prowider
          <span className="block text-amber-400">Mini Platform</span>
        </h1>

        <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg mx-auto">
          Automated lead capture, intelligent distribution, and real-time provider dashboards — built for reliability.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/request-service" className="btn-primary px-8 py-3 text-sm">
            Submit a Lead
          </Link>
          <Link href="/dashboard" className="btn-secondary px-8 py-3 text-sm">
            View Dashboard
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="relative z-10 mt-20 grid grid-cols-3 gap-px bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.05] max-w-lg w-full animate-slide-up delay-300">
        {[
          { label: 'Providers', value: '8' },
          { label: 'Services', value: '3' },
          { label: 'Monthly Quota', value: '10' },
        ].map((stat) => (
          <div key={stat.label} className="bg-navy-900 px-6 py-4 text-center">
            <div className="font-display text-2xl font-semibold text-amber-400">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
