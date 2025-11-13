/**
 * Caption Renderer Tests
 */

import { CaptionRenderer } from "../CaptionRenderer";
import type { DecodedCaption } from "../CEA708Decoder";

describe("CaptionRenderer", () => {
  let container: HTMLDivElement;
  let renderer: CaptionRenderer;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    document.body.appendChild(container);

    renderer = new CaptionRenderer({ container });
  });

  afterEach(() => {
    renderer.destroy();
    document.body.removeChild(container);
  });

  describe("Initialization", () => {
    it("should create caption overlay in container", () => {
      const overlay = container.querySelector(".cea708-caption-overlay");
      expect(overlay).not.toBeNull();
      expect(overlay?.parentElement).toBe(container);
    });

    it("should set container to relative positioning", () => {
      expect(container.style.position).toBe("relative");
    });

    it("should initialize with default config", () => {
      expect(renderer).toBeDefined();
    });

    it("should initialize with custom config", () => {
      const customRenderer = new CaptionRenderer({
        container,
        config: {
          fontSize: 24,
          backgroundColor: "rgba(0,0,0,0.9)",
          textColor: "yellow",
        },
      });

      expect(customRenderer).toBeDefined();
      customRenderer.destroy();
    });
  });

  describe("Caption Rendering", () => {
    it("should render simple text caption", () => {
      const caption = createTestCaption("Hello World");
      renderer.render(caption);

      const overlay = container.querySelector(".cea708-caption-overlay");
      expect(overlay?.textContent).toContain("Hello World");
    });

    it("should render multiple text segments", () => {
      const caption = createTestCaptionWithMultipleSegments([
        "First line",
        "Second line",
      ]);
      renderer.render(caption);

      const overlay = container.querySelector(".cea708-caption-overlay");
      const spans = overlay?.querySelectorAll(".cea708-text");

      expect(spans?.length).toBe(2);
      expect(spans?.[0]?.textContent).toBe("First line");
      expect(spans?.[1]?.textContent).toBe("Second line");
    });

    it("should apply text styling", () => {
      const caption = createTestCaptionWithStyling("Styled Text", {
        italics: true,
        underline: true,
      });
      renderer.render(caption);

      const overlay = container.querySelector(".cea708-caption-overlay");
      const span = overlay?.querySelector(".cea708-text") as HTMLElement;

      expect(span?.style.fontStyle).toBe("italic");
      expect(span?.style.textDecoration).toContain("underline");
    });

    it("should apply foreground color", () => {
      const caption = createTestCaptionWithColor("Colored Text", {
        foregroundColor: { red: 255, green: 0, blue: 0, opacity: "solid" },
      });
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.color).toBeTruthy();
    });

    it("should apply background color", () => {
      const caption = createTestCaptionWithColor("Background Text", {
        backgroundColor: { red: 0, green: 0, blue: 255, opacity: "solid" },
      });
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.backgroundColor).toBeTruthy();
    });

    it("should apply font size", () => {
      const caption = createTestCaptionWithPenSize("Large Text", "large");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontSize).toBeTruthy();
    });

    it("should apply edge effects", () => {
      const caption = createTestCaptionWithEdge("Shadow Text", "drop_shadow");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.textShadow).toBeTruthy();
    });

    it("should handle superscript offset", () => {
      const caption = createTestCaptionWithOffset("Superscript", "superscript");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.verticalAlign).toBe("super");
    });

    it("should handle subscript offset", () => {
      const caption = createTestCaptionWithOffset("Subscript", "subscript");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.verticalAlign).toBe("sub");
    });
  });

  describe("Font Families", () => {
    it("should apply monospaced serif font", () => {
      const caption = createTestCaptionWithFont("Text", "mono_serif");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontFamily).toContain("Courier");
    });

    it("should apply proportional serif font", () => {
      const caption = createTestCaptionWithFont("Text", "prop_serif");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontFamily).toContain("Georgia");
    });

    it("should apply monospaced sans-serif font", () => {
      const caption = createTestCaptionWithFont("Text", "mono_sans");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontFamily).toBeTruthy();
    });

    it("should apply proportional sans-serif font", () => {
      const caption = createTestCaptionWithFont("Text", "prop_sans");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontFamily).toContain("Arial");
    });

    it("should apply casual font", () => {
      const caption = createTestCaptionWithFont("Text", "casual");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontFamily).toBeTruthy();
    });

    it("should apply cursive font", () => {
      const caption = createTestCaptionWithFont("Text", "cursive");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontFamily).toBeTruthy();
    });

    it("should apply small caps", () => {
      const caption = createTestCaptionWithFont("Text", "small_caps");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontVariant).toBe("small-caps");
    });
  });

  describe("Configuration", () => {
    it("should update configuration", () => {
      renderer.updateConfig({ fontSize: 30 });
      const caption = createTestCaption("Test");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.fontSize).toContain("30");
    });

    it("should override default colors", () => {
      renderer.updateConfig({
        textColor: "red",
        backgroundColor: "blue",
      });

      const caption = createTestCaption("Test");
      renderer.render(caption);

      const span = container.querySelector(".cea708-text") as HTMLElement;
      expect(span?.style.color).toBe("red");
      expect(span?.style.backgroundColor).toBe("blue");
    });

    it("should apply window opacity", () => {
      renderer.updateConfig({ windowOpacity: 0.5 });
      const caption = createTestCaption("Test");
      renderer.render(caption);

      const overlay = container.querySelector(
        ".cea708-caption-overlay",
      ) as HTMLElement;
      expect(overlay?.style.opacity).toBe("0.5");
    });
  });

  describe("Clearing", () => {
    it("should clear captions", () => {
      const caption = createTestCaption("Test");
      renderer.render(caption);

      expect(container.querySelector(".cea708-text")).not.toBeNull();

      renderer.clear();

      expect(container.querySelector(".cea708-text")).toBeNull();
    });

    it("should handle clearing when no captions rendered", () => {
      expect(() => renderer.clear()).not.toThrow();
    });
  });

  describe("Destruction", () => {
    it("should remove overlay element", () => {
      expect(container.querySelector(".cea708-caption-overlay")).not.toBeNull();

      renderer.destroy();

      expect(container.querySelector(".cea708-caption-overlay")).toBeNull();
    });

    it("should handle multiple destroy calls", () => {
      renderer.destroy();
      expect(() => renderer.destroy()).not.toThrow();
    });
  });
});

/**
 * Helper function to create a test caption
 */
function createTestCaption(text: string): DecodedCaption {
  return {
    serviceNumber: 1,
    windows: new Map(),
    currentWindow: 0,
    text: [
      {
        text,
        penAttributes: {
          penSize: "standard",
          fontStyle: "default",
          textTag: 0,
          offset: "normal",
          italics: false,
          underline: false,
          edgeType: "none",
        },
        foregroundColor: { red: 255, green: 255, blue: 255, opacity: "solid" },
        backgroundColor: { red: 0, green: 0, blue: 0, opacity: "solid" },
        edgeColor: { red: 0, green: 0, blue: 0, opacity: "solid" },
      },
    ],
  };
}

/**
 * Helper function to create a caption with multiple segments
 */
function createTestCaptionWithMultipleSegments(
  segments: string[],
): DecodedCaption {
  return {
    serviceNumber: 1,
    windows: new Map(),
    currentWindow: 0,
    text: segments.map((text) => ({
      text,
      penAttributes: {
        penSize: "standard",
        fontStyle: "default",
        textTag: 0,
        offset: "normal",
        italics: false,
        underline: false,
        edgeType: "none",
      },
      foregroundColor: { red: 255, green: 255, blue: 255, opacity: "solid" },
      backgroundColor: { red: 0, green: 0, blue: 0, opacity: "solid" },
      edgeColor: { red: 0, green: 0, blue: 0, opacity: "solid" },
    })),
  };
}

/**
 * Helper function to create a caption with styling
 */
function createTestCaptionWithStyling(
  text: string,
  styling: { italics?: boolean; underline?: boolean },
): DecodedCaption {
  const caption = createTestCaption(text);
  if (caption.text[0]) {
    caption.text[0].penAttributes.italics = styling.italics ?? false;
    caption.text[0].penAttributes.underline = styling.underline ?? false;
  }
  return caption;
}

/**
 * Helper function to create a caption with color
 */
function createTestCaptionWithColor(
  text: string,
  colors: {
    foregroundColor?: {
      red: number;
      green: number;
      blue: number;
      opacity: "solid" | "flash" | "translucent" | "transparent";
    };
    backgroundColor?: {
      red: number;
      green: number;
      blue: number;
      opacity: "solid" | "flash" | "translucent" | "transparent";
    };
  },
): DecodedCaption {
  const caption = createTestCaption(text);
  if (caption.text[0]) {
    if (colors.foregroundColor) {
      caption.text[0].foregroundColor = colors.foregroundColor;
    }
    if (colors.backgroundColor) {
      caption.text[0].backgroundColor = colors.backgroundColor;
    }
  }
  return caption;
}

/**
 * Helper function to create a caption with pen size
 */
function createTestCaptionWithPenSize(
  text: string,
  penSize: "small" | "standard" | "large",
): DecodedCaption {
  const caption = createTestCaption(text);
  if (caption.text[0]) {
    caption.text[0].penAttributes.penSize = penSize;
  }
  return caption;
}

/**
 * Helper function to create a caption with edge effect
 */
function createTestCaptionWithEdge(
  text: string,
  edgeType: "none" | "raised" | "depressed" | "uniform" | "drop_shadow",
): DecodedCaption {
  const caption = createTestCaption(text);
  if (caption.text[0]) {
    caption.text[0].penAttributes.edgeType = edgeType;
  }
  return caption;
}

/**
 * Helper function to create a caption with offset
 */
function createTestCaptionWithOffset(
  text: string,
  offset: "subscript" | "normal" | "superscript",
): DecodedCaption {
  const caption = createTestCaption(text);
  if (caption.text[0]) {
    caption.text[0].penAttributes.offset = offset;
  }
  return caption;
}

/**
 * Helper function to create a caption with font
 */
function createTestCaptionWithFont(
  text: string,
  fontStyle:
    | "default"
    | "mono_serif"
    | "prop_serif"
    | "mono_sans"
    | "prop_sans"
    | "casual"
    | "cursive"
    | "small_caps",
): DecodedCaption {
  const caption = createTestCaption(text);
  if (caption.text[0]) {
    caption.text[0].penAttributes.fontStyle = fontStyle;
  }
  return caption;
}
