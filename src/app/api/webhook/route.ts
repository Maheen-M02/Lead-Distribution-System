import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcastUpdate } from '@/lib/sse';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, eventType, providerId } = body;

    if (!eventId || !eventType) {
      return NextResponse.json(
        { success: false, error: 'eventId and eventType are required' },
        { status: 400 }
      );
    }

    // Idempotency check — if event already processed, skip
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        message: 'Event already processed (idempotent)',
        alreadyProcessed: true,
      });
    }

    // Process event
    if (eventType === 'quota_reset') {
      // Reset quota for specific provider or all providers
      if (providerId) {
        await prisma.provider.update({
          where: { id: Number(providerId) },
          data: { leadsReceivedCount: 0, monthlyQuota: 10 },
        });
      } else {
        // Reset all providers
        await prisma.provider.updateMany({
          data: { leadsReceivedCount: 0, monthlyQuota: 10 },
        });

        // Reset allocation indices
        await prisma.allocationState.updateMany({
          data: { nextIndex: 0 },
        });
      }
    } else if (eventType === 'clear_data') {
      // Delete all lead assignments, leads, reset provider stats & allocation indices, and clear processed webhook events
      await prisma.$transaction([
        prisma.leadAssignment.deleteMany({}),
        prisma.lead.deleteMany({}),
        prisma.provider.updateMany({
          data: { leadsReceivedCount: 0, monthlyQuota: 10 },
        }),
        prisma.allocationState.updateMany({
          data: { nextIndex: 0 },
        }),
        prisma.webhookEvent.deleteMany({}),
      ]);
    } else {
      return NextResponse.json(
        { success: false, error: 'Unknown event type' },
        { status: 400 }
      );
    }

    // Record the processed event (idempotency key)
    await prisma.webhookEvent.create({
      data: {
        id: eventId,
        eventType,
      },
    });

    // Broadcast dashboard update
    broadcastUpdate('quota-reset', {
      providerId: providerId || null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: eventType === 'clear_data'
        ? 'All lead data cleared and provider stats reset to 0'
        : (providerId ? `Quota reset for Provider ${providerId}` : 'All provider quotas reset to 10'),
      alreadyProcessed: false,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
