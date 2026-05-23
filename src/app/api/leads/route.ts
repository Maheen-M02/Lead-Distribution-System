import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assignProvidersToLead } from '@/lib/allocation';
import { broadcastUpdate } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, phone, city, serviceId, description } = body;

    // Validate required fields
    if (!customerName || !phone || !city || !serviceId || !description) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate phone number (basic)
    if (!/^\d{10}$/.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Phone number must be 10 digits' },
        { status: 400 }
      );
    }

    // Validate service exists
    const service = await prisma.service.findUnique({
      where: { id: Number(serviceId) },
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Invalid service selected' },
        { status: 400 }
      );
    }

    // Create lead (duplicate check enforced by DB unique constraint on [phone, serviceId])
    let lead;
    try {
      lead = await prisma.lead.create({
        data: {
          customerName: customerName.trim(),
          phone: phone.replace(/\s/g, ''),
          city: city.trim(),
          serviceId: Number(serviceId),
          description: description.trim(),
        },
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `This phone number has already submitted a request for ${service.name}. Duplicate leads are not allowed.`,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    // Assign providers using fair allocation
    const assignedProviderIds = await assignProvidersToLead(lead.id, Number(serviceId));

    // Fetch the full lead with assignments for broadcasting
    const fullLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: {
        service: true,
        assignments: {
          include: { provider: true },
        },
      },
    });

    // Broadcast to all connected SSE clients
    broadcastUpdate('new-lead', {
      leadId: lead.id,
      customerName: lead.customerName,
      serviceName: service.name,
      assignedProviders: assignedProviderIds,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Lead created and providers assigned successfully',
      data: {
        leadId: lead.id,
        assignedProviders: assignedProviderIds,
        serviceName: service.name,
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    console.error('Lead creation error:', {
      code: err?.code,
      message: err?.message,
      meta: err?.meta,
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        service: true,
        assignments: {
          include: { provider: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, data: leads });
  } catch (error) {
    console.error('Fetch leads error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
