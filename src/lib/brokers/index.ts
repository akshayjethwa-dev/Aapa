import { UpstoxBrokerService } from './upstox';
import { BrokerService } from './types';

export * from './types';

export const getBrokerService = (brokerName: string): BrokerService => {
  const normalized = brokerName.toLowerCase();
  if (normalized === 'upstox') return new UpstoxBrokerService();
  throw new Error(`Unsupported broker: ${brokerName}`);
};