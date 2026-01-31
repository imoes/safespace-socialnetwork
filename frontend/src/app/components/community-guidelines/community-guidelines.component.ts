import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-community-guidelines',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-container">
      <div class="legal-content">
        <h1>Community-Richtlinien</h1>
        <p class="update-date">Stand: Januar 2026</p>

        <section>
          <h2>1. Unsere Vision</h2>
          <p>
            SafeSpace ist ein soziales Netzwerk, das auf Respekt, Sicherheit und positivem Austausch basiert.
            Diese Community-Richtlinien definieren, wie wir miteinander umgehen und was auf unserer Plattform
            erlaubt und nicht erlaubt ist.
          </p>
          <p>
            Jeder Nutzer trägt Verantwortung für ein respektvolles Miteinander.
            Verstöße gegen diese Richtlinien können zur Verwarnung, Sperrung oder Löschung des Accounts führen.
          </p>
        </section>

        <section>
          <h2>2. Respektvoller Umgang</h2>
          <ul>
            <li>Behandle andere so, wie du selbst behandelt werden möchtest.</li>
            <li>Respektiere unterschiedliche Meinungen, Kulturen und Lebensweisen.</li>
            <li>Konstruktive Kritik ist willkommen – persönliche Angriffe sind es nicht.</li>
            <li>Verwende eine angemessene Sprache und einen respektvollen Ton.</li>
          </ul>
        </section>

        <section>
          <h2>3. Verbotene Inhalte</h2>
          <p>Folgende Inhalte sind auf SafeSpace strikt untersagt:</p>

          <h3>3.1 Hassrede und Diskriminierung</h3>
          <ul>
            <li>Rassistische, sexistische, homophobe oder transphobe Äußerungen</li>
            <li>Religiöse Hetze oder Fremdenfeindlichkeit</li>
            <li>Diskriminierung aufgrund von Behinderung, Alter, Herkunft oder sozialem Status</li>
            <li>Verherrlichung von Gewalt oder Extremismus</li>
          </ul>

          <h3>3.2 Belästigung und Mobbing</h3>
          <ul>
            <li>Stalking oder wiederholtes unerwünschtes Kontaktieren</li>
            <li>Cybermobbing, Einschüchterung oder Drohungen</li>
            <li>Veröffentlichung privater Informationen anderer (Doxxing)</li>
            <li>Absichtliches Provozieren oder Trollen</li>
          </ul>

          <h3>3.3 Illegale und schädliche Inhalte</h3>
          <ul>
            <li>Darstellung oder Verbreitung von Kindesmissbrauch (wird umgehend an die Behörden gemeldet)</li>
            <li>Aufruf zu Straftaten oder Gewalt</li>
            <li>Verbreitung von urheberrechtlich geschütztem Material ohne Berechtigung</li>
            <li>Inhalte, die gegen geltendes deutsches Recht verstoßen</li>
          </ul>

          <h3>3.4 Spam und Manipulation</h3>
          <ul>
            <li>Unerwünschte Werbung oder kommerzielle Inhalte</li>
            <li>Kettenbriefe oder Massenversand von Nachrichten</li>
            <li>Erstellen von Fake-Accounts oder Bot-Nutzung</li>
            <li>Absichtliche Verbreitung von Falschinformationen (Desinformation)</li>
          </ul>
        </section>

        <section>
          <h2>4. Jugendschutz</h2>
          <p>
            Der Schutz von Minderjährigen hat auf SafeSpace höchste Priorität.
          </p>
          <ul>
            <li><strong>Mindestalter:</strong> Die Nutzung ist erst ab 13 Jahren erlaubt.</li>
            <li><strong>Elterliche Einwilligung:</strong> Nutzer zwischen 13 und 15 Jahren benötigen die
                Einwilligung eines Erziehungsberechtigten (gemäß Art. 8 DSGVO).</li>
            <li><strong>Altersgerechte Inhalte:</strong> Inhalte, die für Minderjährige ungeeignet sind
                (z.B. explizite Gewalt, sexuelle Inhalte), sind grundsätzlich nicht erlaubt.</li>
            <li><strong>Schutz vor Kontaktaufnahme:</strong> Belästigung oder unangemessene Kontaktaufnahme
                gegenüber Minderjährigen wird mit sofortiger Account-Sperrung geahndet.</li>
            <li><strong>Grooming-Prävention:</strong> Jeder Verdacht auf Grooming (Anbahnung sexueller
                Kontakte mit Minderjährigen) wird umgehend den zuständigen Behörden gemeldet.</li>
          </ul>
        </section>

        <section>
          <h2>5. Privatsphäre und Datenschutz</h2>
          <ul>
            <li>Veröffentliche keine persönlichen Daten anderer Nutzer (Adresse, Telefonnummer, etc.).</li>
            <li>Teile keine Screenshots von privaten Nachrichten ohne Zustimmung.</li>
            <li>Respektiere die Sichtbarkeitseinstellungen anderer Nutzer.</li>
            <li>Nutze die Plattform nicht, um persönliche Daten Dritter zu sammeln.</li>
          </ul>
          <p>
            Details zum Datenschutz findest du in unserer <a routerLink="/privacy-policy">Datenschutzerklärung</a>.
          </p>
        </section>

        <section>
          <h2>6. KI-gestützte Moderation</h2>
          <p>
            SafeSpace setzt ein KI-basiertes Moderationssystem (Guardian) ein, um Hassrede und
            schädliche Inhalte automatisch zu erkennen. Dabei gilt:
          </p>
          <ul>
            <li>Die KI-Moderation unterstützt die menschliche Moderation, ersetzt sie aber nicht.</li>
            <li>Bei automatischer Erkennung von Hassrede wird der Beitrag zur manuellen Prüfung markiert.</li>
            <li>Nutzer können gegen Moderationsentscheidungen Widerspruch einlegen.</li>
            <li>Widersprüche werden von menschlichen Moderatoren geprüft.</li>
          </ul>
        </section>

        <section>
          <h2>7. Melden von Verstößen</h2>
          <p>
            Wenn du einen Verstoß gegen diese Richtlinien bemerkst:
          </p>
          <ul>
            <li>Nutze die Melde-Funktion direkt am jeweiligen Beitrag oder Kommentar.</li>
            <li>Beschreibe den Verstoß so genau wie möglich.</li>
            <li>Missbrauche die Melde-Funktion nicht – falsche Meldungen können selbst zu Konsequenzen führen.</li>
          </ul>
        </section>

        <section>
          <h2>8. Konsequenzen bei Verstößen</h2>
          <p>Je nach Schwere des Verstoßes können folgende Maßnahmen ergriffen werden:</p>
          <ul>
            <li><strong>Stufe 1 – Verwarnung:</strong> Bei erstmaligen oder leichten Verstößen erfolgt eine Verwarnung.</li>
            <li><strong>Stufe 2 – Inhaltslöschung:</strong> Der betreffende Beitrag oder Kommentar wird entfernt.</li>
            <li><strong>Stufe 3 – Temporäre Sperre:</strong> Der Account wird vorübergehend gesperrt.</li>
            <li><strong>Stufe 4 – Permanente Sperre:</strong> Bei schweren oder wiederholten Verstößen wird der Account dauerhaft gesperrt.</li>
          </ul>
          <p>
            Bei strafrechtlich relevanten Inhalten (insbesondere Kindesmissbrauch, Terrorismus, Volksverhetzung)
            erfolgt eine unverzügliche Meldung an die zuständigen Behörden.
          </p>
        </section>

        <section>
          <h2>9. Änderungen der Richtlinien</h2>
          <p>
            Diese Community-Richtlinien können vom Betreiber aktualisiert werden.
            Wesentliche Änderungen werden über einen Broadcast-Post auf der Plattform bekanntgegeben.
          </p>
        </section>

        <section>
          <h2>10. Kontakt</h2>
          <p>
            Bei Fragen zu diesen Richtlinien oder zum Melden von Verstößen wende dich bitte an:
          </p>
          <p>
            <strong>Thomas Kluge</strong><br>
            E-Mail: support&#64;thesafespace.blog
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
export class CommunityGuidelinesComponent {}
