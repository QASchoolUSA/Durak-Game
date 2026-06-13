/** Pure helpers for the "rejoin an active game" entry points (unit-testable). */

export type ResumableStatus = "lobby" | "playing" | "finished";

export interface ResumableMember {
  userId: string;
  displayName: string;
  seatIndex: number;
  isBot: boolean;
  playerId?: string;
}

export interface ResumableRoomInput {
  _id: string;
  code: string;
  status: ResumableStatus;
  members: ResumableMember[];
  turnClockPlayerId?: string | null;
  lastMoveAt: number;
}

export interface ResumableRoomView {
  roomId: string;
  code: string;
  status: "lobby" | "playing";
  seatIndex: number;
  yourPlayerId: string | null;
  opponents: string[];
  humanCount: number;
  lastMoveAt: number;
  isYourTurn: boolean;
}

/**
 * View of a room the given user can resume, or `null` if it isn't resumable for
 * them: only lobby/playing rooms where they still hold a non-bot seat qualify.
 */
export function resumableRoomFor(
  room: ResumableRoomInput,
  userId: string,
): ResumableRoomView | null {
  if (room.status !== "playing" && room.status !== "lobby") return null;

  const member = room.members.find((m) => m.userId === userId);
  if (!member || member.isBot) return null;

  const yourPlayerId = member.playerId ?? null;
  return {
    roomId: room._id,
    code: room.code,
    status: room.status,
    seatIndex: member.seatIndex,
    yourPlayerId,
    opponents: room.members
      .filter((m) => m.userId !== userId)
      .map((m) => m.displayName),
    humanCount: room.members.filter((m) => !m.isBot).length,
    lastMoveAt: room.lastMoveAt,
    isYourTurn:
      room.status === "playing" &&
      yourPlayerId != null &&
      room.turnClockPlayerId === yourPlayerId,
  };
}

/** Resumable rooms for a user, most-recently-active first. */
export function resumableRoomsFor(
  rooms: ResumableRoomInput[],
  userId: string,
): ResumableRoomView[] {
  return rooms
    .map((room) => resumableRoomFor(room, userId))
    .filter((r): r is ResumableRoomView => r !== null)
    .sort((a, b) => b.lastMoveAt - a.lastMoveAt);
}
