import { Train, Alert } from './types';

export class TflClient {
  private appKey: string;
  private station: string;

  constructor(appKey: string, station: string) {
    this.appKey = appKey;
    this.station = station;
  }

  async fetchTflArrivals(): Promise<Train[]> {
    const arrivalsUrl = `https://api.tfl.gov.uk/StopPoint/${this.station}/Arrivals?app_key=${this.appKey}`;
    const trains: Train[] = [];

    const arrivalsRes = await fetch(arrivalsUrl, { cf: { cacheTtl: 60 } });

      if (arrivalsRes.ok) {
        const arrivalsData = await arrivalsRes.json() as any[];
        for (const t of arrivalsData) {
          const expectedUtc = new Date(t.expectedArrival);
          // Store epoch timestamp instead of formatted string
          const scheduledEpoch = expectedUtc.getTime();

          const rawDest = t.destinationName || 'Unknown';
          const cleanDest = rawDest
            .replace(' DLR Station', '')
            .replace(' Underground Station', '')
            .replace(' Rail Station', '');
          const platform = t.platformName || null;

          trains.push({
            mode: t.lineName || 'TfL',
            dest: cleanDest,
            scheduled: scheduledEpoch,
            is_delayed: false,
            is_cancelled: false,
            platform: platform
          });
        }
      } else {
        console.error(`Failed to fetch TfL arrivals: ${arrivalsRes.status} ${arrivalsRes.statusText}`);
      }
    return trains;
  }

  async fetchTflAlerts(): Promise<Alert[]> {
    const statusUrl = `https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line/Status?app_key=${this.appKey}`;
    const alerts: Alert[] = [];

    const statusRes = await fetch(statusUrl, { cf: { cacheTtl: 300 } });

      if (statusRes.ok) { // Check if the response was successful
        const statusData = await statusRes.json() as any[];
        for (const s of statusData) { // Iterate through each line status
          // Severity < 10 indicates anything worse than "Good Service"
          if (s.lineStatuses && s.lineStatuses[0].statusSeverity < 10) { // Check for actual status
            alerts.push({ // Add to alerts array
              line: s.name,
              status: s.lineStatuses[0].statusSeverityDescription
            });
          }
        }
      } else {
        console.error(`Failed to fetch TfL status: ${statusRes.status} ${statusRes.statusText}`);
      }
    return alerts;
  }
}