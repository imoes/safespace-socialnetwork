import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { EmojiService } from '../services/emoji.service';

@Directive({
  selector: '[autoEmoji]',
  standalone: true
})
export class AutoEmojiDirective {
  private el = inject(ElementRef);
  private emojiService = inject(EmojiService);
  private ngControl = inject(NgControl, { optional: true });

  @HostListener('input', ['$event'])
  onInput(event: InputEvent): void {
    const element = this.el.nativeElement as HTMLInputElement | HTMLTextAreaElement;
    const cursorPosition = element.selectionStart || 0;
    const text = element.value;

    // Check if an emoticon just completed at cursor position
    const match = this.emojiService.checkForEmoticonAtCursor(text, cursorPosition);

    if (match) {
      // Replace the emoticon with emoji
      const newText = text.substring(0, match.start) + match.emoji + text.substring(match.end);
      const newCursorPosition = match.start + match.emoji.length;

      // Update the value
      element.value = newText;

      // Update ngModel if present
      if (this.ngControl && this.ngControl.control) {
        this.ngControl.control.setValue(newText, { emitEvent: true });
      }

      // Restore cursor position
      element.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  }
}
