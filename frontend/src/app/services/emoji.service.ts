import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EmojiService {
  // ASCII emoticon to emoji mappings
  private readonly emojiMap: { [key: string]: string } = {
    // Happy faces
    ':-)': '😊',
    ':)': '😊',
    ':-D': '😃',
    ':D': '😃',
    '=)': '😊',
    '=D': '😃',

    // Winking faces
    ';-)': '😉',
    ';)': '😉',

    // Sad faces
    ':-(': '😞',
    ':(': '😞',
    '=(': '😞',
    ":'(": '😢',

    // Surprised faces
    ':-O': '😮',
    ':O': '😮',
    ':-o': '😮',
    ':o': '😮',

    // Tongue out
    ':-P': '😛',
    ':P': '😛',
    ':-p': '😛',
    ':p': '😛',
    ';-P': '😜',
    ';P': '😜',

    // Cool/sunglasses
    '8-)': '😎',
    'B-)': '😎',

    // Love/hearts
    '<3': '❤️',
    ':-*': '😘',
    ':*': '😘',

    // Angry
    '>:(': '😠',
    '>:-(': '😠',

    // Neutral/unsure
    ':-|': '😐',
    ':|': '😐',
    ':-/': '😕',
    ':/': '😕',
    ':-\\': '😕',
    ':\\': '😕',

    // Laughing/crying
    ":'-)": '😂',
    "XD": '😆',
    "xD": '😆',

    // Angel/devil
    'O:-)': '😇',
    'O:)': '😇',
    '>:-)': '😈',
    '>:)': '😈',

    // Other
    ':-$': '😳',
    ':$': '😳',
    ':-X': '🤐',
    ':X': '🤐',
    ':-#': '🤐',
    ':#': '🤐',
    '<3<3': '💕',
    ':+1:': '👍',
    ':-1:': '👎',
    '(y)': '👍',
    '(n)': '👎',
  };

  // Sorted patterns by length (longest first) to match longer patterns before shorter ones
  private readonly sortedPatterns: string[];

  constructor() {
    // Sort patterns by length (descending) to match longer patterns first
    this.sortedPatterns = Object.keys(this.emojiMap).sort((a, b) => b.length - a.length);
  }

  /**
   * Converts ASCII emoticons to emojis in the given text.
   * Returns the converted text and the cursor offset adjustment.
   */
  convertEmoticons(text: string, cursorPosition: number): { text: string; cursorOffset: number } {
    let result = text;
    let totalOffset = 0;

    for (const pattern of this.sortedPatterns) {
      const emoji = this.emojiMap[pattern];
      let index = 0;

      while ((index = result.indexOf(pattern, index)) !== -1) {
        // Check if the pattern ends before or at cursor position
        const patternEnd = index + pattern.length;

        // Replace the pattern
        result = result.substring(0, index) + emoji + result.substring(patternEnd);

        // Adjust cursor offset if the replacement happened before cursor
        if (patternEnd <= cursorPosition + totalOffset) {
          totalOffset += emoji.length - pattern.length;
        }

        // Move index past the emoji to continue searching
        index += emoji.length;
      }
    }

    return { text: result, cursorOffset: totalOffset };
  }

  /**
   * Checks if the text ending at cursor position matches any emoticon pattern.
   * Returns the replacement info if found, null otherwise.
   */
  checkForEmoticonAtCursor(text: string, cursorPosition: number): { start: number; end: number; emoji: string } | null {
    // Check each pattern to see if it ends at the cursor position
    for (const pattern of this.sortedPatterns) {
      const start = cursorPosition - pattern.length;
      if (start >= 0) {
        const substring = text.substring(start, cursorPosition);
        if (substring === pattern) {
          // Don't convert emoticons that are part of a URL (e.g. http:// or https://)
          const textBefore = text.substring(0, start);
          if (/https?$/.test(textBefore)) {
            continue;
          }
          return {
            start,
            end: cursorPosition,
            emoji: this.emojiMap[pattern]
          };
        }
      }
    }
    return null;
  }
}
