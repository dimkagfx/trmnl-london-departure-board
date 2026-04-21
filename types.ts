export interface Train {
  mode: string;
  dest: string;
  scheduled: number; // Epoch timestamp in seconds
  scheduled_formatted?: string; // Formatted time in London timezone (HH:MM)
  estimated?: number | null; // Epoch timestamp in seconds
  estimated_formatted?: string; // Formatted time in London timezone (HH:MM)
  platform?: string | null;
  is_delayed: boolean;
  is_cancelled: boolean;
}

export interface Alert {
  line: string;
  status: string;
}