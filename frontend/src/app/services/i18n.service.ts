import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  file: string;
}

const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', file: 'english' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', file: 'german' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', file: 'spanish' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', file: 'italian' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', file: 'french' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', file: 'arabic' }
];

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private translations = signal<any>({});
  private currentLangCode = signal<string>('en');

  public readonly currentLanguage = computed(() => {
    const code = this.currentLangCode();
    return AVAILABLE_LANGUAGES.find(l => l.code === code) || AVAILABLE_LANGUAGES[0];
  });

  public readonly languages = AVAILABLE_LANGUAGES;

  constructor(private http: HttpClient) {
    this.initLanguage();
  }

  private async initLanguage(): Promise<void> {
    // Check if user has a preferred language in localStorage
    const savedLang = localStorage.getItem('preferredLanguage');

    let langCode = 'en'; // Default fallback

    if (savedLang) {
      // Use saved preference
      langCode = savedLang;
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0]; // e.g., "en-US" -> "en"
      const supportedLang = AVAILABLE_LANGUAGES.find(l => l.code === browserLang);
      if (supportedLang) {
        langCode = browserLang;
      }
    }

    await this.setLanguage(langCode);
  }

  public async setLanguage(code: string): Promise<void> {
    const language = AVAILABLE_LANGUAGES.find(l => l.code === code);
    if (!language) {
      console.error(`Language ${code} not found`);
      return;
    }

    try {
      const translations = await firstValueFrom(
        this.http.get(`/assets/i18n/${language.file}.json`)
      );

      this.translations.set(translations);
      this.currentLangCode.set(code);
      localStorage.setItem('preferredLanguage', code);

      // Update HTML lang attribute
      document.documentElement.lang = code;

      // Set direction for RTL languages (Arabic)
      document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';

    } catch (error) {
      console.error(`Failed to load language ${code}:`, error);
    }
  }

  public t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.translations();

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // Replace parameters like {{count}}
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match: string, paramKey: string) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : match;
      });
    }

    return value;
  }

  /**
   * Get array translation (useful for lists)
   */
  public tArray(key: string): string[] {
    const keys = key.split('.');
    let value: any = this.translations();

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return [];
      }
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value;
  }
}
