// This is a versioned public contract. Remotes never import one another's internals.
export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}
export interface Order {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  category: string;
}
export interface LabEvent {
  type: 'order:created' | 'session:changed';
  version: 1;
  source: string;
  payload: { orderId?: string; userId?: string };
}
export interface Platform {
  user: User | null;
  navigate: (path: string) => void;
  emit: (event: LabEvent) => void;
  subscribe: (listener: (event: LabEvent) => void) => () => void;
}
export interface AppProps {
  platform: Platform;
  path: string;
}
export interface Release {
  app: string;
  version: string;
  entry: string;
  previous_version?: string;
  updated_at?: string;
}
export interface Manifest {
  apps: Record<string, Release>;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.error || 'Request failed');
  return data;
}
export function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
export function createBus() {
  const listeners = new Set<(event: LabEvent) => void>();
  return {
    emit(event: LabEvent) {
      if (event.version !== 1) throw Error('Unsupported event contract');
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener failed', error);
        }
      }
    },
    subscribe(listener: (event: LabEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
