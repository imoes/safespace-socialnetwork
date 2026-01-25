import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info-container">
      <div class="info-content">
        <div class="header-section">
          <h1>ℹ️ Über SocialNet</h1>
          <p class="tagline">Ein sicheres und datenschutzfreundliches soziales Netzwerk</p>
        </div>

        <section class="opensource-section">
          <div class="opensource-badge">
            <span class="badge-icon">🌟</span>
            <span class="badge-text">Open Source</span>
          </div>
          <h2>Open Source Software</h2>
          <p>
            SocialNet ist ein <strong>Open Source Projekt</strong> und steht der Community frei zur Verfügung.
            Der gesamte Quellcode ist öffentlich einsehbar, kann überprüft und verbessert werden.
          </p>
          <p>
            Das Projekt ist unter der <strong>GNU Affero General Public License v3.0 (AGPL-3.0)</strong> lizenziert.
          </p>
          <div class="license-info">
            <h3>Was bedeutet AGPL-3.0?</h3>
            <ul>
              <li>✅ Freie Nutzung, Änderung und Weitergabe</li>
              <li>✅ Zugriff auf den vollständigen Quellcode</li>
              <li>✅ Transparenz und Nachvollziehbarkeit</li>
              <li>✅ Community-getriebene Entwicklung</li>
              <li>⚠️ Änderungen müssen ebenfalls unter AGPL-3.0 veröffentlicht werden</li>
              <li>⚠️ Auch bei Nutzung über Netzwerk muss der Code verfügbar sein</li>
            </ul>
          </div>
        </section>

        <section class="github-section">
          <h2>📦 GitHub Repository</h2>
          <p>
            Der komplette Quellcode ist auf GitHub verfügbar:
          </p>
          <a href="https://github.com/imoes/safespace-socialnetwork" target="_blank" rel="noopener" class="github-link">
            <span class="github-icon">
              <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
            </span>
            <span>github.com/imoes/safespace-socialnetwork</span>
          </a>
        </section>

        <section class="contribute-section">
          <h2>🐛 Mitmachen & Feedback</h2>
          <p>
            Wir freuen uns über <strong>Feedback, Verbesserungsvorschläge und Bug-Reports</strong>!
            Ihre Beiträge helfen dabei, SocialNet kontinuierlich zu verbessern.
          </p>

          <div class="feedback-box">
            <h3>Wie kann ich beitragen?</h3>
            <ul>
              <li>🐛 <strong>Bugs melden</strong> - Fehler gefunden? Melden Sie diese über GitHub Issues</li>
              <li>💡 <strong>Features vorschlagen</strong> - Haben Sie eine Idee für neue Funktionen?</li>
              <li>📝 <strong>Verbesserungsvorschläge</strong> - Teilen Sie Ihre Anregungen mit uns</li>
              <li>🔧 <strong>Code beitragen</strong> - Pull Requests sind willkommen!</li>
              <li>📖 <strong>Dokumentation verbessern</strong> - Helfen Sie anderen mit besseren Anleitungen</li>
            </ul>
          </div>

          <a href="https://github.com/imoes/safespace-socialnetwork/issues" target="_blank" rel="noopener" class="issues-link">
            <span class="issues-icon">📋</span>
            <div class="issues-content">
              <strong>GitHub Issues</strong>
              <span>Bug melden oder Feature vorschlagen</span>
            </div>
            <span class="arrow">→</span>
          </a>
        </section>

        <section class="tech-section">
          <h2>🛠️ Technologie-Stack</h2>
          <div class="tech-grid">
            <div class="tech-item">
              <span class="tech-icon">⚡</span>
              <div>
                <strong>Frontend</strong>
                <p>Angular 18 + TypeScript</p>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">🚀</span>
              <div>
                <strong>Backend</strong>
                <p>FastAPI (Python)</p>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">💾</span>
              <div>
                <strong>Datenbank</strong>
                <p>PostgreSQL + SQLite</p>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">🔍</span>
              <div>
                <strong>Suche</strong>
                <p>OpenSearch</p>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">🛡️</span>
              <div>
                <strong>Moderation</strong>
                <p>DeepSeek AI</p>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">📦</span>
              <div>
                <strong>Deployment</strong>
                <p>Docker Compose</p>
              </div>
            </div>
          </div>
        </section>

        <section class="features-section">
          <h2>✨ Features</h2>
          <div class="features-grid">
            <div class="feature">
              <span>🔒</span>
              <strong>Datenschutz</strong>
              <p>DSGVO-konform, kein Tracking</p>
            </div>
            <div class="feature">
              <span>🛡️</span>
              <strong>Content-Moderation</strong>
              <p>KI-gestützte Hassrede-Erkennung</p>
            </div>
            <div class="feature">
              <span>👥</span>
              <strong>Freunde & Tiers</strong>
              <p>Flexible Freundschaftsebenen</p>
            </div>
            <div class="feature">
              <span>🔔</span>
              <strong>Benachrichtigungen</strong>
              <p>In-App & E-Mail (optional)</p>
            </div>
            <div class="feature">
              <span>🎬</span>
              <strong>Video-Editor</strong>
              <p>Browser-basierte Videobearbeitung</p>
            </div>
            <div class="feature">
              <span>🔍</span>
              <strong>Volltextsuche</strong>
              <p>Schnelle Suche mit OpenSearch</p>
            </div>
          </div>
        </section>

        <section class="privacy-section">
          <h2>🔐 Datenschutz & Sicherheit</h2>
          <p>
            Wir nehmen Ihre Privatsphäre ernst:
          </p>
          <ul>
            <li>✅ <strong>Keine Werbung</strong> - Wir zeigen keine Werbung und verkaufen keine Daten</li>
            <li>✅ <strong>Kein Tracking</strong> - Keine Analytics, keine Cookies außer für Login</li>
            <li>✅ <strong>DSGVO-konform</strong> - Vollständige Einhaltung europäischer Datenschutzgesetze</li>
            <li>✅ <strong>Recht auf Löschung</strong> - Jederzeit vollständige Account-Löschung</li>
            <li>✅ <strong>Verschlüsselte Passwörter</strong> - Bcrypt-Hashing mit Salt</li>
            <li>✅ <strong>Open Source</strong> - Transparenter Code zur Überprüfung</li>
          </ul>
          <p>
            Mehr Details in unserer <a routerLink="/privacy-policy">Datenschutzerklärung</a>.
          </p>
        </section>

        <section class="version-section">
          <p class="version">Version 1.0.0 • Januar 2026</p>
          <p class="copyright">Lizenziert unter AGPL-3.0 • Open Source</p>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .info-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .info-content {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .header-section {
      text-align: center;
      margin-bottom: 48px;
    }

    h1 {
      color: #1877f2;
      margin-bottom: 8px;
      font-size: 36px;
    }

    .tagline {
      color: #65676b;
      font-size: 16px;
    }

    section {
      margin-bottom: 40px;
    }

    h2 {
      color: #1c1e21;
      font-size: 24px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f0f2f5;
    }

    h3 {
      color: #1c1e21;
      font-size: 18px;
      margin-bottom: 12px;
    }

    p {
      color: #1c1e21;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    ul {
      color: #1c1e21;
      line-height: 1.8;
      margin-left: 24px;
      margin-bottom: 16px;
    }

    li {
      margin-bottom: 8px;
    }

    .opensource-section {
      background: linear-gradient(135deg, #e7f3ff 0%, #f0f9ff 100%);
      padding: 24px;
      border-radius: 12px;
      border: 2px solid #1877f2;
    }

    .opensource-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #1877f2;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .badge-icon {
      font-size: 20px;
    }

    .license-info {
      background: white;
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
    }

    .github-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: #24292e;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      transition: background 0.2s;
      margin-top: 16px;
    }

    .github-link:hover {
      background: #1a1e22;
    }

    .github-icon {
      display: flex;
      align-items: center;
    }

    .feedback-box {
      background: #f0f9ff;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #1877f2;
      margin: 20px 0;
    }

    .issues-link {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      text-decoration: none;
      color: #1c1e21;
      transition: all 0.2s;
      margin-top: 20px;
    }

    .issues-link:hover {
      background: #ffe69c;
      transform: translateX(4px);
    }

    .issues-icon {
      font-size: 32px;
    }

    .issues-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .issues-content strong {
      font-size: 16px;
      color: #1c1e21;
    }

    .issues-content span {
      font-size: 14px;
      color: #65676b;
    }

    .arrow {
      font-size: 24px;
      color: #ffc107;
    }

    .tech-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }

    .tech-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #f0f2f5;
      border-radius: 8px;
    }

    .tech-icon {
      font-size: 32px;
    }

    .tech-item strong {
      display: block;
      margin-bottom: 4px;
      color: #1c1e21;
    }

    .tech-item p {
      margin: 0;
      font-size: 14px;
      color: #65676b;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }

    .feature {
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
      text-align: center;
    }

    .feature span {
      font-size: 32px;
      display: block;
      margin-bottom: 8px;
    }

    .feature strong {
      display: block;
      margin-bottom: 8px;
      color: #1c1e21;
    }

    .feature p {
      margin: 0;
      font-size: 13px;
      color: #65676b;
    }

    .version-section {
      text-align: center;
      padding-top: 32px;
      border-top: 2px solid #f0f2f5;
    }

    .version,
    .copyright {
      color: #65676b;
      font-size: 14px;
      margin: 4px 0;
    }

    a {
      color: #1877f2;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    strong {
      font-weight: 600;
      color: #1c1e21;
    }

    @media (max-width: 768px) {
      .info-content {
        padding: 24px 16px;
      }

      h1 {
        font-size: 28px;
      }

      h2 {
        font-size: 20px;
      }

      .tech-grid,
      .features-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class InfoComponent {}
