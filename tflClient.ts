import { Train, Alert } from './types'; 
import moment from 'moment-timezone';

export class TflClient {
  private appKey: string;
  private station: string;

  /**
   * Mapping for TFL line abbreviations.
   * @private
   * @static
   * @readonly
   */
  private static readonly lineAbbreviations: { [key: string]: string } = {
    Bakerloo: 'BKL',
    Central: 'CEN',
    Circle: 'CIR',
    District: 'DIS',
    'Hammersmith & City': 'H&C',
    Jubilee: 'JBL',
    Metropolitan: 'MET',
    Northern: 'NOR',
    Piccadilly: 'PIC',
    Victoria: 'VIC',
    'Waterloo & City': 'W&C',
    DLR: 'DLR',
    Overground: 'OVR',
    'Elizabeth line': 'ELZ',
  };

  constructor(appKey: string, station: string) {
    this.appKey = appKey;
    this.station = station;
  }

  async fetchTflArrivals(): Promise<Train[]> {
    /**
     * Fetches TFL arrival data for the configured station.
     * @returns A Promise that resolves to an array of Train objects.
     */
    const arrivalsUrl = `https://api.tfl.gov.uk/StopPoint/${this.station}/Arrivals?app_key=${this.appKey}`;
    const trains: Train[] = [];

    const arrivalsRes = await fetch(arrivalsUrl, { cf: { cacheTtl: 60 } });

      if (arrivalsRes.ok) {
        const arrivalsData = await arrivalsRes.json() as any[];
        for (const t of arrivalsData) {
          // Use moment.utc() to parse the ISO 8601 string and get the Unix epoch in seconds
          const scheduledEpoch = moment.utc(t.expectedArrival).unix();

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

  /**
   * Fetches TFL service alerts for Tube, DLR, Overground, and Elizabeth line.
   * Groups alerts by status description.
   * @returns A Promise that resolves to a Record mapping status descriptions to an array of abbreviated line names.
   */
  async fetchTflAlerts(): Promise<Record<string, string[]>> {
    const statusUrl = `https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line/Status?app_key=${this.appKey}`;
    const groupedAlerts: Record<string, string[]> = {};

    const statusRes = await fetch(statusUrl, { cf: { cacheTtl: 300 } });

    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as any[];
      for (const s of statusData) {
        if (s.lineStatuses && s.lineStatuses[0].statusSeverity < 10) {
          const lineName = s.name;
          const abbreviatedLine = TflClient.lineAbbreviations[lineName] || lineName;
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