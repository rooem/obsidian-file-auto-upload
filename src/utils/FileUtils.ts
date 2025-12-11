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

export function isFileTypeSupported(
  autoUploadFileTypes: string[],
  extension?: string,
): boolean {
  if (!extension || !autoUploadFileTypes || autoUploadFileTypes.length === 0) {
    return false;
  }
  return autoUploadFileTypes.includes(extension);
}

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
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(36);
  return `${type}${hashStr.substring(0, length)}`;
}

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

export interface MarkdownLink {
  fullMatch: string;
  start: number;
  end: number;
  url: string;
}

/**
 * Parse all markdown links from text (both ![](url) and [](url) formats)
 * Also handles [[wiki]] links
 */
export function parseMarkdownLinks(
  text: string,
  includeWikiLinks = false,
): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let i = 0;

  while (i < text.length) {
    const startIdx = i;

    // Skip ! prefix for images
    if (text[i] === "!" && i + 1 < text.length && text[i + 1] === "[") {
      i++;
    }

    if (text[i] === "[") {
      // Check for [[wiki]] links
      if (includeWikiLinks && i + 1 < text.length && text[i + 1] === "[") {
        const closeIdx = text.indexOf("]]", i + 2);
        if (closeIdx !== -1) {
          links.push({
            fullMatch: text.substring(startIdx, closeIdx + 2),
            start: startIdx,
            end: closeIdx + 2,
            url: text.substring(i + 2, closeIdx),
          });
          i = closeIdx + 2;
          continue;
        }
      }

      // Standard []() markdown link
      let bracketDepth = 1;
      let j = i + 1;
      while (j < text.length && bracketDepth > 0) {
        if (text[j] === "[") bracketDepth++;
        else if (text[j] === "]") bracketDepth--;
        j++;
      }

      if (bracketDepth === 0 && j < text.length && text[j] === "(") {
        let parenDepth = 1;
        let k = j + 1;
        while (k < text.length && parenDepth > 0) {
          if (text[k] === "(") parenDepth++;
          else if (text[k] === ")") parenDepth--;
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

export function findSupportedFilePath(
  text: string,
  autoUploadFileTypes: string[],
): string[] {
  if (!text || !autoUploadFileTypes || autoUploadFileTypes.length === 0) {
    return [];
  }

  const links = parseMarkdownLinks(text, true);
  return links
    .map((link) => link.url)
    .filter(
      (url) =>
        !url.startsWith("http://") &&
        !url.startsWith("https://") &&
        isFileTypeSupported(autoUploadFileTypes, url.split(".").pop()),
    );
}

export function findUploadedFileLinks(text: string, domain: string): string[] {
  if (!text || !domain) return [];

  const links = parseMarkdownLinks(text);
  const processedUrls = new Set<string>();
  const result: string[] = [];

  // From markdown links
  for (const link of links) {
    if (!processedUrls.has(link.url) && isUploadedFileLink(link.url, domain)) {
      result.push(link.url);
      processedUrls.add(link.url);
    }
  }

  // Standalone URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[1].replace(/\)+$/, "");
    if (!processedUrls.has(url) && isUploadedFileLink(url, domain)) {
      result.push(url);
      processedUrls.add(url);
    }
  }

  return result;
}

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

function isUploadedFileLink(url: string, publicDomain: string): boolean {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return false;
    }
    const publicUrlObj = new URL(publicDomain);
    const urlObj = new URL(url);
    return urlObj.hostname === publicUrlObj.hostname;
  } catch {
    return false;
  }
}

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
