const KST_OFFSET_HOURS = 9;
const KST_OFFSET_MS = KST_OFFSET_HOURS * 60 * 60 * 1000;
const SEOUL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

export function parseSeoulDateTimeToUtc(value: string): Date {
  const match = SEOUL_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error('INVALID_SEOUL_DATETIME_FORMAT');
  }

  const [, year, month, day, hour, minute, second] = match;
  const utcDate = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - KST_OFFSET_HOURS,
      Number(minute),
      Number(second),
    ),
  );

  if (formatUtcDateToSeoulDateTime(utcDate) !== value) {
    throw new Error('INVALID_SEOUL_DATETIME_VALUE');
  }

  return utcDate;
}

export function formatUtcDateToSeoulDateTime(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 19);
}

export function formatScheduleWithSeoulTime<
  T extends { startAt: Date; endAt: Date },
>(schedule: T) {
  return {
    ...schedule,
    startAt: formatUtcDateToSeoulDateTime(schedule.startAt),
    endAt: formatUtcDateToSeoulDateTime(schedule.endAt),
  };
}
