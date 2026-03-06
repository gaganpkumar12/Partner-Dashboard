import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Daily auto-sync at 9:00 PM IST = 15:30 UTC
crons.daily(
  "nightly-zoho-sync",
  { hourUTC: 15, minuteUTC: 30 },
  api.zohoSync.syncFromZoho,
  { scheduled: true } // bypasses the 2/day user quota
);

export default crons;
