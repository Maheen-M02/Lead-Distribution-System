'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: number;
  name: string;
}

interface FormState {
  customerName: string;
  phone: string;
  city: string;
  serviceId: string;
  description: string;
}

interface SubmitResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    leadId: string;
    assignedProviders: number[];
    serviceName: string;
  };
}

export default function RequestServicePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<FormState>({
    customerName: '',
    phone: '',
    city: '',
    serviceId: '',
    description: '',
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setServices(data.data);
      });
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<FormState> = {};
    if (!form.customerName.trim()) newErrors.customerName = 'Name is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(form.phone.replace(/\s/g, '')))
      newErrors.phone = 'Enter a valid 10-digit phone number';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.serviceId) newErrors.serviceId = 'Please select a service';
    if (!form.description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          serviceId: Number(form.serviceId),
        }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        setForm({ customerName: '', phone: '', city: '', serviceId: '', description: '' });
        setErrors({});
      }
    } catch {
      setResult({ success: false, error: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid-bg py-12 px-6">
      {/* Ambient */}
      <div className="fixed top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/[0.03] blur-3xl pointer-events-none" />

      <div className="max-w-xl mx-auto relative">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02]">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">New Request</span>
          </div>
          <h1 className="font-display text-4xl font-semibold text-white leading-tight">
            Request a Service
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Fill in the details below and our system will automatically assign the right providers to your request.
          </p>
        </div>

        {/* Form Card */}
        <div className="glass rounded-2xl border border-white/[0.06] p-8 animate-slide-up">
          {result && (
            <div
              className={`mb-6 p-4 rounded-xl border ${
                result.success
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}
            >
              {result.success ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#4ade80" strokeWidth="1.5"/>
                      <path d="M5 8l2.5 2.5L11 5.5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-sm font-medium text-green-400">Lead Submitted Successfully</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Your request for <span className="text-white">{result.data?.serviceName}</span> has been received.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.data?.assignedProviders.map((id) => (
                      <span key={id} className="tag tag-amber">Provider {id}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 flex-shrink-0">
                    <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5"/>
                    <path d="M8 5v4M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-sm text-red-400">{result.error}</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className={`form-input ${errors.customerName ? 'border-red-500/50' : ''}`}
                  placeholder="John Doe"
                  value={form.customerName}
                  onChange={handleChange('customerName')}
                  disabled={loading}
                />
                {errors.customerName && (
                  <p className="mt-1 text-xs text-red-400">{errors.customerName}</p>
                )}
              </div>
              <div>
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className={`form-input ${errors.phone ? 'border-red-500/50' : ''}`}
                  placeholder="9999999999"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  disabled={loading}
                  maxLength={10}
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-400">{errors.phone}</p>
                )}
              </div>
            </div>

            {/* City */}
            <div>
              <label className="form-label">City</label>
              <input
                type="text"
                className={`form-input ${errors.city ? 'border-red-500/50' : ''}`}
                placeholder="Mumbai"
                value={form.city}
                onChange={handleChange('city')}
                disabled={loading}
              />
              {errors.city && (
                <p className="mt-1 text-xs text-red-400">{errors.city}</p>
              )}
            </div>

            {/* Service Type */}
            <div>
              <label className="form-label">Service Type</label>
              <select
                className={`form-input ${errors.serviceId ? 'border-red-500/50' : ''}`}
                value={form.serviceId}
                onChange={handleChange('serviceId')}
                disabled={loading}
              >
                <option value="">Select a service...</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              {errors.serviceId && (
                <p className="mt-1 text-xs text-red-400">{errors.serviceId}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description</label>
              <textarea
                className={`form-input resize-none ${errors.description ? 'border-red-500/50' : ''}`}
                placeholder="Describe what you need..."
                rows={4}
                value={form.description}
                onChange={handleChange('description')}
                disabled={loading}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-400">{errors.description}</p>
              )}
            </div>

            {/* Duplicate note */}
            <p className="text-xs text-slate-600">
              Note: The same phone number cannot submit duplicate requests for the same service.
            </p>

            {/* Submit */}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Submit Request'
              )}
            </button>
          </form>
        </div>

        {/* Info box */}
        <div className="mt-6 glass-light rounded-xl p-4 border border-white/[0.04] animate-slide-up delay-200">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Assignment Rules</h3>
          <div className="space-y-2">
            {[
              { service: 'Service 1', rule: 'Always assigned to Provider 1' },
              { service: 'Service 2', rule: 'Always assigned to Provider 5' },
              { service: 'Service 3', rule: 'Always assigned to Provider 1 & 4' },
            ].map((item) => (
              <div key={item.service} className="flex items-start gap-2 text-xs">
                <span className="tag tag-amber mt-0.5">{item.service}</span>
                <span className="text-slate-500">{item.rule}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
