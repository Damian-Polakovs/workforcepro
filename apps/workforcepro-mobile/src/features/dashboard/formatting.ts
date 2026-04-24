export const isoFromClockField = (clock: string) => {
  if (!clock) {
    return undefined;
  }

  const candidate = new Date(clock);
  return Number.isNaN(candidate.getTime())
    ? undefined
    : candidate.toISOString();
};

export const formatElapsedTime = (
  clockInAt: Date | string | null | undefined,
  now: number,
) => {
  if (!clockInAt) {
    return "00:00:00";
  }

  const startedAt = new Date(clockInAt).getTime();
  if (Number.isNaN(startedAt)) {
    return "00:00:00";
  }

  const totalSeconds = Math.max(Math.floor((now - startedAt) / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
};
