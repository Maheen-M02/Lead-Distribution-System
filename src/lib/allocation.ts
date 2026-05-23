import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

// Mandatory assignment rules per service
const MANDATORY_ASSIGNMENTS: Record<number, number[]> = {
  1: [1],       // Service 1 → Provider 1
  2: [5],       // Service 2 → Provider 5
  3: [1, 4],    // Service 3 → Provider 1 AND Provider 4
};

// Fair allocation pools per service (non-mandatory providers)
const ALLOCATION_POOLS: Record<number, number[]> = {
  1: [2, 3, 4],
  2: [6, 7, 8],
  3: [2, 3, 5, 6, 7, 8],
};

const TOTAL_ASSIGNMENTS_PER_LEAD = 3;
const MAX_RETRIES = 5;

function isRetryableError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  // P1008 = timeout, P2034 = serialization (safety net)
  if (e.code === 'P2034' || e.code === 'P1008') return true;
  const msg = String(e.message ?? '');
  return (
    msg.includes('40001') ||
    msg.includes('40P01') ||
    msg.includes('deadlock') ||
    msg.includes('write conflict') ||
    msg.includes('timed out')
  );
}

async function runAllocationTransaction(leadId: string, serviceId: number): Promise<number[]> {
  return await prisma.$transaction(
    async (tx) => {
      const mandatoryProviderIds = MANDATORY_ASSIGNMENTS[serviceId] || [];
      const pool = ALLOCATION_POOLS[serviceId] || [];
      const remainingSlots = TOTAL_ASSIGNMENTS_PER_LEAD - mandatoryProviderIds.length;
      const allProviderIds = [...new Set([...mandatoryProviderIds, ...pool])];

      // SELECT FOR UPDATE on all relevant provider rows.
      // Concurrent transactions WAIT (queue) on these locks instead of
      // aborting each other (which SERIALIZABLE isolation does).
      if (allProviderIds.length > 0) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Provider" WHERE id = ANY(${allProviderIds}::int[]) ORDER BY id FOR UPDATE`
        );
      }

      // Also lock the AllocationState row for this service
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "AllocationState" WHERE "serviceId" = ${serviceId} FOR UPDATE`
      );

      // Now safely read provider quotas (we hold exclusive row locks)
      const mandatoryProviders = await tx.provider.findMany({
        where: { id: { in: mandatoryProviderIds } },
      });

      const validMandatory: number[] = [];
      for (const provider of mandatoryProviders) {
        if (provider.leadsReceivedCount < provider.monthlyQuota) {
          validMandatory.push(provider.id);
        }
      }

      // Read current allocation state
      const allocationState = await tx.allocationState.findUnique({
        where: { serviceId },
      });
      const currentIndex = allocationState?.nextIndex ?? 0;

      // Read pool providers
      const poolProviders = await tx.provider.findMany({
        where: { id: { in: pool } },
      });

      const eligiblePool = poolProviders
        .filter(
          (p) =>
            p.leadsReceivedCount < p.monthlyQuota &&
            !validMandatory.includes(p.id)
        )
        .map((p) => p.id)
        .sort((a, b) => a - b);

      // Round-robin selection from current index
      const selectedPool: number[] = [];
      if (eligiblePool.length > 0 && remainingSlots > 0) {
        let idx = currentIndex % eligiblePool.length;
        let attempts = 0;
        while (selectedPool.length < remainingSlots && attempts < eligiblePool.length) {
          const provId = eligiblePool[idx % eligiblePool.length];
          if (!selectedPool.includes(provId)) {
            selectedPool.push(provId);
          }
          idx = (idx + 1) % eligiblePool.length;
          attempts++;
        }

        // Advance the allocation index
        const newIndex = (currentIndex + selectedPool.length) % eligiblePool.length;
        await tx.allocationState.upsert({
          where: { serviceId },
          update: { nextIndex: newIndex },
          create: { serviceId, nextIndex: newIndex },
        });
      }

      const finalAssignments = [...new Set([...validMandatory, ...selectedPool])].slice(
        0,
        TOTAL_ASSIGNMENTS_PER_LEAD
      );

      // Create lead assignments and update provider counts
      for (const providerId of finalAssignments) {
        await tx.leadAssignment.create({
          data: { leadId, providerId },
        });

        await tx.provider.update({
          where: { id: providerId },
          data: { leadsReceivedCount: { increment: 1 } },
        });
      }

      return finalAssignments;
    },
    {
      // READ COMMITTED + FOR UPDATE: concurrent txns queue on row locks instead of aborting
      isolationLevel: 'ReadCommitted',
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

export async function assignProvidersToLead(
  leadId: string,
  serviceId: number
): Promise<number[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await runAllocationTransaction(leadId, serviceId);
    } catch (err) {
      lastError = err;
      if (isRetryableError(err)) {
        const base = 50 * Math.pow(2, attempt - 1);
        const jitter = Math.round(base * 0.3 * (Math.random() * 2 - 1));
        const delay = base + jitter;
        console.warn(
          `Allocation tx transient error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms... [${(err as Record<string, unknown>).code ?? 'unknown'}]`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  console.error(`Allocation failed after ${MAX_RETRIES} attempts:`, lastError);
  throw lastError;
}

export { MANDATORY_ASSIGNMENTS, ALLOCATION_POOLS };
