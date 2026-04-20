import { TflClient } from './tflClient';
import { NationalRailClient } from './nationalRailClient';
import { Train, Alert } from './types';

export interface Env {
  // These should be set as "Secrets" or "Vars" in your Cloudflare Worker / wrangler.toml
  TFL_APP_KEY?: string;
  NR_TOKEN?: string;
  TFL_STATION?: string;
  NR_STATION?: string;
  NR_DESTINATIONS?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Default config fallback if not provided in env variables
    const TFL_APP_KEY = env.TFL_APP_KEY || 'a7fa36f15bb8432592a60e78c4847595';
    const NR_TOKEN = env.NR_TOKEN || '089d8096-3bb0-4634-8b85-49bb636f5d7e';
    const TFL_STATION = env.TFL_STATION || '940GZZDLSIT';
    const NR_STATION = env.NR_STATION || 'SFA';
    const NR_DESTINATIONS = env.NR_DESTINATIONS || 'St Pancras';

    const getUKTime = () => {
      const now = new Date();
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
    };

    try {
      // 1. Fetch data
      const tflClient = new TflClient(TFL_APP_KEY, TFL_STATION);
      const tflTrains = await tflClient.fetchTflArrivals();
      const alerts = await tflClient.fetchTflAlerts();

      const nationalRailClient = new NationalRailClient(NR_TOKEN, NR_STATION, NR_DESTINATIONS);
      const railTrains = await nationalRailClient.fetchRailData();

      // 2. Combine and sort
      const combinedTrains = [...tflTrains, ...railTrains].sort((a, b) => {
        // Sort directly by epoch timestamps. Use estimated if available, otherwise scheduled.
        // If a timestamp is missing (e.g., undefined), treat it as a very large number to push it to the end.
        const timeA = a.estimated ?? a.scheduled ?? Number.MAX_SAFE_INTEGER;
        const timeB = b.estimated ?? b.scheduled ?? Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      });

      // 3. Prepare payload for TRMNL polling
      // Note: For TRMNL polling plugins, the returned JSON itself becomes the `data` variable.
      const payload = {
        trains: combinedTrains,
        alerts: alerts,
        last_updated: getUKTime()
      };

      return new Response(JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' // Good practice for external polling
        }
      });
    } catch (error: any) {
      console.error('Aggregator error:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
