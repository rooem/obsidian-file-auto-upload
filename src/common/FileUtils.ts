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

export const RANDOM_STRING_LENGTH = 7;
export const RANDOM_STRING_START_INDEX = 2;
export const MULTIPART_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * Check if extension belongs to a specific media type
 * @param ext - File extension to check
 * @param extensions - Array of extensions to check against
 * @returns True if extension is in the array
 */
function isExtensionOf<T extends string>(
  ext: string,
  extensions: readonly T[],
): ext is T {
  return extensions.includes(ext as T);
}

export const isImageExtension = (ext: string): ext is ImageExtension =>
  isExtensionOf(ext, IMAGE_EXTENSIONS);
export const isVideoExtension = (ext: string): ext is VideoExtension =>
  isExtensionOf(ext, VIDEO_EXTENSIONS);
export const isAudioExtension = (ext: string): ext is AudioExtension =>
  isExtensionOf(ext, AUDIO_EXTENSIONS);

/**
 * Check if file type is supported for auto-upload
 * @param autoUploadFileTypes - List of supported file types
 * @param extension - File extension to check
 * @returns True if file type is supported
 */
export function isFileTypeSupported(
  autoUploadFileTypes: string[],
  extension?: string,
): boolean {
  if (!extension || !autoUploadFileTypes || autoUploadFileTypes.length === 0) {
    return false;
  }
  return autoUploadFileTypes.includes(extension);
}

/**
 * Generate unique identifier for process items
 * Creates ID based on file metadata or timestamp for uniqueness
 * @param type - Type prefix for the ID
 * @param file - Optional file to generate ID from
 * @param length - Length of hash portion of ID
 * @returns Unique identifier string
 */
export function generateUniqueId(
  type: string,
  file?: File,
  length: number = 6,
): string {
  if (!file) {
    return `${type}${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;
  }
  const text = `${file.name}_${file.size}_${file.type}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(36);
  return `${type}${hashStr.substring(0, length)}`;
}

/**
 * Generate unique file key for storage
 * Creates timestamped key with unique identifier to prevent collisions
 * @param fileName - Original file name
 * @param uniqueId - Optional unique identifier
 * @returns Generated file key
 */
export function generateFileKey(fileName: string, uniqueId?: string): string {
  const now = new Date();
  if (!uniqueId) {
    uniqueId = Math.random()
      .toString(36)
      .substring(
        RANDOM_STRING_START_INDEX,
        RANDOM_STRING_START_INDEX + RANDOM_STRING_LENGTH,
      );
  }

  const timestamp =
    uniqueId +
    "_" +
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0");

  const extension = fileName.split(".").pop();
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf("."));
  return `${timestamp}_${nameWithoutExt}.${extension}`;
}

/**
 * Extract file key from full URL
 * Handles both domain-based and custom public URL formats
 * @param url - Full URL to uploaded file
 * @param publicDomain - Public domain for uploaded files
 * @returns Extracted file key
 */
export function extractFileKeyFromUrl(
  url: string,
  publicDomain: string,
): string {
  try {
    let extractedKey: string;
    if (url.startsWith(publicDomain)) {
      const baseUrl = publicDomain.replace(/\/$/, "");
      extractedKey = url.substring(baseUrl.length + 1);
    } else {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      extractedKey = pathname.startsWith("/")
        ? pathname.substring(1)
        : pathname;
    }

    try {
      return decodeURIComponent(extractedKey);
    } catch {
      return extractedKey;
    }
  } catch {
    return url;
  }
}
