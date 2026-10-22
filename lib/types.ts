export type Role = "admin" | "coordinator" | "worker" | "partner";
export type Status =
  | "Ready"
  | "Assigned"
  | "Collected"
  | "Received"
  | "Verified"
  | "Cancelled"
  | "Failed"
  | "Disputed";
export interface Batch {
  id: string;
  org_id: string;
  event_id: string;
  zone_id: string;
  material: string;
  weight: number;
  status: Status;
  partner_id: string | null;
  accepted: number;
  rejected: number;
  evidence: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  revision: number;
}
export interface Event {
  latitude?: number | null;
  longitude?: number | null;
  id: string;
  name: string;
  location: string;
  date: string;
  status: string;
}
export interface Zone {
  latitude?: number | null;
  longitude?: number | null;
  id: string;
  event_id: string;
  name: string;
  x: number;
  y: number;
}
export interface Partner {
  id: string;
  name: string;
  materials: string[];
  capacity: number;
  available: boolean;
  distance: number;
}
export interface Capture {
  id: string;
  event_id: string;
  zone_id: string;
  batch_id: string | null;
  material: string;
  weight: number;
  provenance: string;
  quantity: number;
  notes: string;
  evidence: string | null;
  created_at: string;
}
export interface Custody {
  id: string;
  batch_id: string;
  action: string;
  role: string;
  details: Record<string, unknown>;
  created_at: string;
}
export interface Metrics {
  captured: number;
  awaiting: number;
  collected: number;
  received: number;
  recovered: number;
  rejected: number;
  tasks: number;
}
export interface State {
  events: Event[];
  zones: Zone[];
  partners: Partner[];
  batches: Batch[];
  captures: Capture[];
  custody: Custody[];
  passports: {
    id: string;
    batch_id: string;
    revision: number;
    created_at: string;
    revoked: boolean;
  }[];
  metrics: Metrics;
  mode: string;
}
