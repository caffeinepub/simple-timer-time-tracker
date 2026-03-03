import { ChevronLeft, ChevronRight, Clock, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // ISO timestamp
  endTime: string; // ISO timestamp
  durationSeconds: number;
  completed: boolean;
  sessionLengthSet?: number; // minutes originally selected
}

type TimerState = "idle" | "running" | "paused" | "finished";
type View = "timer" | "weekly";

// ─── Storage helpers ─────────────────────────────────────────────────────────

const STORAGE_KEY = "timer_sessions";

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function getDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 30) return "<1m";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function formatTotal(seconds: number): string {
  if (seconds === 0) return "0m";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDayLabel(dateKey: string): string {
  const [y, m, day] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monNames[d.getMonth()]}`;
}

// ─── Mini Calendar ───────────────────────────────────────────────────────────

function MiniCalendar({
  selectedKey,
  onSelect,
}: {
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const todayKey = getDateKey(new Date());
  const MON_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // First day of month
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    // Don't navigate past current month
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }

  const now = new Date();
  const isCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const cells: { key: string; day: number | null }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ key: `pad-${viewYear}-${viewMonth}-${i}`, day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ key: `${viewYear}-${m}-${dd}`, day: d });
  }

  return (
    <div
      className="bg-surface rounded-lg p-4"
      data-ocid="weekly.calendar.panel"
    >
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-md text-foreground/50 hover:text-foreground hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Previous month"
          data-ocid="weekly.calendar.prev_button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground/80">
          {MON_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="w-8 h-8 flex items-center justify-center rounded-md text-foreground/50 hover:text-foreground hover:bg-surface-raised disabled:opacity-20 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Next month"
          data-ocid="weekly.calendar.next_button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs text-foreground/30 font-medium py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ key, day }) => {
          if (day === null) {
            return <div key={key} />;
          }
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const isFuture = key > todayKey;

          return (
            <button
              type="button"
              key={key}
              disabled={isFuture}
              onClick={() => onSelect(key)}
              className={`
                relative mx-auto flex items-center justify-center w-8 h-8 rounded-full text-sm font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                ${isFuture ? "text-foreground/15 cursor-not-allowed" : "cursor-pointer"}
                ${isSelected ? "bg-primary text-primary-foreground font-bold" : ""}
                ${!isSelected && isToday ? "ring-1 ring-primary/60 text-foreground font-semibold" : ""}
                ${!isSelected && !isToday && !isFuture ? "text-foreground/60 hover:bg-surface-raised hover:text-foreground" : ""}
              `}
              aria-label={key}
              aria-pressed={isSelected}
              data-ocid={`weekly.calendar.day.${day}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

function exportAllDataCSV(sessions: Session[]): void {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const formatHHMM = (iso: string) => {
    const d = new Date(iso);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const header = [
    "date",
    "start_time",
    "end_time",
    "duration_seconds",
    "duration_minutes",
    "status",
    "session_length_set",
  ].join(",");

  const rows = [...sessions]
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )
    .map((s) => {
      const durationMinutes = (s.durationSeconds / 60).toFixed(2);
      const status = s.completed ? "Completed" : "Stopped early";
      const sessionLengthSet =
        s.sessionLengthSet !== undefined ? s.sessionLengthSet : "";
      return [
        s.date,
        formatHHMM(s.startTime),
        formatHHMM(s.endTime),
        s.durationSeconds,
        durationMinutes,
        `"${status}"`,
        sessionLengthSet,
      ].join(",");
    });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const filename = `time-tracker-export-${y}-${m}-${d}.csv`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Weekly View ─────────────────────────────────────────────────────────────

function WeeklyView({
  onBack,
  sessions,
}: {
  onBack: () => void;
  sessions: Session[];
}) {
  const today = new Date();
  const todayKey = getDateKey(today);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  // Build last 7 days (today first)
  const days: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = getDateKey(d);
    const total = sessions
      .filter((s) => s.date === key)
      .reduce((acc, s) => acc + s.durationSeconds, 0);
    const isToday = i === 0;
    days.push({
      key,
      label: isToday ? "Today" : formatDayLabel(key),
      total,
    });
  }

  const weekTotal = days.reduce((acc, d) => acc + d.total, 0);
  const todayTotal = sessions
    .filter((s) => s.date === todayKey)
    .reduce((acc, s) => acc + s.durationSeconds, 0);

  // Streak: count consecutive days (ending today) with >= 1 minute logged
  const streak = (() => {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = getDateKey(d);
      const dayTotal = sessions
        .filter((s) => s.date === key)
        .reduce((acc, s) => acc + s.durationSeconds, 0);
      if (dayTotal >= 60) {
        count++;
      } else {
        break;
      }
    }
    return count;
  })();

  // Selected date sessions
  const selectedSessions = sessions
    .filter((s) => s.date === selectedDateKey)
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  const selectedTotal = selectedSessions.reduce(
    (acc, s) => acc + s.durationSeconds,
    0,
  );

  function selectedDateLabel(): string {
    if (selectedDateKey === todayKey) return "Today";
    return formatDayLabel(selectedDateKey);
  }

  return (
    <div
      className="flex flex-col min-h-screen pt-safe pb-safe"
      data-ocid="weekly.panel"
    >
      <div className="max-w-md mx-auto w-full px-5 py-6 flex flex-col gap-8 flex-1">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-md bg-surface text-foreground/70 hover:text-foreground hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to timer"
            data-ocid="weekly.back_button"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold tracking-wide text-foreground/80 uppercase text-sm">
            Weekly Totals
          </h1>
        </div>

        {/* Today total */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-foreground/40 uppercase tracking-widest font-medium">
            Today total
          </span>
          <span
            className="text-3xl font-mono font-bold text-foreground/80 tabular-nums"
            data-ocid="weekly.today_total"
          >
            {formatTotal(todayTotal)}
          </span>
        </div>

        {/* Calendar date picker */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-foreground/40 uppercase tracking-widest font-medium">
            Browse by date
          </span>
          <MiniCalendar
            selectedKey={selectedDateKey}
            onSelect={setSelectedDateKey}
          />
        </div>

        {/* Selected date detail */}
        <div
          className="flex flex-col gap-3"
          data-ocid="weekly.date_detail.panel"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-foreground/70">
              {selectedDateLabel()}
            </span>
            <span
              className="font-mono text-base font-bold text-accent-amber tabular-nums"
              data-ocid="weekly.date_detail.total"
            >
              {formatTotal(selectedTotal)}
            </span>
          </div>

          <div
            className="flex flex-col gap-px"
            data-ocid="weekly.date_detail.list"
          >
            {selectedSessions.length === 0 ? (
              <div
                className="py-6 text-center text-foreground/30 text-sm"
                data-ocid="weekly.date_detail.empty_state"
              >
                No sessions logged.
              </div>
            ) : (
              selectedSessions.map((session, i) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-3 px-3 rounded-md bg-surface"
                  data-ocid={
                    `weekly.date_detail.session.item.${i + 1}` as string
                  }
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <span className="font-mono text-sm tabular-nums text-foreground/70 shrink-0">
                      {formatTime(session.startTime)}
                    </span>
                    <span className="text-foreground/20 text-xs shrink-0">
                      →
                    </span>
                    <span className="font-mono text-sm tabular-nums text-foreground/70 shrink-0">
                      {formatTime(session.endTime)}
                    </span>
                    <span className="text-foreground/20 text-xs shrink-0">
                      •
                    </span>
                    <span className="font-mono text-sm font-semibold text-accent-amber tabular-nums shrink-0">
                      {formatDuration(session.durationSeconds)}
                    </span>
                    <span className="text-foreground/20 text-xs shrink-0">
                      •
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        session.completed
                          ? "text-success/70"
                          : "text-foreground/35"
                      }`}
                    >
                      {session.completed ? "Completed" : "Stopped early"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Last 7 Days header + total */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-foreground/40 uppercase tracking-widest font-medium">
            Last 7 Days
          </span>
          <span
            className="text-sm font-mono text-foreground/50"
            data-ocid="weekly.total"
          >
            Total:{" "}
            <span className="font-semibold text-foreground/70">
              {formatTotal(weekTotal)}
            </span>
          </span>
          <span
            className="text-xs text-foreground/35 font-mono mt-0.5"
            data-ocid="weekly.streak"
          >
            Streak: {streak} {streak === 1 ? "day" : "days"}
          </span>
        </div>

        {/* Day list */}
        {(() => {
          const maxDay = Math.max(...days.map((d) => d.total), 1);
          return (
            <div className="flex flex-col gap-3" data-ocid="weekly.list">
              {days.map((day, i) => {
                const barPct = day.total > 0 ? (day.total / maxDay) * 100 : 0;
                const isToday = i === 0;
                const hasActivity = day.total > 0;
                return (
                  <div
                    key={day.key}
                    className={`flex flex-col gap-1.5 transition-opacity ${
                      !hasActivity ? "opacity-55" : "opacity-100"
                    }`}
                    data-ocid={`weekly.day.item.${i + 1}` as string}
                  >
                    {/* Row: label + total */}
                    <div className="flex items-baseline justify-between">
                      <span
                        className={`text-sm ${
                          isToday
                            ? "font-semibold text-foreground"
                            : hasActivity
                              ? "font-medium text-foreground/65"
                              : "font-normal text-foreground/40"
                        }`}
                      >
                        {day.label}
                      </span>
                      <span
                        className={`font-mono text-sm tabular-nums ${
                          hasActivity
                            ? "font-bold text-amber-400"
                            : "font-normal text-foreground/25"
                        }`}
                      >
                        {formatTotal(day.total)}
                      </span>
                    </div>
                    {/* Thin activity bar */}
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: 5 }}
                      aria-hidden="true"
                    >
                      {hasActivity ? (
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: "oklch(0.78 0.18 68 / 0.75)",
                          }}
                        />
                      ) : (
                        <div
                          className="h-full w-full rounded-full"
                          style={{
                            backgroundColor: "oklch(0.78 0.18 68 / 0.08)",
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Export button */}
        <div className="pt-2 pb-4">
          <button
            type="button"
            onClick={() => exportAllDataCSV(sessions)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md border border-border text-foreground/50 text-sm font-medium hover:text-foreground hover:border-foreground/30 hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            data-ocid="weekly.export_button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export all data (CSV)
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-foreground/20 text-xs">
        © {new Date().getFullYear()}.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          className="hover:text-foreground/40 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Built with ♥ using caffeine.ai
        </a>
      </footer>
    </div>
  );
}

// ─── Timer View ───────────────────────────────────────────────────────────────

function TimerView({
  onWeekly,
  sessions,
  setSessions,
}: {
  onWeekly: () => void;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
}) {
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [displaySeconds, setDisplaySeconds] = useState(50 * 60);
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [showComplete, setShowComplete] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);

  // Refs for stable timer logic
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(50 * 60);
  const sessionStartRef = useRef<Date | null>(null);
  const runningStartRef = useRef<Date | null>(null);
  const elapsedRef = useRef(0);
  const sessionLengthRef = useRef(50 * 60);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hasLoggedRef = useRef(false);
  const alarmOscillatorsRef = useRef<OscillatorNode[]>([]);
  const alarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const todayKey = getDateKey(new Date());
  const todaySessions = sessions
    .filter((s) => s.date === todayKey)
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
  const todayTotal = todaySessions.reduce(
    (acc, s) => acc + s.durationSeconds,
    0,
  );

  // Auto-dismiss complete overlay
  useEffect(() => {
    if (!showComplete) return;
    const t = setTimeout(() => setShowComplete(false), 10000);
    return () => clearTimeout(t);
  }, [showComplete]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      if (alarmTimeoutRef.current !== null)
        clearTimeout(alarmTimeoutRef.current);
      if (alarmIntervalRef.current !== null)
        clearInterval(alarmIntervalRef.current);
    };
  }, []);

  function unlockAudio() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
  }

  const stopAlarm = useCallback(() => {
    // Stop all oscillators immediately
    for (const osc of alarmOscillatorsRef.current) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    alarmOscillatorsRef.current = [];
    if (alarmTimeoutRef.current !== null) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
    if (alarmIntervalRef.current !== null) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    setAlarmActive(false);
    setShowComplete(false);
  }, []);

  const playAlarmChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    // Retro Casio/digital stopwatch: 4 short square-wave beeps at 2400 Hz
    // Classic pattern: beep beep beep beep (each ~80ms on, ~80ms off)
    const beepFreq = 2400;
    const beepDuration = 0.08;
    const beepGap = 0.08;
    const numBeeps = 4;
    for (let i = 0; i < numBeeps; i++) {
      const offset = i * (beepDuration + beepGap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = beepFreq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.0, ctx.currentTime + offset + beepDuration);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + beepDuration + 0.01);
      alarmOscillatorsRef.current.push(osc);
    }
  }, []);

  const playAlarm = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    setAlarmActive(true);
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 200]);

    // Play first chime immediately, then repeat every 1.2s (matches 4-beep pattern length)
    playAlarmChime();
    alarmIntervalRef.current = setInterval(() => {
      playAlarmChime();
    }, 1200);

    // Auto-stop after 10 seconds
    alarmTimeoutRef.current = setTimeout(() => {
      if (alarmIntervalRef.current !== null) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      alarmOscillatorsRef.current = [];
      setAlarmActive(false);
      setShowComplete(false);
    }, 10000);
  }, [playAlarmChime]);

  const persistSession = useCallback(
    (session: Session) => {
      const all = loadSessions();
      const updated = [...all, session];
      saveSessions(updated);
      setSessions(updated);
    },
    [setSessions],
  );

  const clearIntervalSafe = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleComplete = useCallback(() => {
    clearIntervalSafe();
    if (hasLoggedRef.current) return;
    hasLoggedRef.current = true;

    const endTime = new Date();
    const session: Session = {
      id: crypto.randomUUID(),
      date: getDateKey(sessionStartRef.current ?? endTime),
      startTime: (sessionStartRef.current ?? endTime).toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds: sessionLengthRef.current,
      completed: true,
      sessionLengthSet: Math.round(sessionLengthRef.current / 60),
    };
    persistSession(session);
    playAlarm();
    setShowComplete(true);
    setTimerState("finished");
    setDisplaySeconds(0);
  }, [clearIntervalSafe, persistSession, playAlarm]);

  const startTick = useCallback(() => {
    clearIntervalSafe();
    intervalRef.current = setInterval(() => {
      remainingRef.current -= 1;
      setDisplaySeconds(remainingRef.current);
      if (remainingRef.current <= 0) {
        handleComplete();
      }
    }, 1000);
  }, [clearIntervalSafe, handleComplete]);

  function handleStart() {
    unlockAudio();
    if (timerState !== "idle" && timerState !== "finished") return;
    const secs = Math.max(1, durationMinutes) * 60;
    sessionLengthRef.current = secs;
    remainingRef.current = secs;
    sessionStartRef.current = new Date();
    runningStartRef.current = new Date();
    elapsedRef.current = 0;
    hasLoggedRef.current = false;
    setDisplaySeconds(secs);
    setTimerState("running");
    startTick();
  }

  function handlePause() {
    if (timerState !== "running") return;
    clearIntervalSafe();
    elapsedRef.current +=
      (Date.now() - (runningStartRef.current?.getTime() ?? Date.now())) / 1000;
    setTimerState("paused");
  }

  function handleResume() {
    if (timerState !== "paused") return;
    runningStartRef.current = new Date();
    setTimerState("running");
    startTick();
  }

  function handleStopAndLog() {
    if (timerState !== "running" && timerState !== "paused") return;
    clearIntervalSafe();

    const currentElapsed =
      timerState === "running"
        ? (Date.now() - (runningStartRef.current?.getTime() ?? Date.now())) /
          1000
        : 0;
    const totalElapsed = Math.round(elapsedRef.current + currentElapsed);

    if (totalElapsed > 0 && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      const endTime = new Date();
      const session: Session = {
        id: crypto.randomUUID(),
        date: getDateKey(sessionStartRef.current ?? endTime),
        startTime: (sessionStartRef.current ?? endTime).toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: totalElapsed,
        completed: false,
        sessionLengthSet: Math.round(sessionLengthRef.current / 60),
      };
      persistSession(session);
    }

    // Reset
    stopAlarm();
    remainingRef.current = sessionLengthRef.current;
    elapsedRef.current = 0;
    sessionStartRef.current = null;
    runningStartRef.current = null;
    hasLoggedRef.current = false;
    setDisplaySeconds(durationMinutes * 60);
    setTimerState("idle");
    setShowComplete(false);
  }

  function handleReset() {
    clearIntervalSafe();
    stopAlarm();
    remainingRef.current = durationMinutes * 60;
    elapsedRef.current = 0;
    sessionStartRef.current = null;
    runningStartRef.current = null;
    hasLoggedRef.current = false;
    setDisplaySeconds(durationMinutes * 60);
    setTimerState("idle");
    setShowComplete(false);
  }

  function handleDeleteSession(id: string) {
    const all = loadSessions().filter((s) => s.id !== id);
    saveSessions(all);
    setSessions(all);
  }

  function handleDurationChange(val: number) {
    const clamped = Math.max(1, Math.min(999, val));
    setDurationMinutes(clamped);
    if (timerState === "idle" || timerState === "finished") {
      const secs = clamped * 60;
      setDisplaySeconds(secs);
      remainingRef.current = secs;
    }
  }

  // Timer display state
  const isRunning = timerState === "running";
  const isPaused = timerState === "paused";
  const isFinished = timerState === "finished";
  const isActive = isRunning || isPaused;

  const countdownColorClass = isFinished
    ? "text-success animate-timer-pulse-green"
    : isRunning
      ? "text-foreground"
      : isPaused
        ? "text-foreground/60"
        : "text-foreground/40";

  // Progress for the arc indicator
  const progress =
    sessionLengthRef.current > 0
      ? 1 - displaySeconds / sessionLengthRef.current
      : 0;

  return (
    <div className="flex flex-col min-h-screen pt-safe pb-safe">
      <div className="max-w-md mx-auto w-full px-5 flex flex-col flex-1">
        {/* ── Header: today total + weekly link ── */}
        <header className="flex items-center justify-between pt-6 pb-2">
          <div>
            <div className="text-xs text-foreground/35 uppercase tracking-widest mb-0.5">
              Today
            </div>
            <div
              className="text-2xl font-mono font-bold text-foreground/80 tabular-nums"
              data-ocid="timer.today_total"
            >
              {formatTotal(todayTotal)}
            </div>
          </div>
          <button
            type="button"
            onClick={onWeekly}
            className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-foreground/70 transition-colors px-3 py-2 rounded-md hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-ocid="timer.weekly_link"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Weekly</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </header>

        {/* ── Countdown + progress ring ── */}
        <main className="flex flex-col items-center py-6">
          {/* Progress ring — own fixed block, never collapses */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 260, height: 260, flexShrink: 0 }}
          >
            <svg
              className="absolute inset-0"
              width="260"
              height="260"
              viewBox="0 0 260 260"
              style={{ transform: "rotate(-90deg)" }}
              aria-hidden="true"
            >
              {/* Track */}
              <circle
                cx="130"
                cy="130"
                r="120"
                fill="none"
                stroke="oklch(0.16 0 0)"
                strokeWidth="3"
              />
              {/* Progress */}
              {(isActive || isFinished) && (
                <circle
                  cx="130"
                  cy="130"
                  r="120"
                  fill="none"
                  stroke={
                    isFinished
                      ? "oklch(0.74 0.18 142)"
                      : isRunning
                        ? "oklch(0.78 0.18 68)"
                        : "oklch(0.55 0.12 68)"
                  }
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 120}`}
                  strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress)}`}
                  style={{
                    transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease",
                  }}
                />
              )}
            </svg>

            {/* Countdown number */}
            <div
              role={alarmActive ? "button" : undefined}
              tabIndex={alarmActive ? 0 : undefined}
              className={`font-mono-display font-bold select-none z-10 transition-colors duration-500 ${countdownColorClass} ${alarmActive ? "cursor-pointer" : ""}`}
              style={{
                fontSize: "clamp(4rem, 18vw, 7rem)",
                letterSpacing: "-0.03em",
              }}
              data-ocid="timer.countdown"
              aria-live="off"
              aria-label={
                alarmActive
                  ? "Tap to stop alarm"
                  : `${Math.floor(displaySeconds / 60)} minutes ${displaySeconds % 60} seconds remaining`
              }
              onClick={alarmActive ? stopAlarm : undefined}
              onKeyDown={
                alarmActive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") stopAlarm();
                    }
                  : undefined
              }
            >
              {formatCountdown(displaySeconds)}
            </div>
          </div>

          {/* Session complete banner — below the ring, never inside it */}
          {showComplete && (
            <div
              className="animate-flash-in bg-surface rounded-lg px-6 py-3 text-success font-semibold text-base tracking-wide text-center border border-green-900/40 mt-6 w-full max-w-xs"
              role="alert"
              aria-live="assertive"
            >
              ✓ Session complete!
            </div>
          )}

          {/* Gap between ring bottom and the controls below */}
          <div style={{ height: 32 }} />

          {/* Duration input — always below the ring with guaranteed clearance */}
          {(timerState === "idle" || timerState === "finished") && (
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => handleDurationChange(durationMinutes - 5)}
                disabled={isActive}
                className="w-9 h-9 rounded-md bg-surface text-foreground/50 hover:text-foreground hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Decrease by 5 minutes"
              >
                −
              </button>
              <input
                id="duration-input"
                type="number"
                min={1}
                max={999}
                value={durationMinutes}
                onChange={(e) =>
                  handleDurationChange(Number.parseInt(e.target.value) || 1)
                }
                disabled={isActive}
                className="w-20 text-center bg-surface text-foreground border border-border rounded-md py-2 text-2xl font-mono font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40 disabled:cursor-not-allowed transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                data-ocid="timer.duration_input"
                aria-label="Session length in minutes"
              />
              <button
                type="button"
                onClick={() => handleDurationChange(durationMinutes + 5)}
                disabled={isActive}
                className="w-9 h-9 rounded-md bg-surface text-foreground/50 hover:text-foreground hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Increase by 5 minutes"
              >
                +
              </button>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3 flex-wrap mb-2">
            {/* Start */}
            {(timerState === "idle" || timerState === "finished") && (
              <button
                type="button"
                onClick={handleStart}
                className="px-8 py-3 rounded-md bg-primary/90 text-primary-foreground font-semibold text-base hover:bg-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-glow-amber active:scale-95"
                data-ocid="timer.start_button"
              >
                Start
              </button>
            )}

            {/* Pause / Resume */}
            {isActive && (
              <button
                type="button"
                onClick={timerState === "running" ? handlePause : handleResume}
                className="px-6 py-3 rounded-md bg-surface-raised text-foreground/80 font-semibold text-base hover:text-foreground hover:bg-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                data-ocid="timer.pause_button"
              >
                {timerState === "running" ? "Pause" : "Resume"}
              </button>
            )}

            {/* Stop & Log */}
            {isActive && (
              <button
                type="button"
                onClick={handleStopAndLog}
                className="px-6 py-3 rounded-md border border-border text-foreground/60 font-semibold text-base hover:text-foreground hover:border-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                data-ocid="timer.stop_button"
              >
                Stop &amp; Log
              </button>
            )}

            {/* Reset */}
            {(isActive || timerState === "finished") && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-3 rounded-md text-foreground/35 text-sm hover:text-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                data-ocid="timer.reset_button"
                aria-label="Reset timer without logging"
              >
                Reset
              </button>
            )}
          </div>
        </main>

        {/* ── Today's Sessions ── */}
        <section className="pb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs text-foreground/35 uppercase tracking-widest">
              Today's Sessions
            </h2>
            {todaySessions.length > 0 && (
              <span className="text-xs text-foreground/25 tabular-nums">
                {todaySessions.length} session
                {todaySessions.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-px" data-ocid="timer.sessions_list">
            {todaySessions.length === 0 ? (
              <div className="py-8 text-center text-foreground/25 text-sm">
                No sessions yet today
              </div>
            ) : (
              todaySessions.map((session, i) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-3 px-3 rounded-md hover:bg-surface transition-colors group animate-slide-up"
                  data-ocid={`timer.session.item.${i + 1}` as string}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono text-sm tabular-nums text-foreground/70 shrink-0">
                      {formatTime(session.startTime)}
                    </span>
                    <span className="text-foreground/20 text-xs shrink-0">
                      →
                    </span>
                    <span className="font-mono text-sm tabular-nums text-foreground/70 shrink-0">
                      {formatTime(session.endTime)}
                    </span>
                    <span className="text-foreground/20 text-xs shrink-0">
                      •
                    </span>
                    <span className="font-mono text-sm font-semibold text-accent-amber tabular-nums shrink-0 ml-1">
                      {formatDuration(session.durationSeconds)}
                    </span>
                    <span className="text-foreground/20 text-xs shrink-0">
                      •
                    </span>
                    <span
                      className={`text-xs font-medium truncate ${
                        session.completed
                          ? "text-success/70"
                          : "text-foreground/35"
                      }`}
                    >
                      {session.completed ? "Completed" : "Stopped early"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(session.id)}
                    className="ml-2 w-7 h-7 flex items-center justify-center rounded text-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                    aria-label={`Delete session at ${formatTime(session.startTime)}`}
                    data-ocid={`timer.session.delete_button.${i + 1}` as string}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-4 text-foreground/15 text-xs border-t border-border/50">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            className="hover:text-foreground/30 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Built with ♥ using caffeine.ai
          </a>
        </footer>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("timer");
  const [sessions, setSessions] = useState<Session[]>(loadSessions);

  return (
    <div className="min-h-screen bg-background">
      {view === "timer" ? (
        <TimerView
          onWeekly={() => setView("weekly")}
          sessions={sessions}
          setSessions={setSessions}
        />
      ) : (
        <WeeklyView onBack={() => setView("timer")} sessions={sessions} />
      )}
    </div>
  );
}
