const KST_TIME_ZONE = "Asia/Seoul";

function parts(value: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: KST_TIME_ZONE,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value]),
  );
}

export function formatKstShort(
  value: string | Date,
  now: string | Date = new Date(),
) {
  const date = value instanceof Date ? value : new Date(value);
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return "";
  const dateParts = parts(date);
  const nowParts = parts(current);
  const time = `${dateParts.hour}:${dateParts.minute}`;
  return dateParts.month === nowParts.month &&
    dateParts.day === nowParts.day &&
    new Intl.DateTimeFormat("en-US", {
      timeZone: KST_TIME_ZONE,
      year: "numeric",
    }).format(date) ===
      new Intl.DateTimeFormat("en-US", {
        timeZone: KST_TIME_ZONE,
        year: "numeric",
      }).format(current)
    ? time
    : `${dateParts.month}/${dateParts.day} ${time}`;
}

export function fullIso(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
