import { MarkdownView } from "obsidian";
import { ProcessItem } from "../../types/index";
import { logger } from "../../utils/Logger";

export class TextItemProcessor {
  process(processItem: ProcessItem, activeView: MarkdownView): void {
    if (typeof processItem.value !== "string") return;
    logger.debug("TextItemProcessor", "Processing text item");
    activeView.editor.replaceSelection(processItem.value);
  }
}
