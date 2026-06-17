import 'server-only';
import { queryAuditQueue, type AuditQueueItem } from '@peaceclock/db';

export async function getAuditQueue(): Promise<AuditQueueItem[]> {
  try {
    return await queryAuditQueue();
  } catch (error) {
    console.error('[getAuditQueue] error:', error);
    return [];
  }
}
