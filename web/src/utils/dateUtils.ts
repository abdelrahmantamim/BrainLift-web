import { formatDistanceToNow, isValid, parseISO } from 'date-fns';

/**
 * Safely format a date to a relative time string
 * Returns a fallback string if the date is invalid
 */
export function safeFormatDistanceToNow(date: string | Date | undefined | null, options?: { addSuffix?: boolean }): string {
  try {
    if (!date) {
      return 'Recently';
    }

    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'Recently';
    }

    if (!isValid(dateObj)) {
      return 'Recently';
    }

    return formatDistanceToNow(dateObj, options);
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Recently';
  }
}

/**
 * Safely format a date to locale time string
 * Returns a fallback string if the date is invalid
 */
export function safeFormatTime(date: string | Date | undefined | null): string {
  try {
    if (!date) {
      return '';
    }

    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }

    if (!isValid(dateObj)) {
      return '';
    }

    return dateObj.toLocaleTimeString();
  } catch (error) {
    console.warn('Error formatting time:', error);
    return '';
  }
}

/**
 * Safely get ISO date string for filenames
 * Returns a fallback string if the date is invalid
 */
export function safeGetDateForFilename(date: string | Date | undefined | null): string {
  try {
    if (!date) {
      return new Date().toISOString().split('T')[0];
    }

    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return new Date().toISOString().split('T')[0];
    }

    if (!isValid(dateObj)) {
      return new Date().toISOString().split('T')[0];
    }

    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Error getting date for filename:', error);
    return new Date().toISOString().split('T')[0];
  }
}