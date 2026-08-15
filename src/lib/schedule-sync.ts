/**
 * Cross-screen sync bus for the scheduling screens (Scheduling Engine, Datesheet
 * Calendar, Clash Detection Center, dashboard KPIs). Any screen that mutates the
 * timetable, clash records or cycle status broadcasts a change so the other
 * mounted screens can refresh their data — keeping the views consistent.
 */

type ScheduleListener = () => void

const listeners = new Set<ScheduleListener>()

/** Subscribe to schedule/clash/cycle changes. Returns an unsubscribe fn. */
export function onScheduleChanged(listener: ScheduleListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Broadcast that timetable/clash/cycle data changed. */
export function notifyScheduleChanged() {
  for (const listener of listeners) listener()
}
