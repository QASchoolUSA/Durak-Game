import { useCallback, useEffect, useRef, useState } from "react";

const LIFT_PX = 5;

export type DropZoneKind = "field" | "pair";

export interface DropZone {
  kind: DropZoneKind;
  /** Pair index when kind === "pair". */
  index?: number;
  /** Whether this zone is a legal drop for the current card. */
  legal: boolean;
  el: HTMLElement;
}

export interface DragGhost {
  cardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActiveHover {
  kind: DropZoneKind;
  index?: number;
}

/**
 * Pointer-based card drag for desktop: lift threshold keeps click intact,
 * floating ghost follows the cursor, legal zones highlight via hit-test.
 */
export function useCardPointerDrag(options: {
  enabled: boolean;
  getZones: () => DropZone[];
  onDrop: (cardId: string, zone: ActiveHover | null) => boolean;
}) {
  const { enabled, getZones, onDrop } = options;
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [hover, setHover] = useState<ActiveHover | null>(null);
  const draggingCardId = useRef<string | null>(null);
  const started = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const size = useRef({ w: 85, h: 125 });
  const suppressClick = useRef(false);
  const pointerId = useRef<number | null>(null);

  const cancel = useCallback(() => {
    draggingCardId.current = null;
    started.current = false;
    pointerId.current = null;
    setGhost(null);
    setHover(null);
  }, []);

  const hitTest = useCallback(
    (clientX: number, clientY: number): ActiveHover | null => {
      const zones = getZones().filter((z) => z.legal);
      // Prefer pair zones over the whole field.
      const pairs = zones.filter((z) => z.kind === "pair");
      for (const z of pairs) {
        const r = z.el.getBoundingClientRect();
        if (
          clientX >= r.left &&
          clientX <= r.right &&
          clientY >= r.top &&
          clientY <= r.bottom
        ) {
          return { kind: "pair", index: z.index };
        }
      }
      const field = zones.find((z) => z.kind === "field");
      if (field) {
        const r = field.el.getBoundingClientRect();
        if (
          clientX >= r.left &&
          clientX <= r.right &&
          clientY >= r.top &&
          clientY <= r.bottom
        ) {
          return { kind: "field" };
        }
      }
      return null;
    },
    [getZones],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, cardId: string) => {
      if (!enabled || e.button !== 0) return;
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      size.current = { w: rect.width, h: rect.height };
      origin.current = { x: e.clientX, y: e.clientY };
      draggingCardId.current = cardId;
      started.current = false;
      pointerId.current = e.pointerId;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingCardId.current == null) return;
      if (pointerId.current != null && e.pointerId !== pointerId.current) return;

      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (!started.current) {
        if (Math.hypot(dx, dy) < LIFT_PX) return;
        started.current = true;
        suppressClick.current = true;
      }

      setGhost({
        cardId: draggingCardId.current,
        x: e.clientX - size.current.w / 2,
        y: e.clientY - size.current.h / 2 - 8,
        width: size.current.w,
        height: size.current.h,
      });
      setHover(hitTest(e.clientX, e.clientY));
    },
    [hitTest],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingCardId.current == null) return;
      if (pointerId.current != null && e.pointerId !== pointerId.current) return;

      const cardId = draggingCardId.current;
      const wasDragging = started.current;
      const zone = wasDragging ? hitTest(e.clientX, e.clientY) : null;

      if (wasDragging) {
        onDrop(cardId, zone);
        // Keep suppressClick until the following click event is swallowed.
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      } else {
        suppressClick.current = false;
      }

      cancel();
    },
    [cancel, hitTest, onDrop],
  );

  const onPointerCancel = useCallback((_e?: React.PointerEvent) => {
    suppressClick.current = false;
    cancel();
  }, [cancel]);

  useEffect(() => {
    if (!ghost) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        suppressClick.current = false;
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ghost, cancel]);

  const shouldSuppressClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    ghost,
    hover,
    draggingCardId: ghost?.cardId ?? null,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    shouldSuppressClick,
    cancel,
  };
}
