export type ViewportPopoverInput = {
  triggerLeft: number;
  triggerBottom: number;
  viewportWidth: number;
  viewportHeight: number;
  maxWidth?: number;
  gutter?: number;
  gap?: number;
  minHeight?: number;
};

export type ViewportPopoverPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function positionViewportPopover({
  triggerLeft,
  triggerBottom,
  viewportWidth,
  viewportHeight,
  maxWidth = 400,
  gutter = 16,
  gap = 8,
  minHeight = 160,
}: ViewportPopoverInput): ViewportPopoverPosition {
  const width = Math.max(0, Math.min(maxWidth, viewportWidth - gutter * 2));
  const maxLeft = Math.max(gutter, viewportWidth - width - gutter);
  const left = Math.min(Math.max(gutter, triggerLeft), maxLeft);
  const latestTop = Math.max(gutter, viewportHeight - gutter - minHeight);
  const top = Math.min(Math.max(gutter, triggerBottom + gap), latestTop);
  const maxHeight = Math.max(0, viewportHeight - top - gutter);

  return { left, top, width, maxHeight };
}
