import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync org metadata weekly (Sundays at 2am UTC)
// This keeps custom object info fresh for the AI agent
crons.weekly(
  "sync org metadata",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.orgMetadata.syncAllOrgs
);

// Clean up expired activities daily (3am UTC)
crons.daily(
  "cleanup expired activities",
  { hourUTC: 3, minuteUTC: 0 },
  internal.activities.clearExpiredActivities
);

export default crons;
