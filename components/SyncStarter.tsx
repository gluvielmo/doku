"use client";

import { useEffect } from "react";
import { startSync } from "@/lib/sync/engine";

/** Starts background sync once for the whole app. */
export function SyncStarter() {
  useEffect(() => startSync(), []);
  return null;
}
