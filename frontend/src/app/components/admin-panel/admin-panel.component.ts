import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

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

  // Tabs
  activeTab = signal<'welcome' | 'broadcast' | 'status'>('welcome');

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

  // UI States
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  ngOnInit(): void {
    this.checkAdminAccess();
    this.loadWelcomeMessage();
    this.loadBroadcastPosts();
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
        this.error.set('Nur Admins haben Zugriff auf diese Seite');
        setTimeout(() => this.router.navigate(['/feed']), 2000);
      } else {
        console.error('Error loading welcome message:', err);
      }
    }
  }

  async saveWelcomeMessage(): Promise<void> {
    if (!this.welcomeForm.title || !this.welcomeForm.content) {
      this.error.set('Titel und Inhalt sind erforderlich');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.put('/api/admin/welcome-message', this.welcomeForm, { headers }).toPromise();
      this.success.set('Willkommensnachricht gespeichert!');
      await this.loadWelcomeMessage();
    } catch (err) {
      this.error.set('Fehler beim Speichern');
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteWelcomeMessage(): Promise<void> {
    if (!confirm('Willkommensnachricht wirklich löschen?')) return;

    this.loading.set(true);
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.delete('/api/admin/welcome-message', { headers }).toPromise();
      this.success.set('Willkommensnachricht gelöscht');
      this.welcomeMessage.set(null);
      this.welcomeStats.set(null);
      this.welcomeForm = { title: '', content: '' };
    } catch (err) {
      this.error.set('Fehler beim Löschen');
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
      this.error.set('Post-Inhalt ist erforderlich');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.post('/api/admin/broadcast-post', this.broadcastForm, { headers }).toPromise();
      this.success.set('Broadcast-Post erstellt! Alle Benutzer sehen ihn jetzt.');
      this.broadcastForm.content = '';
      await this.loadBroadcastPosts();
    } catch (err) {
      this.error.set('Fehler beim Erstellen des Posts');
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteBroadcastPost(postId: number): Promise<void> {
    if (!confirm('Broadcast-Post wirklich löschen?')) return;

    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      await this.http.delete(`/api/admin/broadcast-post/${postId}`, { headers }).toPromise();
      this.success.set('Broadcast-Post gelöscht');
      await this.loadBroadcastPosts();
    } catch (err) {
      this.error.set('Fehler beim Löschen');
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
      this.error.set('Fehler beim Laden des System-Status');
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

  setActiveTab(tab: 'welcome' | 'broadcast' | 'status'): void {
    this.activeTab.set(tab);
    this.error.set(null);
    this.success.set(null);

    // Lade System-Status wenn Tab aktiviert wird
    if (tab === 'status') {
      this.loadSystemStatus();
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
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
    const labels: { [key: string]: string } = {
      'user': 'Benutzer',
      'moderator': 'Moderatoren',
      'admin': 'Admins'
    };
    return labels[role] || role;
  }
}
