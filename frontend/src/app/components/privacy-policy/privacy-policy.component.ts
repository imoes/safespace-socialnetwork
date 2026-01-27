import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="legal-container">
      <div class="legal-content">
        <h1>📜 Datenschutzerklärung</h1>
        <p class="update-date">Stand: Januar 2026</p>

        <section>
          <h2>1. Verantwortlicher</h2>
          <p>
            Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br><br>
            <strong>[Ihr Name/Firmenname]</strong><br>
            [Adresse]<br>
            E-Mail: [E-Mail]<br>
            Telefon: [Telefon]
          </p>
        </section>

        <section>
          <h2>2. Welche Daten werden verarbeitet?</h2>

          <h3>2.1 Registrierung</h3>
          <ul>
            <li>Benutzername (erforderlich)</li>
            <li>E-Mail-Adresse (erforderlich)</li>
            <li>Passwort (verschlüsselt mit Bcrypt)</li>
            <li>Vor- und Nachname (optional)</li>
          </ul>

          <h3>2.2 Nutzung der Plattform</h3>
          <ul>
            <li>Profil-Informationen (Bio, Profilbild)</li>
            <li>Posts, Kommentare und Medien</li>
            <li>Likes und Interaktionen</li>
            <li>Freundesliste und -anfragen</li>
            <li>Benachrichtigungen</li>
          </ul>

          <h3>2.3 Technische Daten</h3>
          <ul>
            <li>IP-Adresse (für Sicherheit und Anti-Spam)</li>
            <li>Browser-Informationen</li>
            <li>Login-Zeitpunkte</li>
          </ul>
        </section>

        <section>
          <h2>3. Rechtsgrundlage der Verarbeitung</h2>
          <ul>
            <li><strong>Art. 6 Abs. 1 lit. b DSGVO</strong>: Vertragserfüllung (Bereitstellung der Plattform)</li>
            <li><strong>Art. 6 Abs. 1 lit. a DSGVO</strong>: Einwilligung (E-Mail-Benachrichtigungen)</li>
            <li><strong>Art. 6 Abs. 1 lit. f DSGVO</strong>: Berechtigtes Interesse (Sicherheit, Spam-Schutz, Content-Moderation)</li>
          </ul>
        </section>

        <section>
          <h2>4. Weitergabe von Daten</h2>
          <p>
            Ihre personenbezogenen Daten werden <strong>NICHT</strong> an Dritte weitergegeben, mit folgenden Ausnahmen:
          </p>
          <ul>
            <li><strong>DeepSeek API</strong> (Content-Moderation): Nur Textinhalt von Posts/Kommentaren wird zur Hassrede-Erkennung übertragen. KEINE persönlichen Daten wie Name oder E-Mail.</li>
            <li><strong>E-Mail-Versand</strong> (falls aktiviert): Ihre E-Mail-Adresse wird nur für den Versand von Benachrichtigungen verwendet.</li>
            <li><strong>Gesetzliche Verpflichtungen</strong>: Bei behördlichen Anordnungen oder zur Rechtsverfolgung.</li>
          </ul>
        </section>

        <section>
          <h2>5. Speicherdauer</h2>
          <ul>
            <li><strong>Account-Daten</strong>: Bis zur Löschung durch den Nutzer</li>
            <li><strong>Posts und Kommentare</strong>: Bis zur Löschung durch den Nutzer</li>
            <li><strong>Logs</strong>: 90 Tage</li>
            <li><strong>Benachrichtigungen</strong>: Bis zur Löschung durch den Nutzer</li>
          </ul>
        </section>

        <section>
          <h2>6. Ihre Rechte nach DSGVO</h2>
          <p>Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
          <ul>
            <li><strong>Auskunft</strong> (Art. 15 DSGVO): Recht auf Auskunft über Ihre gespeicherten Daten</li>
            <li><strong>Berichtigung</strong> (Art. 16 DSGVO): Recht auf Korrektur unrichtiger Daten</li>
            <li><strong>Löschung</strong> (Art. 17 DSGVO): Recht auf Vergessenwerden - Sie können Ihren Account jederzeit in den Einstellungen vollständig löschen</li>
            <li><strong>Einschränkung</strong> (Art. 18 DSGVO): Recht auf Einschränkung der Verarbeitung</li>
            <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): Recht auf Export Ihrer Daten im JSON-Format</li>
            <li><strong>Widerspruch</strong> (Art. 21 DSGVO): Widerspruchsrecht gegen die Verarbeitung</li>
            <li><strong>Widerruf der Einwilligung</strong> (Art. 7 DSGVO): E-Mail-Benachrichtigungen können jederzeit deaktiviert werden</li>
          </ul>
          <p>Zur Ausübung Ihrer Rechte kontaktieren Sie uns bitte unter: <strong>[E-Mail]</strong></p>
        </section>

        <section>
          <h2>7. Beschwerderecht</h2>
          <p>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten durch uns zu beschweren.
          </p>
          <p>
            Zuständige Behörde in Deutschland:<br>
            <a href="https://www.bfdi.bund.de/" target="_blank" rel="noopener">Der Bundesbeauftragte für den Datenschutz und die Informationsfreiheit</a>
          </p>
        </section>

        <section>
          <h2>8. KI-Moderation</h2>
          <p>
            Wir nutzen <strong>DeepSeek AI</strong> zur automatischen Moderation von Inhalten (Hassrede-Erkennung).
            Dabei werden ausschließlich Textinhalte (Posts und Kommentare) übertragen.
          </p>
          <p>
            <strong>KEINE</strong> persönlichen Daten wie Name, E-Mail-Adresse oder Profilbilder werden an DeepSeek übermittelt.
          </p>
          <p>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Sicherheit der Plattform).
          </p>
        </section>

        <section>
          <h2>9. Cookies und Tracking</h2>
          <p>
            Diese Website verwendet ausschließlich <strong>essenzielle Cookies</strong> für die Authentifizierung (Login-Session).
          </p>
          <p>
            Wir verwenden <strong>KEINE</strong> Tracking-Cookies, Analytics oder Werbe-Cookies.
          </p>
          <ul>
            <li><strong>auth_token</strong>: JWT-Token für Login-Session (24 Stunden Gültigkeit)</li>
          </ul>
        </section>

        <section>
          <h2>10. Datensicherheit</h2>
          <p>
            Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen Manipulation, Verlust, Zerstörung oder Zugriff unberechtigter Personen zu schützen:
          </p>
          <ul>
            <li>Passwörter werden mit <strong>Bcrypt</strong> gehasht und gesalzen</li>
            <li>Verschlüsselte Datenübertragung via <strong>HTTPS</strong></li>
            <li>JWT-Token-basierte Authentifizierung</li>
            <li>SQL-Injection-Schutz durch Prepared Statements</li>
            <li>Input-Validierung und Sanitization</li>
            <li>Regelmäßige Sicherheitsupdates</li>
          </ul>
        </section>

        <section>
          <h2>11. Änderungen der Datenschutzerklärung</h2>
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte Rechtslagen oder Änderungen unseres Dienstes anzupassen.
          </p>
          <p>
            Die aktuelle Version ist stets unter <a routerLink="/privacy-policy">dieser Seite</a> abrufbar.
          </p>
        </section>

        <section>
          <h2>12. Kontakt</h2>
          <p>
            Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte kontaktieren Sie uns bitte unter:
          </p>
          <p>
            E-Mail: <strong>[E-Mail]</strong><br>
            Post: <strong>[Adresse]</strong>
          </p>
        </section>

        <div class="disclaimer">
          <p>
            <strong>Hinweis:</strong> Diese Datenschutzerklärung ist eine Vorlage und muss vor produktivem Einsatz an Ihre spezifischen Gegebenheiten angepasst werden.
            Wir empfehlen dringend, einen Fachanwalt für IT-Recht oder einen Datenschutzbeauftragten zu konsultieren.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .legal-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .legal-content {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    h1 {
      color: #1877f2;
      margin-bottom: 8px;
      font-size: 32px;
    }

    .update-date {
      color: #65676b;
      font-size: 14px;
      margin-bottom: 32px;
    }

    section {
      margin-bottom: 32px;
    }

    h2 {
      color: #1c1e21;
      font-size: 24px;
      margin-bottom: 16px;
      margin-top: 32px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f0f2f5;
    }

    h3 {
      color: #1c1e21;
      font-size: 18px;
      margin-bottom: 12px;
      margin-top: 20px;
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

    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 16px;
      margin-top: 32px;
    }

    .disclaimer p {
      margin: 0;
      color: #856404;
      font-size: 14px;
    }

    @media (max-width: 1024px) {
      .legal-content {
        padding: 24px 16px;
      }

      h1 {
        font-size: 24px;
      }

      h2 {
        font-size: 20px;
      }

      h3 {
        font-size: 16px;
      }
    }
  `]
})
export class PrivacyPolicyComponent {}
