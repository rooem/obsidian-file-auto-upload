/**
 * Application-wide constants
 */
export class Constants {
  // File extensions
  static readonly IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"] as const;
  static readonly VIDEO_EXTENSIONS = ["mp4", "avi", "mov", "wmv", "flv", "webm"] as const;
  static readonly AUDIO_EXTENSIONS = ["mp3", "wav", "flac", "aac", "ogg"] as const;
  static readonly MEDIA_EXTENSIONS = [...this.IMAGE_EXTENSIONS, ...this.VIDEO_EXTENSIONS, ...this.AUDIO_EXTENSIONS] as const;

  // File utilities
  static readonly RANDOM_STRING_LENGTH = 7;
  static readonly RANDOM_STRING_START_INDEX = 2;
  static readonly MULTIPART_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB

  // Concurrency
  static readonly MAX_CONCURRENT = 5;

  // HTTP Status codes
  static readonly HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    MULTI_STATUS: 207,
  } as const;
}

// Type exports for file extensions
export type ImageExtension = (typeof Constants.IMAGE_EXTENSIONS)[number];
export type VideoExtension = (typeof Constants.VIDEO_EXTENSIONS)[number];
export type AudioExtension = (typeof Constants.AUDIO_EXTENSIONS)[number];
export type MediaExtension = (typeof Constants.MEDIA_EXTENSIONS)[number];
