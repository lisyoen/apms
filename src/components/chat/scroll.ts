export const CHAT_NEAR_BOTTOM_PX = 80;

export function distanceToBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
}: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}) {
  return Math.max(0, scrollHeight - scrollTop - clientHeight);
}

export function isNearBottom(
  metrics: { scrollHeight: number; scrollTop: number; clientHeight: number },
  threshold = CHAT_NEAR_BOTTOM_PX,
) {
  return distanceToBottom(metrics) <= threshold;
}
