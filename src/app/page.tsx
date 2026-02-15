"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type CheckKey = "prep" | "homework" | "sleep" | "leave";

type DailyChecks = Record<CheckKey, boolean>;
type AlarmTone = "beep" | "chime";

type DailyRecord = {
  date: string;
  checks: DailyChecks;
  carryInSeconds: number;
  lockedAllocationMinutes: number | null;
  remainingSeconds: number | null;
  isRunning: boolean;
  isAlarming: boolean;
  lastStartedAt: number | null;
};

type Settings = {
  carryOverEnabled: boolean;
  parentPin: string;
  alarmTone: AlarmTone;
  alarmVolume: number;
  fullCompletionMinutes: number;
  fallbackMinutes: number;
  fullCompletionMinutesWeekend: number;
  fallbackMinutesWeekend: number;
};

const STORAGE_RECORDS_KEY = "habit-game-records";
const STORAGE_SETTINGS_KEY = "habit-game-settings";
const DEFAULT_SETTINGS: Settings = {
  carryOverEnabled: false,
  parentPin: "1234",
  alarmTone: "beep",
  alarmVolume: 70,
  fullCompletionMinutes: 45,
  fallbackMinutes: 15,
  fullCompletionMinutesWeekend: 45,
  fallbackMinutesWeekend: 15,
};
const DEFAULT_CHECKS: DailyChecks = {
  prep: false,
  homework: false,
  sleep: false,
  leave: false,
};

const CHECK_ITEMS: Array<{ key: CheckKey; label: string }> = [
  { key: "prep", label: "学校の用意" },
  { key: "homework", label: "宿題とチャレンジ" },
  { key: "sleep", label: "22:00までに就寝" },
  { key: "leave", label: "7:30までに出発" },
];

const TOKYO_TIME_ZONE = "Asia/Tokyo";

function toDateKeyInTokyo(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function fromDateKeyToUtcDate(dateKey: string): Date {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return new Date(Date.UTC(year, month - 1, day));
}

function getTodayKey(): string {
  return toDateKeyInTokyo(new Date());
}

function getYesterdayKey(todayKey: string): string {
  const date = fromDateKeyToUtcDate(todayKey);
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(dateKey: string): boolean {
  const day = fromDateKeyToUtcDate(dateKey).getUTCDay();
  return day === 0 || day === 6;
}

function allocationFromChecks(checks: DailyChecks, settings: Settings, weekend: boolean): number {
  if (Object.values(checks).every(Boolean)) {
    return weekend ? settings.fullCompletionMinutesWeekend : settings.fullCompletionMinutes;
  }
  return weekend ? settings.fallbackMinutesWeekend : settings.fallbackMinutes;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatJapaneseDate(dateKey: string): string {
  const d = fromDateKeyToUtcDate(dateKey);
  return d.toLocaleDateString("ja-JP", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatCurrentTime(now: Date): string {
  return now.toLocaleTimeString("ja-JP", {
    timeZone: TOKYO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      carryOverEnabled: Boolean(parsed.carryOverEnabled),
      parentPin: parsed.parentPin && /^\d{4}$/.test(parsed.parentPin) ? parsed.parentPin : "1234",
      alarmTone: parsed.alarmTone === "chime" ? "chime" : "beep",
      alarmVolume:
        typeof parsed.alarmVolume === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.alarmVolume)))
          : DEFAULT_SETTINGS.alarmVolume,
      fullCompletionMinutes:
        typeof parsed.fullCompletionMinutes === "number"
          ? Math.max(1, Math.min(180, Math.round(parsed.fullCompletionMinutes)))
          : DEFAULT_SETTINGS.fullCompletionMinutes,
      fallbackMinutes:
        typeof parsed.fallbackMinutes === "number"
          ? Math.max(1, Math.min(180, Math.round(parsed.fallbackMinutes)))
          : DEFAULT_SETTINGS.fallbackMinutes,
      fullCompletionMinutesWeekend:
        typeof parsed.fullCompletionMinutesWeekend === "number"
          ? Math.max(1, Math.min(180, Math.round(parsed.fullCompletionMinutesWeekend)))
          : DEFAULT_SETTINGS.fullCompletionMinutesWeekend,
      fallbackMinutesWeekend:
        typeof parsed.fallbackMinutesWeekend === "number"
          ? Math.max(1, Math.min(180, Math.round(parsed.fallbackMinutesWeekend)))
          : DEFAULT_SETTINGS.fallbackMinutesWeekend,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadRecords(): Record<string, DailyRecord> {
  const raw = localStorage.getItem(STORAGE_RECORDS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DailyRecord>;
  } catch {
    return {};
  }
}

function saveRecords(records: Record<string, DailyRecord>): void {
  localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
}

function createRecordForDate(dateKey: string, records: Record<string, DailyRecord>, settings: Settings): DailyRecord {
  const existing = records[dateKey];
  if (existing) {
    return {
      ...existing,
      isAlarming: Boolean(existing.isAlarming),
    };
  }

  const yesterdayKey = getYesterdayKey(dateKey);
  const yesterday = records[yesterdayKey];
  const carryInSeconds =
    settings.carryOverEnabled && yesterday && yesterday.remainingSeconds && yesterday.remainingSeconds > 0
      ? yesterday.remainingSeconds
      : 0;

  return {
    date: dateKey,
    checks: { ...DEFAULT_CHECKS },
    carryInSeconds,
    lockedAllocationMinutes: null,
    remainingSeconds: null,
    isRunning: false,
    isAlarming: false,
    lastStartedAt: null,
  };
}

function getInitialTodayRecord(): DailyRecord {
  const todayKey = getTodayKey();
  const settings = loadSettings();
  const records = loadRecords();
  return createRecordForDate(todayKey, records, settings);
}

function playTimerEndSound(settings: Settings): void {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return;
  const audioContext = new window.AudioContext();
  const oscillatorA = audioContext.createOscillator();
  const oscillatorB = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const volume = Math.max(0.02, settings.alarmVolume / 100) * 0.45;

  oscillatorA.type = settings.alarmTone === "chime" ? "triangle" : "sine";
  oscillatorB.type = settings.alarmTone === "chime" ? "triangle" : "sine";

  if (settings.alarmTone === "chime") {
    oscillatorA.frequency.setValueAtTime(523.25, audioContext.currentTime);
    oscillatorA.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.18);
    oscillatorB.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.02);
    oscillatorB.frequency.setValueAtTime(987.77, audioContext.currentTime + 0.2);
  } else {
    oscillatorA.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillatorA.frequency.setValueAtTime(660, audioContext.currentTime + 0.2);
    oscillatorB.frequency.setValueAtTime(1320, audioContext.currentTime);
    oscillatorB.frequency.setValueAtTime(990, audioContext.currentTime + 0.2);
  }

  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.55);

  oscillatorA.connect(gainNode);
  oscillatorB.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillatorA.start();
  oscillatorB.start();
  oscillatorA.stop(audioContext.currentTime + 0.6);
  oscillatorB.stop(audioContext.currentTime + 0.6);
  oscillatorA.onended = () => {
    void audioContext.close();
  };
}

export default function Home() {
  const [today, setToday] = useState<DailyRecord | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const alarmIntervalRef = useRef<number | null>(null);
  const [showStartConfirm, setShowStartConfirm] = useState(false);

  useEffect(() => {
    const loadedSettings = loadSettings();
    const current = getInitialTodayRecord();
    // Ensure first client render matches server HTML, then hydrate state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadedSettings);
    setToday(current);
  }, []);

  useEffect(() => {
    if (!today) return;
    const records = loadRecords();
    records[today.date] = today;
    saveRecords(records);
  }, [today]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setToday((prev) => {
        if (!prev || !prev.isRunning || !prev.lastStartedAt || prev.remainingSeconds === null) {
          return prev;
        }
        const now = Date.now();
        const elapsed = Math.floor((now - prev.lastStartedAt) / 1000);
        if (elapsed <= 0) return prev;

        const nextRemaining = Math.max(0, prev.remainingSeconds - elapsed);
        const next: DailyRecord = {
          ...prev,
          remainingSeconds: nextRemaining,
          lastStartedAt: nextRemaining > 0 ? prev.lastStartedAt + elapsed * 1000 : null,
          isRunning: nextRemaining > 0,
          isAlarming: nextRemaining === 0 ? true : prev.isAlarming,
        };
        const records = loadRecords();
        records[next.date] = next;
        saveRecords(records);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const latestSettings = loadSettings();
      setSettings(latestSettings);
      setToday((prev) => {
        if (!prev) return prev;

        const todayKey = getTodayKey();
        if (prev.date === todayKey) return prev;

        const records = loadRecords();
        records[prev.date] = prev;
        const next = createRecordForDate(todayKey, records, latestSettings);
        records[todayKey] = next;
        saveRecords(records);
        setShowStartConfirm(false);
        return next;
      });
    }, 30 * 1000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!today?.isAlarming) {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      return;
    }
    const alarmSettings = loadSettings();
    playTimerEndSound(alarmSettings);
    alarmIntervalRef.current = window.setInterval(() => {
      playTimerEndSound(alarmSettings);
    }, 900);
    return () => {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    };
  }, [today?.isAlarming]);

  const currentAllocation = useMemo(() => {
    if (!today) return 15;
    return allocationFromChecks(today.checks, settings, isWeekend(today.date));
  }, [today, settings]);

  const weekend = today ? isWeekend(today.date) : false;
  const todayFullMinutes = weekend ? settings.fullCompletionMinutesWeekend : settings.fullCompletionMinutes;
  const todayFallbackMinutes = weekend ? settings.fallbackMinutesWeekend : settings.fallbackMinutes;

  const grantedMinutes = today?.lockedAllocationMinutes ?? currentAllocation;
  const initialSeconds = grantedMinutes * 60 + (today?.carryInSeconds ?? 0);
  const remainingSeconds = today?.remainingSeconds ?? initialSeconds;

  function persist(next: DailyRecord): void {
    setToday(next);
    const records = loadRecords();
    records[next.date] = next;
    saveRecords(records);
  }

  function toggleCheck(key: CheckKey): void {
    if (!today || today.isRunning) return;
    const next: DailyRecord = {
      ...today,
      checks: {
        ...today.checks,
        [key]: !today.checks[key],
      },
    };
    persist(next);
  }

  function startTimer(skipConfirm: boolean = false): void {
    if (!today) return;
    const allChecked = Object.values(today.checks).every(Boolean);
    if (!skipConfirm && !allChecked) {
      setShowStartConfirm(true);
      return;
    }

    const now = Date.now();
    const allocation = today.lockedAllocationMinutes ?? currentAllocation;
    const baseSeconds =
      today.remainingSeconds === null ? allocation * 60 + today.carryInSeconds : today.remainingSeconds;

    if (baseSeconds <= 0) return;

    const next: DailyRecord = {
      ...today,
      lockedAllocationMinutes: allocation,
      remainingSeconds: baseSeconds,
      isRunning: true,
      isAlarming: false,
      lastStartedAt: now,
    };
    setShowStartConfirm(false);
    persist(next);
  }

  function pauseTimer(): void {
    if (!today || !today.isRunning || today.remainingSeconds === null || !today.lastStartedAt) return;
    const elapsed = Math.floor((Date.now() - today.lastStartedAt) / 1000);
    const nextRemaining = Math.max(0, today.remainingSeconds - elapsed);
    const next: DailyRecord = {
      ...today,
      remainingSeconds: nextRemaining,
      isRunning: false,
      isAlarming: false,
      lastStartedAt: null,
    };
    persist(next);
  }

  function finishTimer(): void {
    if (!today) return;
    const next: DailyRecord = {
      ...today,
      remainingSeconds: 0,
      isRunning: false,
      isAlarming: false,
      lastStartedAt: null,
      lockedAllocationMinutes: today.lockedAllocationMinutes ?? currentAllocation,
    };
    persist(next);
  }

  if (!today) {
    return (
      <main className={styles.page}>
        <p>読み込み中...</p>
      </main>
    );
  }

  const canStart = remainingSeconds > 0;

  return (
    <main className={styles.page}>
      <section className={styles.headerCard}>
        <div>
          <p className={styles.label}>きょう</p>
          <h1 className={styles.date}>
            {formatJapaneseDate(today.date)}
            <span className={styles.time}> {formatCurrentTime(currentTime)}</span>
          </h1>
        </div>
        <div className={styles.headerRight}>
          <p className={styles.label}>ゲーム時間</p>
          <p className={styles.minutes}>{grantedMinutes}分</p>
          {today.carryInSeconds > 0 ? <p className={styles.carry}>くりこし +{Math.floor(today.carryInSeconds / 60)}分</p> : null}
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>チェック</h2>
          <p className={styles.sub}>4つ ぜんぶ できた？</p>
          <div className={styles.checkList}>
            {CHECK_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.checkItem} ${today.checks[item.key] ? styles.checkOn : ""}`}
                onClick={() => toggleCheck(item.key)}
                disabled={today.isRunning}
              >
                <span>{item.label}</span>
                <strong>{today.checks[item.key] ? "OK" : "未"}</strong>
              </button>
            ))}
          </div>
          {today.isRunning ? <p className={styles.note}>タイマー中は変更できません</p> : null}
        </article>

        <article className={styles.card}>
          <h2>タイマー</h2>
          <p className={styles.sub}>ゲーム前にスタート</p>
          <p className={styles.timer}>{formatClock(remainingSeconds)}</p>
          <div className={styles.timerButtons}>
            {!today.isRunning ? (
              <button type="button" className={styles.primaryBtn} onClick={() => startTimer()} disabled={!canStart}>
                {today.remainingSeconds === null ? "開始" : "再開"}
              </button>
            ) : (
              <button type="button" className={styles.primaryBtn} onClick={pauseTimer}>
                一時停止
              </button>
            )}
            <button type="button" className={styles.secondaryBtn} onClick={finishTimer} disabled={remainingSeconds === 0}>
              終了
            </button>
          </div>
          <p className={styles.rule}>
            {weekend ? "土日" : "平日"}: ぜんぶOK {todayFullMinutes}分 / それ以外 {todayFallbackMinutes}分
          </p>
        </article>
      </section>

      <footer className={styles.footer}>
        <p>この画面で親も確認できます</p>
        <Link href="/settings" className={styles.settingsLink}>
          親設定
        </Link>
      </footer>

      {today.isRunning || today.isAlarming ? (
        <section className={styles.fullscreenTimer}>
          <p className={styles.fullscreenLabel}>{today.isAlarming ? "時間終了" : "ゲームタイマー"}</p>
          <p className={styles.fullscreenTime}>{formatClock(remainingSeconds)}</p>
          <p className={styles.fullscreenHint}>
            {today.isAlarming ? "「終了」で音が止まります" : "ゲーム中"}
          </p>
          <div className={styles.fullscreenButtons}>
            {today.isRunning ? (
              <button type="button" className={styles.primaryBtn} onClick={pauseTimer}>
                一時停止
              </button>
            ) : null}
            <button type="button" className={styles.secondaryBtn} onClick={finishTimer}>
              終了
            </button>
          </div>
        </section>
      ) : null}

      {showStartConfirm ? (
        <section className={styles.confirmOverlay}>
          <article className={styles.confirmModal}>
            <h3>チェック未完了です</h3>
            <p>このまま始めると {todayFallbackMinutes}分 です。始めますか？</p>
            <div className={styles.confirmButtons}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowStartConfirm(false)}>
                キャンセル
              </button>
              <button type="button" className={styles.primaryBtn} onClick={() => startTimer(true)}>
                はじめる
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
