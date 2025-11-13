/**
 * Caption Renderer
 *
 * Renders CEA-708 closed captions to HTML with proper styling and positioning.
 */

import type {
  DecodedCaption,
  PenAttributes,
  PenColor,
  CaptionDecoderConfig,
} from "./CEA708Decoder";

/**
 * Caption renderer options
 */
export interface CaptionRendererOptions {
  container: HTMLElement;
  config?: CaptionDecoderConfig;
}

/**
 * Caption Renderer
 *
 * Renders CEA-708 captions to an HTML container with CSS styling.
 */
export class CaptionRenderer {
  private container: HTMLElement;
  private config: CaptionDecoderConfig;
  private captionElement: HTMLDivElement | null = null;

  constructor(options: CaptionRendererOptions) {
    this.container = options.container;
    this.config = options.config ?? {};
    this.initializeContainer();
  }

  /**
   * Initialize the caption container
   */
  private initializeContainer(): void {
    this.container.style.position = "relative";

    // Create caption overlay
    this.captionElement = document.createElement("div");
    this.captionElement.className = "cea708-caption-overlay";
    this.captionElement.style.cssText = `
      position: absolute;
      bottom: 10%;
      left: 50%;
      transform: translateX(-50%);
      max-width: 80%;
      text-align: center;
      pointer-events: none;
      z-index: 1000;
    `;

    this.container.appendChild(this.captionElement);
  }

  /**
   * Render a caption
   */
  public render(caption: DecodedCaption): void {
    if (!this.captionElement) {
      return;
    }

    // Clear previous content
    this.captionElement.innerHTML = "";

    // Render text
    for (const textEntry of caption.text) {
      const span = document.createElement("span");
      span.className = "cea708-text";

      // Apply text content
      span.textContent = textEntry.text;

      // Apply styling
      this.applyTextStyling(span, textEntry);

      this.captionElement.appendChild(span);
    }

    // Apply global styling
    this.applyGlobalStyling(this.captionElement);
  }

  /**
   * Apply text styling from pen attributes
   */
  private applyTextStyling(
    element: HTMLSpanElement,
    textEntry: {
      text: string;
      penAttributes: PenAttributes;
      foregroundColor: PenColor;
      backgroundColor: PenColor;
      edgeColor: PenColor;
    },
  ): void {
    const styles: string[] = [];

    // Font family
    const fontFamily = this.getFontFamily(textEntry.penAttributes.fontStyle);
    if (fontFamily) {
      styles.push(`font-family: ${fontFamily}`);
    }

    // Font size
    const fontSize =
      this.config.fontSize ?? this.getFontSize(textEntry.penAttributes.penSize);
    styles.push(`font-size: ${fontSize}px`);

    // Text styling
    if (textEntry.penAttributes.italics) {
      styles.push("font-style: italic");
    }
    if (textEntry.penAttributes.underline) {
      styles.push("text-decoration: underline");
    }
    if (textEntry.penAttributes.fontStyle === "small_caps") {
      styles.push("font-variant: small-caps");
    }

    // Colors
    const fgColor =
      this.config.textColor ?? this.colorToRGBA(textEntry.foregroundColor);
    styles.push(`color: ${fgColor}`);

    const bgColor =
      this.config.backgroundColor ??
      this.colorToRGBA(textEntry.backgroundColor);
    styles.push(`background-color: ${bgColor}`);

    // Text edge/shadow
    const edgeStyle = this.config.edgeStyle ?? textEntry.penAttributes.edgeType;
    const edgeCSS = this.getEdgeStyle(
      edgeStyle,
      this.colorToRGBA(textEntry.edgeColor),
    );
    if (edgeCSS) {
      styles.push(edgeCSS);
    }

    // Vertical offset (superscript/subscript)
    if (textEntry.penAttributes.offset === "superscript") {
      styles.push("vertical-align: super");
      styles.push("font-size: 0.8em");
    } else if (textEntry.penAttributes.offset === "subscript") {
      styles.push("vertical-align: sub");
      styles.push("font-size: 0.8em");
    }

    // eslint-disable-next-line no-param-reassign
    element.style.cssText = styles.join("; ");
  }

  /**
   * Apply global caption styling
   */
  private applyGlobalStyling(element: HTMLDivElement): void {
    // Window opacity
    if (this.config.windowOpacity !== undefined) {
      // eslint-disable-next-line no-param-reassign
      element.style.opacity = String(this.config.windowOpacity);
    }

    // Padding and background
    // eslint-disable-next-line no-param-reassign
    element.style.padding = "0.5em 1em";
    // eslint-disable-next-line no-param-reassign
    element.style.borderRadius = "4px";
    // eslint-disable-next-line no-param-reassign
    element.style.lineHeight = "1.4";
  }

  /**
   * Get CSS font family from font style
   */
  private getFontFamily(fontStyle: PenAttributes["fontStyle"]): string {
    switch (fontStyle) {
      case "mono_serif":
        return '"Courier New", Courier, monospace';
      case "prop_serif":
        return 'Georgia, "Times New Roman", serif';
      case "mono_sans":
        return '"Consolas", "Monaco", monospace';
      case "prop_sans":
        return "Arial, Helvetica, sans-serif";
      case "casual":
        return '"Comic Sans MS", cursive';
      case "cursive":
        return '"Brush Script MT", cursive';
      case "small_caps":
        return "Arial, Helvetica, sans-serif";
      case "default":
      default:
        return "Arial, Helvetica, sans-serif";
    }
  }

  /**
   * Get font size in pixels
   */
  private getFontSize(penSize: PenAttributes["penSize"]): number {
    switch (penSize) {
      case "small":
        return 16;
      case "large":
        return 24;
      case "standard":
      default:
        return 20;
    }
  }

  /**
   * Convert PenColor to CSS RGBA
   */
  private colorToRGBA(color: PenColor): string {
    const opacity = this.getOpacityValue(color.opacity);
    return `rgba(${color.red}, ${color.green}, ${color.blue}, ${opacity})`;
  }

  /**
   * Get numeric opacity value
   */
  private getOpacityValue(opacity: PenColor["opacity"]): number {
    switch (opacity) {
      case "solid":
        return 1.0;
      case "translucent":
        return 0.5;
      case "transparent":
        return 0.0;
      case "flash":
        return 1.0; // Would need animation for proper flash
      default:
        return 1.0;
    }
  }

  /**
   * Get CSS for text edge effect
   */
  private getEdgeStyle(
    edgeType: PenAttributes["edgeType"],
    edgeColor: string,
  ): string {
    switch (edgeType) {
      case "raised":
        return `text-shadow: 1px 1px 0 ${edgeColor}, -1px -1px 0 ${edgeColor}`;
      case "depressed":
        return `text-shadow: -1px -1px 0 ${edgeColor}, 1px 1px 0 ${edgeColor}`;
      case "uniform":
        return `text-shadow: 
          -1px -1px 0 ${edgeColor},
          1px -1px 0 ${edgeColor},
          -1px 1px 0 ${edgeColor},
          1px 1px 0 ${edgeColor}`;
      case "drop_shadow":
        return `text-shadow: 2px 2px 3px ${edgeColor}`;
      case "none":
      default:
        return "";
    }
  }

  /**
   * Clear captions
   */
  public clear(): void {
    if (this.captionElement) {
      this.captionElement.innerHTML = "";
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: CaptionDecoderConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Destroy the renderer
   */
  public destroy(): void {
    if (this.captionElement?.parentNode) {
      this.captionElement.parentNode.removeChild(this.captionElement);
    }
    this.captionElement = null;
  }
}
