/**
 * WebDAV Image Loader - Intercepts image loading and adds Basic Auth for WebDAV URLs
 */

import { EditorView, ViewPlugin } from "@codemirror/view";
import { requestUrl } from "obsidian";
import { LruCache } from "../common/LruCache";
import { ConfigurationManager } from "../settings/ConfigurationManager";
import { WebdavConfig, StorageServiceType } from "../types";
import { logger } from "../common/Logger";

const LOADING_SVG = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke="%23888" stroke-width="2" fill="none" stroke-dasharray="6,30"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>`;

export class WebdavImageLoader {
  private configManager: ConfigurationManager;
  private cache = new LruCache<string | Promise<string>>(100);
  private prefixes: string[] = [];

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
    this.updatePrefixes();
  }

  createExtension() {
    return ViewPlugin.define((view: EditorView) => {
      const processExistingImages = () => {
        view.dom.querySelectorAll("img").forEach((img) => {
          void this.loadImage(img, true);
        });
      };

      processExistingImages();

      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((n) => {
            if (n instanceof HTMLImageElement) {
              void this.loadImage(n, true);
            } else if (n instanceof Element) {
              n.querySelectorAll("img").forEach((img) => {
                void this.loadImage(img, true);
              });
            }
          });
        }
      });
      observer.observe(view.dom, { childList: true, subtree: true });
      return {
        update() {
          processExistingImages();
        },
        destroy() {
          observer.disconnect();
        },
      };
    }).extension;
  }

  updatePrefixes() {
    if (
      this.configManager.getCurrentStorageService() !==
      StorageServiceType.WEBDAV
    ) {
      this.prefixes = [];
      return;
    }
    const config = this.configManager.getCurrentStorageConfig() as WebdavConfig;
    this.prefixes = [config.endpoint]
      .map((s) => s?.replace(/\/+$/, ""))
      .filter((s): s is string => !!s);
  }

  async loadImage(el: HTMLImageElement, useCache: boolean) {
    const url = el.src;
    if (!url || el.dataset.webdavLoaded) {
      return;
    }

    // Only process when WebDAV is configured and has prefixes
    if (this.prefixes.length === 0) {
      return;
    }

    const isWebdavUrl = this.prefixes.some((p) => url.startsWith(p));
    if (!isWebdavUrl) {
      return;
    }

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
      headers: {
        Authorization: `Basic ${btoa(`${config.access_key_id}:${config.secret_access_key}`)}`,
      },
    }).then((r) => URL.createObjectURL(new Blob([r.arrayBuffer])));

    if (useCache) {
      this.cache.set(url, promise);
    }

    try {
      const blobUrl = await promise;
      if (useCache) {
        this.cache.set(url, blobUrl);
      } else {
        el.onload = () => URL.revokeObjectURL(blobUrl);
      }
      el.src = blobUrl;
    } catch (e) {
      logger.error("WebdavImageLoader", "WebDAV image load failed", e);
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
