import { describe, expect, it } from "vitest";
import {
  resumableRoomFor,
  resumableRoomsFor,
  type ResumableRoomInput,
} from "./resumeHelpers";

function room(p: Partial<ResumableRoomInput>): ResumableRoomInput {
  return {
    _id: "r1",
    code: "1234",
    status: "playing",
    members: [
      { userId: "me", displayName: "Me", seatIndex: 0, isBot: false, playerId: "p0" },
      { userId: "alex", displayName: "Alex", seatIndex: 1, isBot: false, playerId: "p1" },
    ],
    turnClockPlayerId: "p1",
    lastMoveAt: 1000,
    ...p,
  };
}

describe("resumableRoomFor", () => {
  it("returns a view for a playing room where you hold a seat", () => {
    const view = resumableRoomFor(room({}), "me");
    expect(view).not.toBeNull();
    expect(view).toMatchObject({
      roomId: "r1",
      code: "1234",
      status: "playing",
      seatIndex: 0,
      yourPlayerId: "p0",
      opponents: ["Alex"],
      humanCount: 2,
      isYourTurn: false,
    });
  });

  it("flags your turn when the clock is on your playerId", () => {
    const view = resumableRoomFor(room({ turnClockPlayerId: "p0" }), "me");
    expect(view?.isYourTurn).toBe(true);
  });

  it("excludes rooms you are not a member of", () => {
    expect(resumableRoomFor(room({}), "stranger")).toBeNull();
  });

  it("excludes a seat you only hold as a bot", () => {
    const r = room({
      members: [
        { userId: "me", displayName: "Bot", seatIndex: 0, isBot: true, playerId: "p0" },
      ],
    });
    expect(resumableRoomFor(r, "me")).toBeNull();
  });

  it("excludes finished rooms", () => {
    expect(resumableRoomFor(room({ status: "finished" }), "me")).toBeNull();
  });

  it("includes a lobby room but never marks it as your turn", () => {
    const view = resumableRoomFor(
      room({ status: "lobby", turnClockPlayerId: "p0" }),
      "me",
    );
    expect(view?.status).toBe("lobby");
    expect(view?.isYourTurn).toBe(false);
  });
});

describe("resumableRoomsFor", () => {
  it("returns only your resumable rooms, most-recently-active first", () => {
    const rooms = [
      room({ _id: "old", lastMoveAt: 100 }),
      room({ _id: "finished", status: "finished", lastMoveAt: 999 }),
      room({ _id: "new", lastMoveAt: 500 }),
      room({
        _id: "notmine",
        lastMoveAt: 999,
        members: [
          { userId: "alex", displayName: "Alex", seatIndex: 0, isBot: false, playerId: "p0" },
        ],
      }),
    ];
    const result = resumableRoomsFor(rooms, "me");
    expect(result.map((r) => r.roomId)).toEqual(["new", "old"]);
  });
});
