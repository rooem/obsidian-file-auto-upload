import { App } from "obsidian";
import { logger } from "../utils/Logger";

interface ObsidianModal {
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  onOpen?: () => void;
  onClose?: () => void;
  open(): void;
  close(): void;
}

/**
 * Interface for base UI component functionality
 */
export interface IBaseUIComponent {
  render(): void;
  destroy(): void;
  getContainer(): HTMLElement;
  show(): void;
  hide(): void;
  isVisible(): boolean;
}

/**
 * Base class for UI components
 * Provides common functionality for DOM manipulation and lifecycle management
 */
export abstract class BaseUIComponent implements IBaseUIComponent {
  protected app: App;
  protected container: HTMLElement | null = null;
  protected isDestroyed: boolean = false;
  protected isVisibleState: boolean = false;

  constructor(app: App, _eventSystem: unknown, container?: HTMLElement) {
    this.app = app;
    this.container = container || this.createContainer();
  }

  /**
   * Render the component - must be implemented by subclasses
   */
  abstract render(): void;

  /**
   * Create the component's container element
   */
  protected createContainer(): HTMLElement {
    return document.createElement("div");
  }

  /**
   * Get the component's container element
   */
  getContainer(): HTMLElement {
    if (!this.container) {
      throw new Error("Component container does not exist");
    }
    return this.container;
  }

  /**
   * Set a new container for the component
   */
  setContainer(container: HTMLElement): void {
    if (this.container && this.container !== container) {
      this.destroy();
    }
    this.container = container;
  }

  /**
   * Show the component
   */
  show(): void {
    if (this.container && !this.isVisibleState) {
      this.container.setCssStyles({display:""});
      this.isVisibleState = true;
      this.onShow();
    }
  }

  /**
   * Hide the component
   */
  hide(): void {
    if (this.container && this.isVisibleState) {
      this.container.setCssStyles({display:"none"});
      this.isVisibleState = false;
      this.onHide();
    }
  }

  /**
   * Check if component is visible
   */
  isVisible(): boolean {
    return this.isVisibleState;
  }

  addClass(className: string): void {
    if (this.container) {
      this.container.classList.add(className);
    }
  }

  removeClass(className: string): void {
    if (this.container) {
      this.container.classList.remove(className);
    }
  }

  toggleClass(className: string): void {
    if (this.container) {
      this.container.classList.toggle(className);
    }
  }

  setAttribute(name: string, value: string): void {
    if (this.container) {
      this.container.setAttribute(name, value);
    }
  }

  getAttribute(name: string): string {
    return this.container?.getAttribute(name) ?? "";
  }

  addStyle(styles: Partial<CSSStyleDeclaration>): void {
    if (this.container) {
      Object.assign(this.container.style, styles);
    }
  }

  clear(): void {
    if (this.container) {
      this.container.empty();
    }
  }

  createElement<T extends keyof HTMLElementTagNameMap>(
    tagName: T,
    className?: string,
    textContent?: string,
  ): HTMLElementTagNameMap[T] {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (textContent) {
      element.textContent = textContent;
    }

    return element;
  }

  addEventListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    event: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void {
    element.addEventListener(event, listener, options);
  }

  removeEventListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    event: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void {
    element.removeEventListener(event, listener, options);
  }

  protected onShow(): void {}

  protected onHide(): void {}

  protected onDestroy(): void {}

  /**
   * Destroy the component and clean up resources
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.onDestroy();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.isVisibleState = false;
    this.isDestroyed = true;
  }

  isComponentDestroyed(): boolean {
    return this.isDestroyed;
  }

  protected handleError(error: Error, context?: string): void {
    const message = context ? `[${context}] ${error.message}` : error.message;
    logger.error(this.constructor.name, message, error);
  }

  getComponentState(): {
    isDestroyed: boolean;
    isVisible: boolean;
    hasContainer: boolean;
    className?: string;
  } {
    return {
      isDestroyed: this.isDestroyed,
      isVisible: this.isVisibleState,
      hasContainer: !!this.container,
      className: this.container?.className,
    };
  }

  setComponentId(id: string): void {
    if (this.container) {
      this.container.id = id;
    }
  }

  getComponentId(): string {
    return this.container?.id ?? "";
  }

  protected removeGlobalStyles(id: string): void {
    const style = document.getElementById(id);
    if (style) {
      style.remove();
    }
  }

  protected async waitForDOMUpdate(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  protected isElementInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  protected scrollIntoView(
    element: HTMLElement,
    options?: ScrollIntoViewOptions,
  ): void {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      ...options,
    });
  }
}

/**
 * Base class for modal components
 * Extends BaseUIComponent with modal-specific functionality
 */
export abstract class BaseModalComponent extends BaseUIComponent {
  protected modal: ObsidianModal;
  protected isOpen: boolean = false;

  constructor(app: App, eventSystem: unknown, modal: ObsidianModal) {
    super(app, eventSystem);
    this.modal = modal;
    this.setupModalEvents();
  }

  private setupModalEvents(): void {
    const originalOnOpen = this.modal.onOpen;
    const originalOnClose = this.modal.onClose;

    this.modal.onOpen = () => {
      if (originalOnOpen) {
        originalOnOpen.call(this.modal);
      }
      this.isOpen = true;
      this.onModalOpen();
    };

    this.modal.onClose = () => {
      if (originalOnClose) {
        originalOnClose.call(this.modal);
      }
      this.isOpen = false;
      this.onModalClose();
    };
  }

  protected onModalOpen(): void {}

  protected onModalClose(): void {}

  /**
   * Close the modal
   */
  closeModal(): void {
    if (this.isOpen) {
      this.modal.close();
    }
  }

  /**
   * Open the modal
   */
  openModal(): void {
    if (!this.isOpen) {
      this.modal.open();
    }
  }

  isModalOpen(): boolean {
    return this.isOpen;
  }

  protected getModalContent(): HTMLElement {
    return this.modal.contentEl;
  }

  /**
   * Get the modal instance
   */
  getModal(): ObsidianModal {
    return this.modal;
  }

  destroy(): void {
    if (this.isOpen) {
      this.closeModal();
    }
    super.destroy();
  }

  setModalTitle(title: string): void {
    this.modal.titleEl.textContent = title;
  }

  getModalTitle(): string {
    return this.modal.titleEl.textContent ?? "";
  }

  setModalSize(width?: string, height?: string): void {
    const contentEl = this.getModalContent();
    if (width) {
      contentEl.setCssStyles({ width: width});
    }
    if (height) {
      contentEl.setCssStyles({ height: height});
    }
  }

  getModalState(): {
    isOpen: boolean;
    hasModal: boolean;
    title: string;
  } {
    return {
      isOpen: this.isOpen,
      hasModal: !!this.modal,
      title: this.getModalTitle(),
    };
  }
}
