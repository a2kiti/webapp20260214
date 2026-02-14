"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./settings.module.css";

type Settings = {
  carryOverEnabled: boolean;
  parentPin: string;
  alarmTone: "beep" | "chime";
  alarmVolume: number;
  fullCompletionMinutes: number;
  fallbackMinutes: number;
};

type CheckKey = "prep" | "homework" | "sleep" | "leave";
type DailyChecks = Record<CheckKey, boolean>;
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

const STORAGE_SETTINGS_KEY = "habit-game-settings";
const STORAGE_RECORDS_KEY = "habit-game-records";
const DEFAULT_SETTINGS: Settings = {
  carryOverEnabled: false,
  parentPin: "1234",
  alarmTone: "beep",
  alarmVolume: 70,
  fullCompletionMinutes: 45,
  fallbackMinutes: 15,
};

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
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayKey(todayKey: string): string {
  const date = new Date(`${todayKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultChecks(): DailyChecks {
  return {
    prep: false,
    homework: false,
    sleep: false,
    leave: false,
  };
}

function resetTodayRecord(settings: Settings): void {
  const raw = localStorage.getItem(STORAGE_RECORDS_KEY);
  const records: Record<string, DailyRecord> = raw ? (JSON.parse(raw) as Record<string, DailyRecord>) : {};
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey(todayKey);
  const yesterday = records[yesterdayKey];
  const carryInSeconds =
    settings.carryOverEnabled && yesterday?.remainingSeconds && yesterday.remainingSeconds > 0
      ? yesterday.remainingSeconds
      : 0;

  records[todayKey] = {
    date: todayKey,
    checks: getDefaultChecks(),
    carryInSeconds,
    lockedAllocationMinutes: null,
    remainingSeconds: null,
    isRunning: false,
    isAlarming: false,
    lastStartedAt: null,
  };
  localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    return loadSettings();
  });
  const [pinInput, setPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  function unlock(): void {
    if (pinInput === settings.parentPin) {
      setUnlocked(true);
      setMessage("");
      return;
    }
    setMessage("PINが違います");
  }

  function toggleCarry(value: boolean): void {
    const next = { ...settings, carryOverEnabled: value };
    setSettings(next);
    saveSettings(next);
    setMessage("設定を保存しました");
  }

  function updateAlarmTone(tone: "beep" | "chime"): void {
    const next = { ...settings, alarmTone: tone };
    setSettings(next);
    saveSettings(next);
    setMessage("アラーム音を保存しました");
  }

  function updateAlarmVolume(volume: number): void {
    const next = { ...settings, alarmVolume: volume };
    setSettings(next);
    saveSettings(next);
    setMessage("音量を保存しました");
  }

  function updateTimerMinutes(key: "fullCompletionMinutes" | "fallbackMinutes", value: number): void {
    const normalized = Math.max(1, Math.min(180, Math.round(value)));
    const next = { ...settings, [key]: normalized };
    setSettings(next);
    saveSettings(next);
    setMessage("タイマー時間を保存しました");
  }

  function resetTodayState(): void {
    resetTodayRecord(settings);
    setShowResetConfirm(false);
    setMessage("今日の状態をリセットしました");
  }

  function updatePin(): void {
    if (!/^\d{4}$/.test(newPin)) {
      setMessage("新しいPINは4桁の数字で入力してください");
      return;
    }
    const next = { ...settings, parentPin: newPin };
    setSettings(next);
    saveSettings(next);
    setNewPin("");
    setMessage("PINを更新しました");
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>親設定</h1>
        <p className={styles.sub}>保護者用</p>

        {!unlocked ? (
          <div className={styles.block}>
            <label htmlFor="pin">PIN（4桁）</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
            />
            <button type="button" onClick={unlock}>
              ロック解除
            </button>
            <p className={styles.hint}>初期PIN: 1234</p>
          </div>
        ) : (
          <>
            <div className={styles.block}>
              <p className={styles.blockTitle}>繰越</p>
              <div className={styles.row}>
                <button
                  type="button"
                  className={!settings.carryOverEnabled ? styles.on : ""}
                  onClick={() => toggleCarry(false)}
                >
                  OFF
                </button>
                <button
                  type="button"
                  className={settings.carryOverEnabled ? styles.on : ""}
                  onClick={() => toggleCarry(true)}
                >
                  ON
                </button>
              </div>
              <p className={styles.hint}>ONで前日の残りを追加</p>
            </div>

            <div className={styles.block}>
              <p className={styles.blockTitle}>PIN変更</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="新しい4桁PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              />
              <button type="button" onClick={updatePin}>
                PINを更新
              </button>
            </div>

            <div className={styles.block}>
              <p className={styles.blockTitle}>終了音</p>
              <div className={styles.row}>
                <button
                  type="button"
                  className={settings.alarmTone === "beep" ? styles.on : ""}
                  onClick={() => updateAlarmTone("beep")}
                >
                  電子音
                </button>
                <button
                  type="button"
                  className={settings.alarmTone === "chime" ? styles.on : ""}
                  onClick={() => updateAlarmTone("chime")}
                >
                  チャイム
                </button>
              </div>
              <label htmlFor="alarm-volume">音量: {settings.alarmVolume}%</label>
              <input
                id="alarm-volume"
                className={styles.range}
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.alarmVolume}
                onChange={(e) => updateAlarmVolume(Number(e.target.value))}
              />
            </div>

            <div className={styles.block}>
              <p className={styles.blockTitle}>タイマー時間</p>
              <div className={styles.timerGrid}>
                <label htmlFor="full-minutes">4つ達成（分）</label>
                <input
                  id="full-minutes"
                  className={styles.number}
                  type="number"
                  min={1}
                  max={180}
                  value={settings.fullCompletionMinutes}
                  onChange={(e) => updateTimerMinutes("fullCompletionMinutes", Number(e.target.value))}
                />
                <label htmlFor="fallback-minutes">未達成（分）</label>
                <input
                  id="fallback-minutes"
                  className={styles.number}
                  type="number"
                  min={1}
                  max={180}
                  value={settings.fallbackMinutes}
                  onChange={(e) => updateTimerMinutes("fallbackMinutes", Number(e.target.value))}
                />
              </div>
              <p className={styles.hint}>1〜180分</p>
            </div>

            <div className={styles.block}>
              <p className={styles.blockTitle}>今日をリセット</p>
              <button type="button" className={styles.dangerBtn} onClick={() => setShowResetConfirm(true)}>
                リセット
              </button>
              <p className={styles.hint}>チェックとタイマーを初期化</p>
            </div>
          </>
        )}

        {message ? <p className={styles.message}>{message}</p> : null}

        <Link href="/" className={styles.back}>
          もどる
        </Link>
      </section>

      {showResetConfirm ? (
        <section className={styles.confirmOverlay}>
          <article className={styles.confirmModal}>
            <h2>今日をリセットしますか？</h2>
            <p>チェックとタイマーが初期化されます</p>
            <div className={styles.confirmButtons}>
              <button type="button" onClick={() => setShowResetConfirm(false)}>
                キャンセル
              </button>
              <button type="button" className={styles.dangerBtn} onClick={resetTodayState}>
                リセットする
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
