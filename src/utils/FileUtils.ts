export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "svg",
] as const;
export const VIDEO_EXTENSIONS = [
  "mp4",
  "avi",
  "mov",
  "wmv",
  "flv",
  "webm",
] as const;
export const AUDIO_EXTENSIONS = ["mp3", "wav", "flac", "aac", "ogg"] as const;

export const MEDIA_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
] as const;

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];
export type AudioExtension = (typeof AUDIO_EXTENSIONS)[number];
export type MediaExtension = (typeof MEDIA_EXTENSIONS)[number];

export const RANDOM_STRING_LENGTH = 6;
export const RANDOM_STRING_START_INDEX = 2;
export const MULTIPART_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB

export function isImageExtension(ext: string): ext is ImageExtension {
  return IMAGE_EXTENSIONS.includes(ext as ImageExtension);
}

export function isVideoExtension(ext: string): ext is VideoExtension {
  return VIDEO_EXTENSIONS.includes(ext as VideoExtension);
}

export function isAudioExtension(ext: string): ext is AudioExtension {
  return AUDIO_EXTENSIONS.includes(ext as AudioExtension);
}

/**
 * Check if file type is supported for upload
 * @param extension - File extension to check
 * @returns true if supported
 */
export function isFileTypeSupported(autoUploadFileTypes: string[],extension?: string): boolean {
  if (!extension || !autoUploadFileTypes || autoUploadFileTypes.length === 0) {
    return false;
  }

  return autoUploadFileTypes.includes(extension);
}

/**
 * Generate a unique file key with timestamp and random string
 *
 * Format: {timestamp}/{random}-{encoded-filename}.{extension}
 * Example: 2024-01-15T10-30-45-123Z/abc123-my%20file.jpg
 *
 * @param fileName - Original file name
 * @returns Generated unique key
 */
export function generateFileKey(fileName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const randomString = Math.random()
    .toString(36)
    .substring(
      RANDOM_STRING_START_INDEX,
      RANDOM_STRING_START_INDEX + RANDOM_STRING_LENGTH,
    );
  const extension = fileName.split(".").pop();
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf("."));
  const encodedName = encodeURIComponent(nameWithoutExt);

  return `${timestamp}/${randomString}-${encodedName}.${extension}`;
}