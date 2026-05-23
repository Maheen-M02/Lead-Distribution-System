export interface LeadFormData {
  customerName: string;
  phone: string;
  city: string;
  serviceId: number;
  description: string;
}

export interface ProviderWithStats {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceivedCount: number;
  remainingQuota: number;
  leads: AssignedLead[];
}

export interface AssignedLead {
  id: string;
  customerName: string;
  phone: string;
  city: string;
  description: string;
  serviceName: string;
  assignedAt: string;
  createdAt: string;
}

export interface DashboardData {
  providers: ProviderWithStats[];
  totalLeads: number;
  lastUpdated: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
