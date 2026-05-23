'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProviderWithStats } from '@/types';

interface DashboardData {
  providers: ProviderWithStats[];
  totalLeads: number;
  lastUpdated: string;
}

function QuotaBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color =
    pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
  return (
    <div className="quota-bar mt-2">
      <div
        className="quota-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function ProviderCard({
  provider,
  isNew,
}: {
  provider: ProviderWithStats;
  isNew: boolean;
}) {
  const pct = Math.min(
    100,
    Math.round((provider.leadsReceivedCount / provider.monthlyQuota) * 100)
  );
  const statusClass =
    pct >= 100 ? 'inactive' : pct >= 70 ? 'warning' : 'active';

  return (
    <div
      className={`glass rounded-xl border transition-all duration-500 ${
        isNew
          ? 'border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.1)]'
          : 'border-white/[0.06] hover:border-white/[0.1]'
      }`}
    >
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy-700 border border-white/[0.08] flex items-center justify-center">
            <span className="font-mono text-xs font-medium text-slate-300">
              P{provider.id}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{provider.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`status-dot ${statusClass}`} />
              <span className="text-xs text-slate-500">
                {pct >= 100 ? 'Quota full' : pct >= 70 ? 'Near limit' : 'Active'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold font-mono text-white">
            {provider.remainingQuota}
            <span className="text-xs text-slate-600 font-sans">/{provider.monthlyQuota}</span>
          </div>
          <div className="text-xs text-slate-500">remaining</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-5 py-3 grid grid-cols-2 gap-4 border-b border-white/[0.04]">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Leads Received</div>
          <div className="text-xl font-semibold font-mono text-amber-400 mt-0.5">
            {provider.leadsReceivedCount}
          </div>
          <QuotaBar used={provider.leadsReceivedCount} total={provider.monthlyQuota} />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Quota Used</div>
          <div className="text-xl font-semibold font-mono text-white mt-0.5">{pct}%</div>
          <div className="text-xs text-slate-600 mt-1">of monthly limit</div>
        </div>
      </div>

      {/* Leads List */}
      <div className="px-5 py-3">
        <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">
          Recent Assignments ({provider.leads.length})
        </div>
        {provider.leads.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-600">No leads assigned yet</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {provider.leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-start justify-between gap-2 py-2 border-b border-white/[0.03] last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {lead.customerName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {lead.city} · {lead.phone}
                  </div>
                </div>
                <span className="tag tag-blue flex-shrink-0 text-[10px]">
                  {lead.serviceName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting');
  const [newProviderIds, setNewProviderIds] = useState<number[]>([]);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Connect to SSE
    const eventSource = new EventSource('/api/sse');

    eventSource.addEventListener('connected', () => {
      setLiveStatus('live');
    });

    eventSource.addEventListener('new-lead', (e) => {
      const event = JSON.parse(e.data);
      setLastEvent(`New lead — ${event.serviceName} — ${new Date().toLocaleTimeString()}`);
      setNewProviderIds(event.assignedProviders || []);
      fetchData();
      // Clear highlight after 5s
      setTimeout(() => setNewProviderIds([]), 5000);
    });

    eventSource.addEventListener('quota-reset', () => {
      setLastEvent(`Quota reset — ${new Date().toLocaleTimeString()}`);
      fetchData();
    });

    eventSource.onerror = () => {
      setLiveStatus('disconnected');
    };

    return () => {
      eventSource.close();
    };
  }, [fetchData]);

  const totalLeads = data?.totalLeads ?? 0;
  const activeProviders = data?.providers.filter((p) => p.remainingQuota > 0).length ?? 0;
  const avgUsage =
    data?.providers.length
      ? Math.round(
          (data.providers.reduce((sum, p) => sum + p.leadsReceivedCount, 0) /
            (data.providers.length * 10)) *
            100
        )
      : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] py-10 px-6 relative">
      {/* Ambient */}
      <div className="fixed top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-blue-500/[0.02] blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-3xl font-semibold text-white">Provider Dashboard</h1>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
                  liveStatus === 'live'
                    ? 'bg-green-500/5 border-green-500/20 text-green-400'
                    : liveStatus === 'connecting'
                    ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                    : 'bg-red-500/5 border-red-500/20 text-red-400'
                }`}
              >
                <span
                  className={`status-dot ${
                    liveStatus === 'live' ? 'active' : liveStatus === 'connecting' ? 'warning' : 'inactive'
                  }`}
                />
                {liveStatus === 'live' ? 'Live' : liveStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Real-time provider quota and lead assignment overview
            </p>
          </div>

          {lastEvent && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-amber-400 animate-slide-down">
              <span className="status-dot warning" />
              {lastEvent}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 animate-slide-up">
          {[
            { label: 'Total Leads', value: totalLeads, sub: 'all time' },
            { label: 'Active Providers', value: activeProviders, sub: 'with remaining quota' },
            { label: 'Avg Quota Used', value: `${avgUsage}%`, sub: 'across all providers' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`glass rounded-xl border border-white/[0.06] px-6 py-4 delay-${(i + 1) * 100}`}
            >
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{stat.label}</div>
              <div className="text-3xl font-semibold font-mono text-white">{stat.value}</div>
              <div className="text-xs text-slate-600 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Providers Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-xl border border-white/[0.04] h-64 shimmer" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.providers.map((provider, i) => (
              <div
                key={provider.id}
                className="animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <ProviderCard
                  provider={provider}
                  isNew={newProviderIds.includes(provider.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Last Updated */}
        {data && (
          <div className="mt-6 text-xs text-slate-700 text-center">
            Last updated {new Date(data.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
