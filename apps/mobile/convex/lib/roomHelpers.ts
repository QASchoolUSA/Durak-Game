import type { Doc } from "../_generated/dataModel";

export const BOT_NAMES = ["Olga", "Ivan", "Dmitri", "Maria", "Sergey"];

export type RoomDoc = Doc<"rooms">;
export type RoomMember = RoomDoc["members"][number];

export function findMember(room: RoomDoc, sessionToken: string): RoomMember | undefined {
  return room.members.find((m) => m.sessionToken === sessionToken && !m.isBot);
}

export function isHost(room: RoomDoc, sessionToken: string): boolean {
  return room.hostSessionToken === sessionToken;
}

export function memberAtSeat(
  members: RoomMember[],
  seatIndex: number,
): RoomMember | undefined {
  return members.find((m) => m.seatIndex === seatIndex);
}

export function occupiedSeats(members: RoomMember[]): Set<number> {
  return new Set(members.map((m) => m.seatIndex));
}

export function nextOpenSeat(members: RoomMember[], maxPlayers: number): number | null {
  const taken = occupiedSeats(members);
  for (let i = 0; i < maxPlayers; i++) {
    if (!taken.has(i)) return i;
  }
  return null;
}

export function humanMemberCount(members: RoomMember[]): number {
  return members.filter((m) => !m.isBot).length;
}

export function readyHumanCount(members: RoomMember[]): number {
  return members.filter((m) => !m.isBot && m.isReady === true).length;
}

export function allHumansReady(members: RoomMember[]): boolean {
  const humans = members.filter((m) => !m.isBot);
  return humans.length > 0 && humans.every((m) => m.isReady === true);
}

export function lobbyHumans(members: RoomMember[]): RoomMember[] {
  return members
    .filter((m) => !m.isBot)
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map(({ sessionToken, displayName, seatIndex, isBot }) => ({
      sessionToken,
      displayName,
      seatIndex,
      isBot,
      isReady: false,
    }));
}
