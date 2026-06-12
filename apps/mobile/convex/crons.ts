import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup stale rooms",
  { minutes: 1 },
  internal.rooms.cleanupStaleRooms,
);

crons.interval(
  "expire stale game invites",
  { minutes: 1 },
  internal.invites.expireStale,
);

export default crons;
