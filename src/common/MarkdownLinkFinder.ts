import { App, TFile, TFolder } from "obsidian";
import { isFileTypeSupported } from "./FileUtils";

export interface UploadableFile {
  filePath: string;
  docPaths: string[];
}

export interface DownloadableFile {
  url: string;
  docPaths: string[];
}

export interface FolderScanResult {
  totalDocs: number;
  uploadableFiles: UploadableFile[];
}

export interface FolderDownloadScanResult {
  totalDocs: number;
  downloadableFiles: DownloadableFile[];
}

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

/**
 * Scan folder or file for uploadable files
 */
export async function scanFolderForUploadableFiles(
  app: App,
  target: TFile | TFolder,
  supportedTypes: string[],
  onProgress?: (current: number, total: number) => void
): Promise<FolderScanResult> {
  const result: FolderScanResult = { totalDocs: 0, uploadableFiles: [] };

  const allFiles: TFile[] = [];
  
  if (target instanceof TFile) {
    if (target.extension === "md") {
      allFiles.push(target);
    }
  } else {
    const collectFiles = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFolder) {
          collectFiles(child);
        } else if (child instanceof TFile && child.extension === "md") {
          allFiles.push(child);
        }
      }
    };
    collectFiles(target);
  }

  const fileToDocsMap = new Map<string, string[]>();
  
  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    result.totalDocs++;
    onProgress?.(i + 1, allFiles.length);
    const content = await app.vault.cachedRead(file);
    const localFiles = findSupportedFilePath(content, supportedTypes);
    localFiles.forEach((filePath) => {
      const docs = fileToDocsMap.get(filePath) || [];
      docs.push(file.path);
      fileToDocsMap.set(filePath, docs);
    });
  }
  
  for (const [filePath, docPaths] of fileToDocsMap) {
    result.uploadableFiles.push({ filePath, docPaths });
  }

  return result;
}

/**
 * Scan folder or file for downloadable files (remote URLs)
 */
export async function scanFolderForDownloadableFiles(
  app: App,
  target: TFile | TFolder,
  domain: string,
  onProgress?: (current: number, total: number) => void
): Promise<FolderDownloadScanResult> {
  const result: FolderDownloadScanResult = { totalDocs: 0, downloadableFiles: [] };

  const allFiles: TFile[] = [];
  
  if (target instanceof TFile) {
    if (target.extension === "md") {
      allFiles.push(target);
    }
  } else {
    const collectFiles = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFolder) {
          collectFiles(child);
        } else if (child instanceof TFile && child.extension === "md") {
          allFiles.push(child);
        }
      }
    };
    collectFiles(target);
  }

  const urlToDocsMap = new Map<string, string[]>();
  
  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    result.totalDocs++;
    onProgress?.(i + 1, allFiles.length);
    const content = await app.vault.cachedRead(file);
    const urls = findUploadedFileLinks(content, domain);
    urls.forEach((url) => {
      const docs = urlToDocsMap.get(url) || [];
      docs.push(file.path);
      urlToDocsMap.set(url, docs);
    });
  }
  
  for (const [url, docPaths] of urlToDocsMap) {
    result.downloadableFiles.push({ url, docPaths });
  }

  return result;
}
