/**
 * WebDAV Image Loader - Intercepts image loading and adds Basic Auth for WebDAV URLs
 */

import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { requestUrl } from "obsidian";
import { LruCache } from "../cache/LruCache";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { WebdavConfig } from "../types";

const LOADING_SVG = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke="%23888" stroke-width="2" fill="none" stroke-dasharray="6,30"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>`;

export class WebdavImageLoaderService {
  private configManager: ConfigurationManager;
  private cache = new LruCache<string | Promise<string>>(100);
  private prefixes: string[] = [];

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  updatePrefixes() {
    if (this.configManager.getCurrentStorageService() !== "webdav") {
      this.prefixes = [];
      return;
    }
    const config = this.configManager.getCurrentStorageConfig() as WebdavConfig;
    this.prefixes = [config.endpoint, config.public_domain]
      .map((s) => s?.replace(/\/+$/, ""))
      .filter((s): s is string => !!s);
  }

  async loadImage(el: HTMLImageElement, useCache: boolean) {
    const url = el.src;
    if (!url || el.dataset.webdavLoaded || !this.prefixes.some((p) => url.startsWith(p))) return;
    el.dataset.webdavLoaded = "1";

    const cached = this.cache.get(url);
    if (cached !== null) {
      el.src = typeof cached === "string" ? cached : await cached;
      return;
    }

    el.src = LOADING_SVG;
    const config = this.configManager.getCurrentStorageConfig() as WebdavConfig;
    const promise = requestUrl({
      url,
      method: "GET",
      headers: { Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}` },
    }).then((r) => URL.createObjectURL(new Blob([r.arrayBuffer])));

    if (useCache) this.cache.set(url, promise);

    try {
      const blobUrl = await promise;
      el.src = blobUrl;
      if (useCache) this.cache.set(url, blobUrl);
      else el.onload = () => URL.revokeObjectURL(blobUrl);
    } catch {
      el.src = url;
      this.cache.delete(url);
    }
  }

  revokeImage(el: HTMLImageElement) {
    const blobUrl = this.cache.get(el.src);
    if (typeof blobUrl === "string") {
      URL.revokeObjectURL(blobUrl);
      this.cache.delete(el.src);
    }
  }

  destroy() {
    this.cache.clear();
  }
}

class WebdavImageLoaderExtension implements PluginValue {
  private observer: MutationObserver;
  private loader: WebdavImageLoaderService;

  constructor(view: EditorView, loader: WebdavImageLoaderService) {
    this.loader = loader;
    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLImageElement) this.loader.loadImage(n, true);
        });
      }
    });
    this.observer.observe(view.dom, { childList: true, subtree: true });
  }

  update(_: ViewUpdate) {}
  destroy() {
    this.observer.disconnect();
  }
}

export function createWebdavImageExtension(configManager: ConfigurationManager) {
  const loader = new WebdavImageLoaderService(configManager);
  loader.updatePrefixes();
  const plugin = ViewPlugin.define((view: EditorView) => new WebdavImageLoaderExtension(view, loader));
  return { extension: plugin.extension, loader };
}
