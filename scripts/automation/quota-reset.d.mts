export function dateKeyInTimezone(value: Date | string, timeZone: string): string;
export function istanbulDateKey(value: Date | string): string;
export function googleDailyQuotaResetForIstanbulDate(dateKey: string): Date;
export function isGoogleQuotaResetForIstanbulDay(value?: Date | string): boolean;
export function nextGoogleDailyQuotaReset(value?: Date | string): Date;
