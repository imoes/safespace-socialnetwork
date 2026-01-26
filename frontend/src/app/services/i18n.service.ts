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

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private translations = signal<any>({});
  private currentLangCode = signal<string>('en');
  private availableLanguagesSignal = signal<Language[]>([]);
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  public readonly currentLanguage = computed(() => {
    const code = this.currentLangCode();
    const langs = this.availableLanguagesSignal();
    return langs.find(l => l.code === code) || langs[0];
  });

  public readonly languages = computed(() => this.availableLanguagesSignal());

  public readonly isLoaded = computed(() => Object.keys(this.translations()).length > 0);

  constructor(private http: HttpClient) {
    // Don't auto-init in constructor - use initialize() for APP_INITIALIZER
  }

  /**
   * Initialize the i18n service - called by APP_INITIALIZER
   * Ensures translations are loaded before app starts
   */
  public initialize(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.loadAvailableLanguages();
    return this.initPromise;
  }

  /**
   * Lädt verfügbare Sprachen aus dem Dateisystem
   */
  private async loadAvailableLanguages(): Promise<void> {
    try {
      const languages = await firstValueFrom(
        this.http.get<Language[]>('/assets/i18n/languages.json')
      );

      this.availableLanguagesSignal.set(languages);
      console.log('✅ Loaded available languages:', languages.length);

      // Nach dem Laden der Sprachen initialisieren wir die Benutzersprache
      await this.initLanguage();
    } catch (error) {
      console.error('Failed to load available languages:', error);
      // Fallback auf Englisch wenn Manifest nicht geladen werden kann
      this.availableLanguagesSignal.set([
        { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', file: 'english' }
      ]);
      await this.initLanguage();
    }
  }

  private async initLanguage(): Promise<void> {
    const availableLanguages = this.availableLanguagesSignal();

    // Warte bis Sprachen geladen sind
    if (availableLanguages.length === 0) {
      console.warn('⚠️ [I18n] initLanguage called but no languages available yet');
      return;
    }

    // Check if user has a preferred language in localStorage
    const savedLang = localStorage.getItem('preferredLanguage');
    console.log(`🌐 [I18n] Saved language in localStorage: ${savedLang || 'none'}`);

    let langCode = 'en'; // Default fallback

    if (savedLang) {
      // Use saved preference
      langCode = savedLang;
      console.log(`🌐 [I18n] Using saved language: ${langCode}`);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0]; // e.g., "en-US" -> "en"
      const supportedLang = availableLanguages.find(l => l.code === browserLang);
      if (supportedLang) {
        langCode = browserLang;
        console.log(`🌐 [I18n] Using browser language: ${langCode}`);
      } else {
        console.log(`🌐 [I18n] Browser language ${browserLang} not supported, using default: ${langCode}`);
      }
    }

    await this.setLanguage(langCode);
    this.initialized = true;
    console.log('✅ [I18n] Service initialized');
  }

  public async setLanguage(code: string): Promise<void> {
    console.log(`🌐 [I18n] setLanguage called with code: '${code}'`);
    const availableLanguages = this.availableLanguagesSignal();
    console.log(`🌐 [I18n] Available languages:`, availableLanguages.map(l => l.code).join(', '));

    if (availableLanguages.length === 0) {
      console.error(`❌ [I18n] No languages available! Service might not be initialized.`);
      throw new Error('I18n service not initialized');
    }

    const language = availableLanguages.find(l => l.code === code);
    if (!language) {
      console.error(`❌ [I18n] Language '${code}' not found in available languages: [${availableLanguages.map(l => l.code).join(', ')}]`);
      throw new Error(`Language ${code} not available`);
    }

    try {
      console.log(`🌐 [I18n] Loading translations from: /assets/i18n/${language.file}.json`);
      const translations = await firstValueFrom(
        this.http.get(`/assets/i18n/${language.file}.json`)
      );

      this.translations.set(translations);
      this.currentLangCode.set(code);
      localStorage.setItem('preferredLanguage', code);
      console.log(`✅ [I18n] Language changed to: ${code}, saved to localStorage`);

      // Update HTML lang attribute
      document.documentElement.lang = code;

      // Set direction for RTL languages (Arabic)
      document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';

    } catch (error) {
      console.error(`❌ [I18n] Failed to load language ${code}:`, error);
    }
  }

  public t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.translations();

    // If translations aren't loaded yet, return key silently
    if (!this.initialized || Object.keys(value).length === 0) {
      return key;
    }

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
