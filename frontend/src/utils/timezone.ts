/**
 * Timezone utility functions for displaying user timezones
 */

/**
 * Get the current time in a user's timezone
 * @param timezone IANA timezone string (e.g., "America/New_York")
 * @returns Formatted time string (e.g., "9:30 AM EST")
 */
export function getCurrentTimeInTimezone(timezone?: string): string {
  if (!timezone) return '';
  
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    
    return formatter.format(now);
  } catch (error) {
    console.error('Error formatting timezone:', error);
    return '';
  }
}

/**
 * Get a friendly timezone name
 * @param timezone IANA timezone string
 * @returns Friendly name (e.g., "Eastern Time")
 */
export function getTimezoneName(timezone?: string): string {
  if (!timezone) return 'Not set';
  
  try {
    // Extract city/region name from IANA timezone
    const parts = timezone.split('/');
    if (parts.length > 1) {
      return parts[parts.length - 1].replace(/_/g, ' ');
    }
    return timezone;
  } catch (error) {
    return timezone;
  }
}

/**
 * Get timezone offset from UTC
 * @param timezone IANA timezone string
 * @returns Offset string (e.g., "UTC-5")
 */
export function getTimezoneOffset(timezone?: string): string {
  if (!timezone) return '';
  
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    
    const parts = formatter.formatToParts(now);
    const offset = parts.find(part => part.type === 'timeZoneName')?.value || '';
    
    // Convert to simpler format if needed
    if (offset.startsWith('GMT')) {
      return offset.replace('GMT', 'UTC');
    }
    return offset;
  } catch (error) {
    return '';
  }
}

/**
 * Format timezone for display in tooltips
 * @param timezone IANA timezone string
 * @returns Full timezone info string
 */
export function getTimezoneTooltip(timezone?: string): string {
  if (!timezone) return 'Timezone not set';
  
  const name = getTimezoneName(timezone);
  const offset = getTimezoneOffset(timezone);
  const currentTime = getCurrentTimeInTimezone(timezone);
  
  return `${name} (${offset})\nCurrent time: ${currentTime}`;
}

