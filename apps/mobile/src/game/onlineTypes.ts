import type { Id } from "../../convex/_generated/dataModel";
import type { RoomView } from "../../convex/rooms";

export type { RoomView };

export type OnlineRoomId = Id<"rooms">;

export function isRoomView(value: unknown): value is RoomView {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "code" in value
  );
}
