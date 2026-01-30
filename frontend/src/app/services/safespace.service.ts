import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { I18nService } from './i18n.service';

export interface ContentCheckResult {
  is_hate_speech: boolean;
  confidence_score: number;
  categories: string[];
  explanation: string;
  suggested_revision: string | null;
  alternative_suggestions: string[];
  revision_explanation: string | null;
  would_be_status: string;
}

export type ModerationCheckResult = ContentCheckResult;

export interface ModerationReport {
  report_id: string;
  post_id: number;
  status: string;
  is_hate_speech: boolean;
  confidence_score: number;
  categories: string[];
  processed_at: string;
}

export interface UserModerationStats {
  user_uid: number;
  total_posts: number;
  flagged_posts: number;
  blocked_posts: number;
  modified_posts: number;
  hate_speech_score: number;
  categories_triggered: Record<string, number>;
  last_violation: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SafeSpaceService {
  private readonly API_URL = '/api/safespace';
  private http = inject(HttpClient);
  private i18n = inject(I18nService);

  // Signals für Content-Check während des Tippens
  private lastCheckResult = signal<ContentCheckResult | null>(null);
  private isChecking = signal(false);

  readonly checkResult = computed(() => this.lastCheckResult());
  readonly checking = computed(() => this.isChecking());

  /**
   * Prüft Content auf Hassrede BEVOR er gepostet wird.
   * Kann während des Tippens aufgerufen werden (mit Debounce).
   *
   * @param content Der zu prüfende Inhalt
   * @param language Sprache für die Moderation (de, en, es, fr, it, ar)
   */
  checkContent(content: string, language?: string): Observable<ContentCheckResult> {
    this.isChecking.set(true);

    // Sprache aus localStorage oder Browser-Sprache ermitteln
    if (!language) {
      language = localStorage.getItem('preferredLanguage') || navigator.language.split('-')[0] || 'de';
    }

    return this.http.post<ContentCheckResult>(`${this.API_URL}/check`, null, {
      params: {
        content,
        language
      }
    }).pipe(
      tap(result => {
        this.lastCheckResult.set(result);
        this.isChecking.set(false);
      })
    );
  }

  /**
   * Fordert einen Verbesserungsvorschlag für problematischen Content an.
   *
   * @param content Der zu verbessernde Inhalt
   * @param language Sprache für den Vorschlag (de, en, es, fr, it, ar)
   */
  suggestRevision(content: string, language?: string): Observable<{ original: string; suggestion: string }> {
    // Sprache aus localStorage oder Browser-Sprache ermitteln
    if (!language) {
      language = localStorage.getItem('preferredLanguage') || navigator.language.split('-')[0] || 'de';
    }

    return this.http.post<{ original: string; suggestion: string }>(
      `${this.API_URL}/suggest-revision`,
      null,
      {
        params: {
          content,
          language
        }
      }
    );
  }

  /**
   * Lädt Moderation Reports für den aktuellen User.
   */
  getMyReports(userUid: number, limit = 20): Observable<{ reports: ModerationReport[] }> {
    return this.http.get<{ reports: ModerationReport[] }>(
      `${this.API_URL}/reports/user/${userUid}`,
      { params: { limit: limit.toString() } }
    );
  }

  /**
   * Lädt Moderations-Statistiken für den aktuellen User.
   */
  getMyStats(userUid: number): Observable<UserModerationStats> {
    return this.http.get<UserModerationStats>(
      `${this.API_URL}/stats/user/${userUid}`
    );
  }

  /**
   * Setzt das Check-Ergebnis zurück.
   */
  clearCheckResult(): void {
    this.lastCheckResult.set(null);
  }

  /**
   * Gibt Farbe basierend auf Confidence Score zurück.
   */
  getScoreColor(score: number): string {
    if (score < 0.3) return '#4caf50';  // Grün
    if (score < 0.5) return '#ff9800';  // Orange
    if (score < 0.7) return '#f44336';  // Rot
    return '#b71c1c';                    // Dunkelrot
  }

  /**
   * Gibt deutsche Bezeichnung für Kategorie zurück.
   */
  getCategoryLabel(category: string): string {
    const keyMap: Record<string, string> = {
      racism: 'categories.racism',
      sexism: 'categories.sexism',
      homophobia: 'categories.homophobia',
      religious_hate: 'categories.religiousHate',
      disability_hate: 'categories.disabilityHate',
      xenophobia: 'categories.xenophobia',
      general_hate: 'categories.generalHate',
      threat: 'categories.threat',
      harassment: 'categories.harassment',
      none: 'categories.none'
    };
    const key = keyMap[category];
    return key ? this.i18n.t(key) : category;
  }
}
