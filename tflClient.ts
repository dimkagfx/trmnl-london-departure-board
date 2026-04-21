import { Train, Alert } from './types';
import { formatEpochToUKTime } from './worker'; // Assuming formatEpochToUKTime is exported from worker.ts

export class TflClient {
  private appKey: string;
  private station: string;
  // Mapping for line abbreviations
  private lineAbbreviations: { [key: string]: string } = {
    'Bakerloo': 'BKL',
    'Central': 'CEN',
    'Circle': 'CIR',
    'District': 'DIS',
    'Hammersmith & City': 'H&C',
    'Jubilee': 'JBL',
    'Metropolitan': 'MET',
    'Northern': 'NOR',
    'Piccadilly': 'PIC',
    'Victoria': 'VIC',
    'Waterloo & City': 'W&C',
    'DLR': 'DLR',
    'Overground': 'OVR',
    'Elizabeth line': 'ELZ',
  };

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
          const scheduledEpoch = Math.floor(expectedUtc.getTime() / 1000); // Convert to seconds

          const rawDest = t.destinationName || 'Unknown';
          const cleanDest = rawDest
            .replace(' DLR Station', '')
            .replace(' Underground Station', '')
            .replace(' Rail Station', '');
          
          // Extract only the number from the platformName, if present
          const platformMatch = t.platformName?.match(/\d+/);
          const platform = platformMatch ? platformMatch[0] : t.platformName;

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

  async fetchTflAlerts(): Promise<Record<string, string[]>> {
    const statusUrl = `https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line/Status?app_key=${this.appKey}`;
    const groupedAlerts: Record<string, string[]> = {};

    const statusRes = await fetch(statusUrl, { cf: { cacheTtl: 300 } });

      if (statusRes.ok) { // Check if the response was successful
        const statusData = await statusRes.json() as any[];
        for (const s of statusData) { // Iterate through each line status
          // Severity < 10 indicates anything worse than "Good Service"
          if (s.lineStatuses && s.lineStatuses[0].statusSeverity < 10) { // Check for actual status
            const lineName = s.name;
            const abbreviatedLine = this.lineAbbreviations[lineName] || lineName; // Get abbreviation or use full name
            const statusDescription = s.lineStatuses[0].statusSeverityDescription;
            if (!groupedAlerts[statusDescription]) {
              groupedAlerts[statusDescription] = [];
            }
            groupedAlerts[statusDescription].push(abbreviatedLine);
          }
        }
      } else {
        console.error(`Failed to fetch TfL status: ${statusRes.status} ${statusRes.statusText}`);
      }
    return groupedAlerts;
  }
}