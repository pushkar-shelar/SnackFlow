import Dexie, { Table } from 'dexie';

export interface QueuedOrder {
  id?: number | undefined;
  clientUuid: string;
  partyId: string;
  partyName: string;
  lines: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    rate: number;
    uom: string;
  }>;
  totalAmount: number;
  geoLat?: number | undefined;
  geoLng?: number | undefined;
  createdAt: string;
  syncStatus: 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';
  errorMessage?: string | undefined;
}

export class SnackFlowDb extends Dexie {
  queuedOrders!: Table<QueuedOrder, number>;

  constructor() {
    super('SnackFlowOfflineDb');
    this.version(1).stores({
      queuedOrders: '++id, clientUuid, syncStatus, createdAt',
    });
  }
}

export const db = new SnackFlowDb();
