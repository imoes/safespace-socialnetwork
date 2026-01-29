import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-container">
      <div class="legal-content">
        <h1>Nutzungsbedingungen (AGB)</h1>
        <p class="update-date">Stand: Januar 2026</p>

        <section>
          <h2>1. Geltungsbereich</h2>
          <p>
            Diese Nutzungsbedingungen regeln die Nutzung der Plattform SafeSpace (nachfolgend "Plattform"),
            betrieben von Thomas Kluge, Ringstrasse 26, 82110 Germering (nachfolgend "Betreiber").
          </p>
          <p>
            Mit der Registrierung akzeptiert der Nutzer diese Nutzungsbedingungen.
            Die Plattform wird als privates, nicht-kommerzielles Projekt betrieben.
          </p>
        </section>

        <section>
          <h2>2. Registrierung und Benutzerkonto</h2>
          <ul>
            <li>Zur Nutzung der Plattform ist eine Registrierung mit gültigem Benutzernamen, E-Mail-Adresse und Passwort erforderlich.</li>
            <li>Jeder Nutzer darf nur ein Konto besitzen.</li>
            <li>Der Nutzer ist für die Sicherheit seines Passworts selbst verantwortlich.</li>
            <li>Falsche oder irreführende Angaben bei der Registrierung sind unzulässig.</li>
            <li>Der Betreiber behält sich das Recht vor, Konten bei Verstoß gegen diese Bedingungen zu sperren oder zu löschen.</li>
          </ul>
        </section>

        <section>
          <h2>3. Nutzungsregeln und Verhaltenskodex</h2>
          <p>SafeSpace ist ein sicherer Raum für respektvollen Austausch. Folgende Inhalte und Verhaltensweisen sind untersagt:</p>
          <ul>
            <li><strong>Hassrede:</strong> Rassismus, Sexismus, Homophobie, religiöse Hetze, Fremdenfeindlichkeit und jede Form von Diskriminierung.</li>
            <li><strong>Belästigung:</strong> Stalking, Mobbing, Drohungen oder Einschüchterung anderer Nutzer.</li>
            <li><strong>Illegale Inhalte:</strong> Verbreitung von illegalen Inhalten, einschließlich urheberrechtlich geschütztem Material ohne Berechtigung.</li>
            <li><strong>Spam:</strong> Unerwünschte Werbung, Kettenbriefe oder wiederholtes Posten identischer Inhalte.</li>
            <li><strong>Falschinformationen:</strong> Absichtliche Verbreitung von nachweislich falschen Informationen.</li>
            <li><strong>Manipulation:</strong> Missbrauch der Plattform-Funktionen, Erstellen von Fake-Accounts oder automatisierte Bot-Nutzung.</li>
          </ul>
          <p>
            Die Plattform verwendet KI-gestützte Moderation (Guardian-System) zur automatischen Erkennung von Hassrede.
            Nutzer haben die Möglichkeit, gegen Moderationsentscheidungen Widerspruch einzulegen.
          </p>
        </section>

        <section>
          <h2>4. Inhalte der Nutzer</h2>
          <ul>
            <li>Der Nutzer behält die Rechte an seinen erstellten Inhalten (Posts, Kommentare, Bilder).</li>
            <li>Mit dem Hochladen räumt der Nutzer dem Betreiber ein einfaches, nicht-exklusives Nutzungsrecht ein,
                die Inhalte im Rahmen der Plattform darzustellen und technisch zu verarbeiten.</li>
            <li>Der Nutzer stellt sicher, dass er die notwendigen Rechte an allen hochgeladenen Inhalten besitzt.</li>
            <li>Der Nutzer kann seine Inhalte jederzeit selbst löschen.</li>
          </ul>
        </section>

        <section>
          <h2>5. Datenschutz</h2>
          <p>
            Der Schutz personenbezogener Daten ist dem Betreiber besonders wichtig.
            Einzelheiten zur Datenverarbeitung entnehmen Sie bitte unserer
            <a routerLink="/privacy-policy">Datenschutzerklärung</a>.
          </p>
          <p>
            Zusammenfassung der wichtigsten Punkte:
          </p>
          <ul>
            <li>Keine Weitergabe personenbezogener Daten an Dritte (außer für KI-Moderation und gesetzliche Pflichten)</li>
            <li>Keine Tracking- oder Analyse-Cookies</li>
            <li>Recht auf vollständige Datenlöschung und Datenexport</li>
            <li>Passwörter werden verschlüsselt gespeichert (Bcrypt)</li>
          </ul>
        </section>

        <section>
          <h2>6. Haftung</h2>
          <ul>
            <li>Die Plattform wird als privates, nicht-kommerzielles Projekt "wie besehen" (as-is) betrieben.</li>
            <li>Der Betreiber übernimmt keine Garantie für die ständige Verfügbarkeit der Plattform.</li>
            <li>Für Inhalte anderer Nutzer übernimmt der Betreiber keine Haftung.</li>
            <li>Die Haftung des Betreibers ist auf Vorsatz und grobe Fahrlässigkeit beschränkt, soweit gesetzlich zulässig.</li>
          </ul>
        </section>

        <section>
          <h2>7. Kontolöschung</h2>
          <ul>
            <li>Der Nutzer kann sein Konto jederzeit in den Einstellungen vollständig löschen.</li>
            <li>Bei der Löschung werden alle personenbezogenen Daten, Posts, Kommentare, Medien und Freundschaften unwiderruflich entfernt.</li>
            <li>Der Betreiber kann Konten bei schweren oder wiederholten Verstößen gegen die Nutzungsbedingungen sperren oder löschen.</li>
          </ul>
        </section>

        <section>
          <h2>8. Änderungen der Nutzungsbedingungen</h2>
          <p>
            Der Betreiber behält sich vor, diese Nutzungsbedingungen zu ändern.
            Registrierte Nutzer werden über wesentliche Änderungen per Broadcast-Post auf der Plattform informiert.
            Die fortgesetzte Nutzung der Plattform nach Änderung der Nutzungsbedingungen gilt als Zustimmung zu den neuen Bedingungen.
          </p>
        </section>

        <section>
          <h2>9. Anwendbares Recht und Gerichtsstand</h2>
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
          </p>
        </section>

        <section>
          <h2>10. Kontakt</h2>
          <p>
            Bei Fragen zu diesen Nutzungsbedingungen wenden Sie sich bitte an:
          </p>
          <p>
            <strong>Thomas Kluge</strong><br>
            E-Mail: thomas&#64;kluge-online.de
          </p>
        </section>
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
    }
  `]
})
export class TermsOfServiceComponent {}
