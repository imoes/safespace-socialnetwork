import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ScreenTimeSettings {
  enabled: boolean;
  daily_limit_minutes: number;
  reminder_enabled: boolean;
  reminder_interval_minutes: number;
}

const STORAGE_KEY_DAILY = 'screenTime_daily';
const STORAGE_KEY_SESSION = 'screenTime_sessionStart';
const STORAGE_KEY_LAST_REMINDER = 'screenTime_lastReminder';
const STORAGE_KEY_LIMIT_WARNED = 'screenTime_limitWarned';

@Injectable({
  providedIn: 'root'
})
export class ScreenTimeService {
  private http = inject(HttpClient);

  private settingsSignal = signal<ScreenTimeSettings>({
    enabled: true,
    daily_limit_minutes: 120,
    reminder_enabled: true,
    reminder_interval_minutes: 30
  });

  readonly settings = computed(() => this.settingsSignal());

  // Signals for UI
  readonly showBreakReminder = signal(false);
  readonly showDailyLimitWarning = signal(false);
  readonly dailyUsageMinutes = signal(0);

  private tickInterval: any = null;
  private visibilityHandler: (() => void) | null = null;

  loadSettings(): void {
    this.http.get<{ settings: ScreenTimeSettings }>('/api/users/me/screen-time-settings').subscribe({
      next: (response) => {
        this.settingsSignal.set(response.settings);
        this.startTracking();
      },
      error: () => {
        // Use defaults
        this.startTracking();
      }
    });
  }

  saveSettings(settings: ScreenTimeSettings): void {
    this.settingsSignal.set(settings);
    this.http.put('/api/users/me/screen-time-settings', settings).subscribe();
  }

  /**
   * Persist daily usage to the backend (called on logout).
   */
  persistUsageToBackend(): void {
    this.persistSessionTime();
    const todayKey = this.getTodayKey();
    const minutes = this.getTodayMinutes();
    if (minutes > 0) {
      this.http.post('/api/users/me/screen-time-usage', {
        date: todayKey,
        minutes: minutes
      }).subscribe();
    }
  }

  private startTracking(): void {
    this.stopTracking();

    if (!this.settingsSignal().enabled) return;

    // Initialize session start time
    if (!sessionStorage.getItem(STORAGE_KEY_SESSION)) {
      sessionStorage.setItem(STORAGE_KEY_SESSION, Date.now().toString());
    }

    // Clean up daily data if it's a new day
    this.cleanupDailyData();

    // Tick every 60 seconds to update usage
    this.tickInterval = setInterval(() => this.tick(), 60000);

    // Also run tick immediately
    this.tick();

    // Track visibility changes
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        // User returned - update session start
        sessionStorage.setItem(STORAGE_KEY_SESSION, Date.now().toString());
      } else {
        // User left - persist accumulated time
        this.persistSessionTime();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private stopTracking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private tick(): void {
    if (!this.settingsSignal().enabled) return;
    if (document.visibilityState !== 'visible') return;

    const settings = this.settingsSignal();

    // Update daily usage
    this.persistSessionTime();
    const todayMinutes = this.getTodayMinutes();
    this.dailyUsageMinutes.set(todayMinutes);

    // Reset session start for next tick
    sessionStorage.setItem(STORAGE_KEY_SESSION, Date.now().toString());

    // Check daily limit
    const todayKey = this.getTodayKey();
    const limitWarnedKey = STORAGE_KEY_LIMIT_WARNED + '_' + todayKey;
    if (todayMinutes >= settings.daily_limit_minutes && !localStorage.getItem(limitWarnedKey)) {
      localStorage.setItem(limitWarnedKey, 'true');
      this.showDailyLimitWarning.set(true);
    }

    // Check break reminder (only if reminder is enabled)
    if (settings.reminder_enabled) {
      const lastReminder = parseInt(sessionStorage.getItem(STORAGE_KEY_LAST_REMINDER) || '0', 10);
      const now = Date.now();
      const reminderIntervalMs = settings.reminder_interval_minutes * 60 * 1000;

      if (lastReminder === 0) {
        // First visit in this session - set initial reminder time
        sessionStorage.setItem(STORAGE_KEY_LAST_REMINDER, now.toString());
      } else if (now - lastReminder >= reminderIntervalMs) {
        this.showBreakReminder.set(true);
        sessionStorage.setItem(STORAGE_KEY_LAST_REMINDER, now.toString());
      }
    }
  }

  private persistSessionTime(): void {
    const sessionStart = parseInt(sessionStorage.getItem(STORAGE_KEY_SESSION) || '0', 10);
    if (sessionStart === 0) return;

    const elapsedMs = Date.now() - sessionStart;
    const elapsedMinutes = elapsedMs / 60000;

    if (elapsedMinutes < 0.5) return; // Ignore sub-30-second intervals

    const todayKey = this.getTodayKey();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY) || '{}');
    const current = stored[todayKey] || 0;
    stored[todayKey] = current + elapsedMinutes;
    localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(stored));
  }

  private getTodayMinutes(): number {
    const todayKey = this.getTodayKey();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY) || '{}');
    return Math.round(stored[todayKey] || 0);
  }

  private getTodayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private cleanupDailyData(): void {
    const todayKey = this.getTodayKey();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY) || '{}');
    // Keep only today's data
    const cleaned: Record<string, number> = {};
    if (stored[todayKey]) {
      cleaned[todayKey] = stored[todayKey];
    }
    localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(cleaned));
  }

  dismissBreakReminder(): void {
    this.showBreakReminder.set(false);
  }

  dismissDailyLimitWarning(): void {
    this.showDailyLimitWarning.set(false);
  }

  destroy(): void {
    this.persistSessionTime();
    this.stopTracking();
  }
}
