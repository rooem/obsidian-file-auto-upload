import * as crypto from "crypto";

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
 * Generate a unique file key with timestamp and random string
 *
 * Format: {timestamp}/{random}-{encoded-filename}.{extension}
 * Example: 2024-01-15T10-30-45-123Z/abc123-my%20file.jpg
 *
 * @param fileName - Original file name
 * @returns Generated unique key
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
  const digest = crypto.createHash("sha256").update(text).digest("base64");
  const hash = digest.replace(/[+/=]/g, "").substring(0, length);
  return `${type}${hash}`;
}

/**
 * Generate a unique file key with timestamp and random string
 *
 * Format: {timestamp}/{random}-{filename}.{extension}
 * Example: 2024-01-15T10-30-45-123Z/abc123-myfile.jpg
 *
 * @param fileName - Original file name
 * @returns Generated unique key
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

export function findSupportedFilePath(
  text: string,
  autoUploadFileTypes: string[],
): string[] {
  if (!text || !autoUploadFileTypes || autoUploadFileTypes.length === 0) {
    return [];
  }

  const paths: string[] = [];
  let i = 0;

  while (i < text.length) {
    // 跳过 ! 前缀
    if (text[i] === "!" && i + 1 < text.length && text[i + 1] === "[") {
      i++;
    }

    if (text[i] === "[") {
      // 检查是否是 [[]] wiki 链接
      if (i + 1 < text.length && text[i + 1] === "[") {
        const closeIdx = text.indexOf("]]", i + 2);
        if (closeIdx !== -1) {
          paths.push(text.substring(i + 2, closeIdx));
          i = closeIdx + 2;
          continue;
        }
      } else {
        // []() markdown 链接 - 找到匹配的 ]
        let bracketDepth = 1;
        let j = i + 1;
        while (j < text.length && bracketDepth > 0) {
          if (text[j] === "[") {
            bracketDepth++;
          } else if (text[j] === "]") {
            bracketDepth--;
          }
          j++;
        }

        if (bracketDepth === 0 && j < text.length && text[j] === "(") {
          // 找到匹配的右括号（处理嵌套括号）
          let parenDepth = 1;
          let k = j + 1;
          while (k < text.length && parenDepth > 0) {
            if (text[k] === "(") {
              parenDepth++;
            } else if (text[k] === ")") {
              parenDepth--;
            }
            k++;
          }
          if (parenDepth === 0) {
            paths.push(text.substring(j + 1, k - 1));
            i = k;
            continue;
          }
        }
      }
    }
    i++;
  }

  return paths.filter(
    (path) =>
      !path.startsWith("http://") &&
      !path.startsWith("https://") &&
      isFileTypeSupported(autoUploadFileTypes, path.split(".").pop()),
  );
}

/**
 * Extract uploaded file URLs from selected text
 * @param text - Selected text to search
 * @returns Array of uploaded file URLs
 */
export function findUploadedFileLinks(text: string, domain: string): string[] {
  const links: string[] = [];
  const processedUrls = new Set<string>();
  let i = 0;

  while (i < text.length) {
    // 跳过 ! 前缀
    if (text[i] === "!" && i + 1 < text.length && text[i + 1] === "[") {
      i++;
    }

    if (text[i] === "[") {
      // 找到匹配的 ]
      let bracketDepth = 1;
      let j = i + 1;
      while (j < text.length && bracketDepth > 0) {
        if (text[j] === "[") {
          bracketDepth++;
        } else if (text[j] === "]") {
          bracketDepth--;
        }
        j++;
      }

      if (bracketDepth === 0 && j < text.length && text[j] === "(") {
        // 找到匹配的右括号
        let parenDepth = 1;
        let k = j + 1;
        while (k < text.length && parenDepth > 0) {
          if (text[k] === "(") {
            parenDepth++;
          } else if (text[k] === ")") {
            parenDepth--;
          }
          k++;
        }
        if (parenDepth === 0) {
          const url = text.substring(j + 1, k - 1);
          if (!processedUrls.has(url) && isUploadedFileLink(url, domain)) {
            links.push(url);
            processedUrls.add(url);
          }
          i = k;
          continue;
        }
      }
    }
    i++;
  }

  // 匹配独立的 URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[1].replace(/\)+$/, ""); // 移除末尾多余的括号
    if (!processedUrls.has(url) && isUploadedFileLink(url, domain)) {
      links.push(url);
      processedUrls.add(url);
    }
  }

  return links;
}

/**
 * Extract storage key from file URL
 * @param url - File URL
 * @returns Storage key for deletion
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

    // Decode the key to get the original storage key
    // The URL may be encoded, but S3 stores keys in their original form
    try {
      return decodeURIComponent(extractedKey);
    } catch {
      return extractedKey;
    }
  } catch {
    return url;
  }
}

/**
 * Check if URL is an uploaded file from configured storage
 * @param url - URL to check
 * @returns true if URL matches configured storage
 */
function isUploadedFileLink(url: string, publicDomain: string): boolean {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return false;
    }

    if (!publicDomain) {
      return false;
    }

    const publicUrlObj = new URL(publicDomain);
    const urlObj = new URL(url);
    return urlObj.hostname === publicUrlObj.hostname;
  } catch {
    return false;
  }
}

export interface MarkdownLink {
  fullMatch: string;
  start: number;
  end: number;
  url: string;
}

/**
 * Parse markdown links from text
 * Handles both ![alt](url) and [text](url) formats
 */
export function parseMarkdownLinks(text: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let i = 0;

  while (i < text.length) {
    const startIdx = i;
    if (text[i] === "!" && i + 1 < text.length && text[i + 1] === "[") {
      i++;
    }

    if (text[i] === "[") {
      let bracketDepth = 1;
      let j = i + 1;
      while (j < text.length && bracketDepth > 0) {
        if (text[j] === "[") {
          bracketDepth++;
        } else if (text[j] === "]") {
          bracketDepth--;
        }
        j++;
      }

      if (bracketDepth === 0 && j < text.length && text[j] === "(") {
        let parenDepth = 1;
        let k = j + 1;
        while (k < text.length && parenDepth > 0) {
          if (text[k] === "(") {
            parenDepth++;
          } else if (text[k] === ")") {
            parenDepth--;
          }
          k++;
        }
        if (parenDepth === 0) {
          links.push({
            fullMatch: text.substring(startIdx, k),
            start: startIdx,
            end: k,
            url: text.substring(j + 1, k - 1),
          });
          i = k;
          continue;
        }
      }
    }
    i++;
  }

  return links;
}

/**
 * Remove markdown links containing the specified URL
 */
export function removeMarkdownLinksByUrl(
  text: string,
  targetUrl: string,
): string {
  const links = parseMarkdownLinks(text);
  let result = "";
  let lastEnd = 0;

  for (const link of links) {
    if (link.url === targetUrl) {
      result += text.substring(lastEnd, link.start);
      lastEnd = link.end;
    }
  }
  result += text.substring(lastEnd);

  return result;
}
