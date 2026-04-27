import moment from 'moment-timezone';

/**
 * Helper to format epoch timestamps (in seconds) to UK local time (HH:MM).
 * @param epochSeconds The epoch timestamp in seconds.
 * @returns A formatted time string (HH:MM) in 'Europe/London' timezone, or undefined if input is null/undefined.
 */
export const formatEpochToUKTime = (epochSeconds: number | undefined | null): string | undefined => {
  if (epochSeconds === undefined || epochSeconds === null) {
    return undefined;
  }
  return moment.unix(epochSeconds).tz('Europe/London').format('HH:mm');
};

// Helper to convert a string to Title Case (e.g., "CANNING TOWN" -> "Canning Town")
/**
 * Converts a string to Title Case (e.g., "CANNING TOWN" -> "Canning Town").
 * @param str The input string.
 * @returns The string in Title Case.
 */
export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};