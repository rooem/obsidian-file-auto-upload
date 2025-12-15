import { App, MarkdownView } from "obsidian";
import { isImageExtension } from "./FileUtils";

export type ContentType = "text" | "image" | "file";

export interface ReplaceOptions {
    contentType?: ContentType;
    fileName?: string;
}

/**
 * Handles content replacement in markdown editor
 * Supports text, image, and file content types
 */
export class ContentReplacer {
    constructor(private app: App) { }

    /**
     * Escape special regex characters
     */
    escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Get placeholder suffix for progress indication
     */
    getPlaceholderSuffix(id: string, statusText: string): string {
        return `🔄${statusText}<!--${id}-->`;
    }

    /**
     * Replace URL with placeholder in markdown link
     */
    replaceUrlWithPlaceholder(url: string, id: string, text: string): boolean {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return false;

        const placeholder = this.getPlaceholderSuffix(id, text);

        const editor = activeView.editor;
        const content = editor.getValue();
        const escapedUrl = this.escapeRegExp(url);
        const linkRegex = new RegExp(`(!?\\[[^\\]]*\\])\\(${escapedUrl}\\)`);
        const match = linkRegex.exec(content);

        if (match) {
            const startOffset = match.index;
            const endOffset = startOffset + match[0].length;
            editor.replaceRange(
                match[1] + placeholder,
                editor.offsetToPos(startOffset),
                editor.offsetToPos(endOffset),
            );
            return true;
        }
        return false;
    }

    /**
     * Replace placeholder with final markdown content
     */
    replacePlaceholderWithMarkdown(
        id: string,
        markdown: string,
        options?: ReplaceOptions,
    ): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const content = editor.getValue();
        const marker = `<!--${id}-->`;
        const markerIndex = content.indexOf(marker);

        if (markerIndex === -1) {
            editor.replaceRange(markdown + "\n", { line: editor.lastLine() + 1, ch: 0 });
            return;
        }

        const linkStartIndex = content.lastIndexOf("[", markerIndex);
        if (linkStartIndex === -1) {
            editor.replaceRange(markdown + "\n", { line: editor.lastLine() + 1, ch: 0 });
            return;
        }

        const finalMarkdown = this.adjustMarkdownFormat(
            content,
            linkStartIndex,
            markdown,
            options,
        );

        editor.replaceRange(
            finalMarkdown,
            editor.offsetToPos(linkStartIndex),
            editor.offsetToPos(markerIndex + marker.length),
        );
    }

    /**
     * Remove content by URL from editor
     */
    removeContentByUrl(url: string, originalSelection?: string): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView?.editor) return;

        const editor = activeView.editor;
        const currentSelection = editor.getSelection();
        const textToProcess = currentSelection || originalSelection || "";

        let updatedText = this.removeMarkdownLinksByUrl(textToProcess, url);
        const urlRegex = new RegExp(this.escapeRegExp(url), "g");
        updatedText = updatedText.replace(urlRegex, "");
        updatedText = updatedText.replace(/\n\s*\n\s*/g, "\n\n").trim();

        const fromCursor = editor.getCursor("from");
        const toCursor = editor.getCursor("to");
        editor.replaceRange(updatedText, fromCursor, toCursor);
    }

    /**
     * Insert text at cursor position
     */
    insertAtCursor(text: string): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;
        activeView.editor.replaceSelection(text);
    }

    /**
     * Generate markdown link based on content type
     */
    generateMarkdownLink(
        name: string,
        url: string,
        contentType: ContentType,
    ): string {
        const encodedUrl = encodeURI(url);
        return contentType === "image"
            ? `![${name}](${encodedUrl})`
            : `[${name}](${encodedUrl})`;
    }

    private adjustMarkdownFormat(
        content: string,
        linkStartIndex: number,
        markdown: string,
        options?: ReplaceOptions,
    ): string {
        const hasImagePrefix =
            linkStartIndex > 0 && content[linkStartIndex - 1] === "!";

        if (hasImagePrefix && markdown.startsWith("!")) {
            return markdown.substring(1);
        }

        if (!hasImagePrefix && options?.fileName) {
            const ext = options.fileName.split(".").pop()?.toLowerCase() || "";
            if (isImageExtension(ext) && !markdown.startsWith("!")) {
                return `!${markdown}`;
            }
        }

        return markdown;
    }

    private removeMarkdownLinksByUrl(text: string, targetUrl: string): string {
        const linkRegex = /(!?\[[^\]]*\])\(([^)]+)\)/g;
        return text.replace(linkRegex, (match, linkText, url) => {
            return url === targetUrl ? "" : match;
        });
    }
}
