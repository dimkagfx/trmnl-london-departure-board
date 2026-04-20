export interface Train {
  mode: string;
  dest: string;
  scheduled: number; // Epoch timestamp in milliseconds
  estimated?: number | null; // Epoch timestamp in milliseconds
  platform?: string | null;
  is_delayed: boolean;
  is_cancelled: boolean;
}

export interface Alert {
  line: string;
  status: string;
}