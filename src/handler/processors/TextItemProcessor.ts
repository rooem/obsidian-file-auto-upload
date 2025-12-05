import { MarkdownView } from "obsidian";
import { TextProcessItem } from "../../types/index";
import { logger } from "../../utils/Logger";

export class TextItemProcessor {
  process(processItem: TextProcessItem, activeView: MarkdownView): void {
    logger.debug("TextItemProcessor", "Processing text item");
    activeView.editor.replaceSelection(processItem.value);
  }
}
