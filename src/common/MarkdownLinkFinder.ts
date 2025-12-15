import { isFileTypeSupported } from "./FileUtils";

interface MarkdownLink {
  fullMatch: string;
  start: number;
  end: number;
  url: string;
}

function parseMarkdownLinks(
  text: string,
  includeWikiLinks = false,
): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  let i = 0;

  while (i < text.length) {
    const startIdx = i;

    if (text[i] === "!" && i + 1 < text.length && text[i + 1] === "[") {
      i++;
    }

    if (text[i] === "[") {
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

/**
 * Find local file paths in markdown text that match supported types
 */
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

/**
 * Find uploaded file links in text that belong to the configured domain
 */
export function findUploadedFileLinks(text: string, domain: string): string[] {
  if (!text || !domain) {
    return [];
  }

  const links = parseMarkdownLinks(text);
  const processedUrls = new Set<string>();
  const result: string[] = [];

  for (const link of links) {
    if (!processedUrls.has(link.url) && isUploadedFileLink(link.url, domain)) {
      result.push(link.url);
      processedUrls.add(link.url);
    }
  }

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
