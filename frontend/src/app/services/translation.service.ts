import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TranslationResult {
  translated_text: string;
  detected_language: string;
  target_language: string;
  error?: string;
}

export interface SupportedLanguages {
  languages: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly API_URL = '/api/translate';
  private http = inject(HttpClient);

  /**
   * Übersetzt einen Text in die Zielsprache.
   */
  translateText(
    text: string,
    targetLang: string = 'de',
    sourceLang: string = 'auto'
  ): Observable<TranslationResult> {
    return this.http.post<TranslationResult>(this.API_URL, {
      text,
      target_lang: targetLang,
      source_lang: sourceLang
    });
  }

  /**
   * Lädt die Liste der unterstützten Sprachen.
   */
  getSupportedLanguages(): Observable<SupportedLanguages> {
    return this.http.get<SupportedLanguages>(`${this.API_URL}/languages`);
  }

  /**
   * Gibt die Flagge für eine Sprache zurück.
   */
  getLanguageFlag(langCode: string): string {
    const flags: Record<string, string> = {
      de: '🇩🇪',
      en: '🇬🇧',
      es: '🇪🇸',
      fr: '🇫🇷',
      it: '🇮🇹',
      pt: '🇵🇹',
      ru: '🇷🇺',
      zh: '🇨🇳',
      ja: '🇯🇵',
      ko: '🇰🇷',
      ar: '🇸🇦',
      tr: '🇹🇷',
      pl: '🇵🇱',
      nl: '🇳🇱',
      sv: '🇸🇪',
      da: '🇩🇰',
      no: '🇳🇴',
      fi: '🇫🇮'
    };
    return flags[langCode] || '🌍';
  }

  /**
   * Gibt den Namen einer Sprache zurück.
   */
  getLanguageName(langCode: string): string {
    const names: Record<string, string> = {
      de: 'Deutsch',
      en: 'English',
      es: 'Español',
      fr: 'Français',
      it: 'Italiano',
      pt: 'Português',
      ru: 'Русский',
      zh: '中文',
      ja: '日本語',
      ko: '한국어',
      ar: 'العربية',
      tr: 'Türkçe',
      pl: 'Polski',
      nl: 'Nederlands',
      sv: 'Svenska',
      da: 'Dansk',
      no: 'Norsk',
      fi: 'Suomi',
      auto: 'Automatisch'
    };
    return names[langCode] || langCode;
  }
}
