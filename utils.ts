// Helper to format epoch timestamps to UK local time (HH:MM)
export const formatEpochToUKTime = (epochSeconds: number | undefined | null): string | undefined => {
  if (epochSeconds === undefined || epochSeconds === null) return undefined;
  const date = new Date(epochSeconds * 1000); // Convert seconds to milliseconds
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

// Helper to convert a string to Title Case (e.g., "CANNING TOWN" -> "Canning Town")
export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};