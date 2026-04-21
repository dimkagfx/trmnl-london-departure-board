import { Train } from './types';
import { formatEpochToUKTime } from './worker'; // Assuming formatEpochToUKTime is exported from worker.ts

export class NationalRailClient {
  private token: string;
  private station: string;
  private destinations: string;

  constructor(token: string, station: string, destinations: string) {
    this.token = token;
    this.station = station;
    this.destinations = destinations;
  }

  /**
   * Converts an "HH:MM" time string to an epoch timestamp,
   * assuming the next upcoming occurrence of that time in the 'Europe/London' timezone.
   * Handles midnight rollover by advancing to the next day if the time has already passed today.
   * @param timeStr The time string in "HH:MM" format.
   * @returns The epoch timestamp in milliseconds, or undefined if parsing fails.
   */
  private getNextOccurrenceEpoch(timeStr: string): number | undefined {
    if (!timeStr || !timeStr.includes(':')) return undefined;

    try {
      const [targetH, targetM] = timeStr.split(':').map(Number);
      const now = new Date();
      const ukDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
      
      const targetDate = new Date(ukDate);
      targetDate.setHours(targetH, targetM, 0, 0);

      // If the target time is in the past (more than 5 minutes ago), assume it's for the next day.
      if (targetDate.getTime() < ukDate.getTime() - (5 * 60 * 1000)) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      return Math.floor(targetDate.getTime() / 1000); // Return epoch in seconds
    } catch (e) {
      console.error("Error converting time string to epoch:", timeStr, e);
      return undefined;
    }
  }

  async fetchRailData(): Promise<Train[]> {
    const allowedDests = this.destinations ? this.destinations.split(',').map(d => d.trim().toLowerCase()) : [];
    const railList: Train[] = [];
    const stations = this.station.split(',').map(s => s.trim()).filter(Boolean);

    for (const crs of stations) {
      const url = `https://huxley2.azurewebsites.net/departures/${crs}?accessToken=${this.token}`;
      try {
        const response = await fetch(url, { cf: { cacheTtl: 60 } });
        if (!response.ok) continue;
        
        const data = await response.json() as any;
        const services = data.trainServices || [];

        for (const s of services) {
          const destName = s.destination?.[0]?.locationName || 'Unknown';
          if (allowedDests.length > 0 && !allowedDests.some(allowed => destName.toLowerCase().includes(allowed))) {
            continue;
          }

          const etd = s.etd; // "On time" or "14:10" or "Cancelled"
          const std = s.std; // "14:05"

          const scheduledEpoch = this.getNextOccurrenceEpoch(std);
          let estimatedEpoch: number | undefined = undefined;

          if (etd && etd !== 'On time' && etd !== 'Cancelled') {
            estimatedEpoch = this.getNextOccurrenceEpoch(etd);
          } else if (etd === 'On time' && scheduledEpoch !== undefined) {
            estimatedEpoch = scheduledEpoch; // If on time, estimated is same as scheduled
          }
          const platform = s.platform || null;

          railList.push({
            mode: 'Rail',
            dest: destName.replace('Highspeed', 'HS'),
            scheduled: scheduledEpoch ?? 0, // Fallback to 0 if parsing fails, already in seconds
            scheduled_formatted: formatEpochToUKTime(scheduledEpoch),
            estimated: estimatedEpoch,
            estimated_formatted: formatEpochToUKTime(estimatedEpoch),
            platform: platform,
            is_delayed: etd !== 'On time' && etd !== 'Cancelled',
            is_cancelled: etd === 'Cancelled'
          });
        }
      } catch (error) {
        console.error(`Failed to fetch rail for ${crs}`, error);
      }
    }
    return railList;
  }
}