import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        leadAssignments: {
          include: {
            lead: {
              include: { service: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
      orderBy: { id: 'asc' },
    });

    const totalLeads = await prisma.lead.count();

    const formattedProviders = providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      monthlyQuota: provider.monthlyQuota,
      leadsReceivedCount: provider.leadsReceivedCount,
      remainingQuota: Math.max(0, provider.monthlyQuota - provider.leadsReceivedCount),
      leads: provider.leadAssignments.map((assignment) => ({
        id: assignment.lead.id,
        customerName: assignment.lead.customerName,
        phone: assignment.lead.phone,
        city: assignment.lead.city,
        description: assignment.lead.description,
        serviceName: assignment.lead.service.name,
        assignedAt: assignment.assignedAt.toISOString(),
        createdAt: assignment.lead.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        providers: formattedProviders,
        totalLeads,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
