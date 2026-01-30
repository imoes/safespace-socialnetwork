import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { I18nService } from '../../services/i18n.service';

interface WelcomeMessage {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface WelcomeStats {
  message_id: number;
  total_users: number;
  seen_count: number;
  unseen_count: number;
}

interface BroadcastPost {
  post_id: number;
  author_uid: number;
  content: string;
  visibility: string;
  created_at: string;
  username: string;
  profile_picture: string | null;
  likes_count: number;
  comments_count: number;
  is_broadcast: boolean;
}

interface DeepSeekBalance {
  is_available: boolean;
  total_balance: number;
  granted_balance: number;
  topped_up_balance: number;
  currency: string;
  model: string;
}

interface SystemStatus {
  timestamp: string;
  system: {
    uptime: string;
    uptime_seconds: number;
    cpu_percent: number;
    memory: {
      total: number;
      used: number;
      available: number;
      percent: number;
      total_gb: number;
      used_gb: number;
      available_gb: number;
    };
    disk: {
      total: number;
      used: number;
      free: number;
      percent: number;
      total_gb: number;
      used_gb: number;
      free_gb: number;
    };
  };
  users: {
    total: number;
    active_15min: number;
    online_5min: number;
    new_today: number;
    new_week: number;
    roles: { [role: string]: number };
  };
  social: {
    friendships: number;
    pending_friend_requests: number;
    posts_estimate: number;
  };
  moderation: {
    open_reports: number;
    total_reports: number;
  };
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css']
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  i18n = inject(I18nService);

  // Tabs
  activeTab = signal<'welcome' | 'broadcast' | 'status' | 'settings' | 'email-templates'>('welcome');

  // Welcome Message
  welcomeMessage = signal<WelcomeMessage | null>(null);
  welcomeStats = signal<WelcomeStats | null>(null);
  welcomeForm = {
    title: '',
    content: ''
  };

  // Broadcast Posts
  broadcastPosts = signal<BroadcastPost[]>([]);
  broadcastForm = {
    content: '',
    visibility: 'public'
  };

  // System Status
  systemStatus = signal<SystemStatus | null>(null);
  autoRefreshInterval: any = null;

  // DeepSeek Balance
  deepseekBalance = signal<DeepSeekBalance | null>(null);
  deepseekError = signal<string | null>(null);

  // Site Settings
  siteSettingsForm = {
    site_url: ''
  };
  siteSettingsLoaded = false;
  siteTitle = signal('SafeSpace');
  siteTitleForm = '';

  // Email Templates
  emailTemplates = signal<any>({});
  notificationTypes = signal<string[]>([]);
  selectedNotificationType = 'post_liked';
  selectedTemplateLang = 'de';
  templateSubject = '';
  templateBody = '';
  translating = signal(false);
  availableLanguages = [
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];
  get notificationTypeLabels(): Record<string, string> {
    return {
      'post_liked': this.i18n.t('admin.notifPostLiked'),
      'post_commented': this.i18n.t('admin.notifPostCommented'),
      'comment_liked': this.i18n.t('admin.notifCommentLiked'),
      'birthday': this.i18n.t('admin.notifBirthday'),
      'group_post': this.i18n.t('admin.notifGroupPost')
    };
  }

  // UI States
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  ngOnInit(): void {
    this.checkAdminAccess();
    this.loadWelcomeMessage();
    this.loadBroadcastPosts();
    this.loadSiteSettings();
  }

  private checkAdminAccess(): void {
    // Der User wird später durch auth_guard geprüft
    // Hier nur UI-State setzen
  }

  async loadWelcomeMessage(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: any = await this.http.get('/api/admin/welcome-message', { headers }).toPromise();
      this.welcomeMessage.set(response.message);
      this.welcomeStats.set(response.stats);

      if (response.message) {
        this.welcomeForm.title = response.message.title;
        this.welcomeForm.content = response.message.content;
      }
    } catch (err: any) {
      if (err.status === 403) {
        this.error.set(this.i18n.t('admin.errorOnlyAdmins'));
        setTimeout(() => this.router.navigate(['/feed']), 2000);
      } else {
        console.error('Error loading welcome message:', err);
      }
    }
  }

  async saveWelcomeMessage(): Promise<void> {
    if (!this.welcomeForm.title || !this.welcomeForm.content) {
      this.error.set(this.i18n.t('admin.welcomeFormTitle') + ' / ' + this.i18n.t('admin.welcomeFormContent') + ' required');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.put('/api/admin/welcome-message', this.welcomeForm, { headers }).toPromise();
      this.success.set(this.i18n.t('admin.successSaved'));
      await this.loadWelcomeMessage();
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorSaving'));
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteWelcomeMessage(): Promise<void> {
    if (!confirm(this.i18n.t('admin.welcomeDeleteConfirm'))) return;

    this.loading.set(true);
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.delete('/api/admin/welcome-message', { headers }).toPromise();
      this.success.set(this.i18n.t('admin.successDeleted'));
      this.welcomeMessage.set(null);
      this.welcomeStats.set(null);
      this.welcomeForm = { title: '', content: '' };
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorDeleting'));
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadBroadcastPosts(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: any = await this.http.get('/api/admin/broadcast-posts', { headers }).toPromise();
      this.broadcastPosts.set(response.posts || []);
    } catch (err) {
      console.error('Error loading broadcast posts:', err);
    }
  }

  async createBroadcastPost(): Promise<void> {
    if (!this.broadcastForm.content.trim()) {
      this.error.set(this.i18n.t('admin.broadcastFormContent') + ' required');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.post('/api/admin/broadcast-post', this.broadcastForm, { headers }).toPromise();
      this.success.set(this.i18n.t('admin.successPostCreated'));
      this.broadcastForm.content = '';
      await this.loadBroadcastPosts();
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorSaving'));
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteBroadcastPost(postId: number): Promise<void> {
    if (!confirm(this.i18n.t('admin.broadcastDeleteConfirm'))) return;

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.delete(`/api/admin/broadcast-post/${postId}`, { headers }).toPromise();
      this.success.set(this.i18n.t('admin.successPostDeleted'));
      await this.loadBroadcastPosts();
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorDeleting'));
      console.error(err);
    }
  }

  async loadSystemStatus(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: SystemStatus = await this.http.get<SystemStatus>('/api/admin/system-status', { headers }).toPromise() as SystemStatus;
      this.systemStatus.set(response);
    } catch (err) {
      console.error('Error loading system status:', err);
      this.error.set(this.i18n.t('admin.errorLoading'));
    }

    this.loadDeepSeekBalance();
  }

  async loadDeepSeekBalance(): Promise<void> {
    try {
      const response = await this.http.get<DeepSeekBalance>('/api/admin/deepseek-balance').toPromise();
      this.deepseekBalance.set(response || null);
      this.deepseekError.set(null);
    } catch (err: any) {
      console.error('Error loading DeepSeek balance:', err);
      this.deepseekError.set(err.error?.detail || this.i18n.t('admin.deepseekError'));
    }
  }

  startAutoRefresh(): void {
    // Lade Status alle 10 Sekunden
    this.autoRefreshInterval = setInterval(() => {
      if (this.activeTab() === 'status') {
        this.loadSystemStatus();
      }
    }, 10000);
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  setActiveTab(tab: 'welcome' | 'broadcast' | 'status' | 'settings' | 'email-templates'): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.success.set(null);

    if (tab === 'status') {
      this.loadSystemStatus();
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }

    if (tab === 'settings' && !this.siteSettingsLoaded) {
      this.loadSiteSettings();
    }
    if (tab === 'email-templates') {
      this.loadEmailTemplates();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  // Helper-Methoden für Template
  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  getRoleLabel(role: string): string {
    const keyMap: Record<string, string> = {
      'user': 'friendsPage.roleUser',
      'moderator': 'friendsPage.roleModerator',
      'admin': 'friendsPage.roleAdmin'
    };
    return keyMap[role] ? this.i18n.t(keyMap[role]) : role;
  }

  // === Email Templates ===

  async loadEmailTemplates(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: any = await this.http.get('/api/admin/email-templates', { headers }).toPromise();
      this.emailTemplates.set(response.templates || {});
      this.notificationTypes.set(response.notification_types || []);
      this.loadTemplateForSelection();
    } catch (err) {
      console.error('Error loading email templates:', err);
    }
  }

  loadTemplateForSelection(): void {
    const templates = this.emailTemplates();
    const typeTemplates = templates[this.selectedNotificationType];
    if (typeTemplates && typeTemplates[this.selectedTemplateLang]) {
      this.templateSubject = typeTemplates[this.selectedTemplateLang].subject || '';
      this.templateBody = typeTemplates[this.selectedTemplateLang].body || '';
    } else {
      this.templateSubject = '';
      this.templateBody = '';
    }
  }

  onTemplateTypeChange(): void {
    this.loadTemplateForSelection();
  }

  onTemplateLangChange(): void {
    this.loadTemplateForSelection();
  }

  async saveEmailTemplate(): Promise<void> {
    if (!this.templateSubject.trim() || !this.templateBody.trim()) {
      this.error.set(this.i18n.t('admin.subjectAndContentRequired'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.put('/api/admin/email-templates', {
        notification_type: this.selectedNotificationType,
        language: this.selectedTemplateLang,
        subject: this.templateSubject,
        body: this.templateBody
      }, { headers }).toPromise();

      this.success.set(this.i18n.t('admin.templateSaved'));
      await this.loadEmailTemplates();
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorSavingTemplate'));
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async translateTemplate(): Promise<void> {
    if (!this.templateSubject.trim() || !this.templateBody.trim()) {
      this.error.set(this.i18n.t('admin.saveTemplateFirst'));
      return;
    }

    this.translating.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: any = await this.http.post('/api/admin/email-templates/translate', {
        notification_type: this.selectedNotificationType,
        language: this.selectedTemplateLang,
        subject: this.templateSubject,
        body: this.templateBody
      }, { headers }).toPromise();

      const translations = response.translations || {};
      const successLangs = Object.keys(translations).filter(l => !translations[l].error);
      const failedLangs = Object.keys(translations).filter(l => translations[l].error);

      let msg = this.i18n.t('admin.templateTranslated').replace('{{count}}', String(successLangs.length));
      if (failedLangs.length > 0) {
        msg += ` (${this.i18n.t('admin.translationFailed').replace('{{count}}', String(failedLangs.length))})`;
      }
      this.success.set(msg);
      await this.loadEmailTemplates();
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorTranslating'));
      console.error(err);
    } finally {
      this.translating.set(false);
    }
  }

  execCommand(command: string, value?: string): void {
    document.execCommand(command, false, value);
  }

  onEditorInput(event: Event): void {
    const target = event.target as HTMLElement;
    this.templateBody = target.innerHTML;
  }

  insertPlaceholder(placeholder: string): void {
    const editor = document.getElementById('template-editor');
    if (editor) {
      editor.focus();
      document.execCommand('insertText', false, placeholder);
      this.templateBody = editor.innerHTML;
    }
  }

  getTemplateLanguages(type: string): string[] {
    const templates = this.emailTemplates();
    return templates[type] ? Object.keys(templates[type]) : [];
  }

  // === Site Settings ===

  async loadSiteSettings(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: any = await this.http.get('/api/admin/site-settings', { headers }).toPromise();
      this.siteSettingsForm.site_url = response.site_url || '';
      if (response?.site_title) {
        this.siteTitle.set(response.site_title);
        this.siteTitleForm = response.site_title;
      }
      this.siteSettingsLoaded = true;
    } catch (err) {
      console.error('Error loading site settings:', err);
      this.error.set(this.i18n.t('admin.errorLoadingSettings'));
    }
  }

  async saveSiteTitle(): Promise<void> {
    if (!this.siteTitleForm.trim()) {
      this.error.set(this.i18n.t('admin.titleEmpty'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.put('/api/admin/site-settings/title', { site_title: this.siteTitleForm.trim() }, { headers }).toPromise();
      this.siteTitle.set(this.siteTitleForm.trim());
      this.success.set(this.i18n.t('admin.titleSaved'));
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorSavingTitle'));
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async saveSiteSettings(): Promise<void> {
    if (!this.siteSettingsForm.site_url.trim()) {
      this.error.set(this.i18n.t('admin.siteUrlRequired'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: any = await this.http.put('/api/admin/site-settings', this.siteSettingsForm, { headers }).toPromise();
      this.siteSettingsForm.site_url = response.site_url;
      this.success.set(this.i18n.t('admin.settingsSaved'));
    } catch (err) {
      this.error.set(this.i18n.t('admin.errorSavingSettings'));
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
