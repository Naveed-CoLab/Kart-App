// AG Studio theme for Kart. Every value points at Kart's own design tokens (app/globals.css), so the
// dashboard reads as part of the app: same font, ink, lines, PayPal blue and chart palette.
import { studioTheme } from "ag-studio";

const v = (name: string) => `var(--color-${name})`;
const line = (name: string) => ({ width: 1, color: v(name) });
const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";

// Kart's chart palette: PayPal blue first, then the dataviz tokens.
const PALETTE = ["#0070E0", "#EB6834", "#1BAF7A", "#EDA100", "#5B3CC4", "#003087", "#2CA6DF", "#C0362C", "#7A8699", "#0E8A5F"];
const palette = Object.fromEntries(
  PALETTE.flatMap((c, i) => [
    [`chartPaletteFills${i + 1}Color`, c],
    [`chartPaletteStrokes${i + 1}Color`, c],
  ]),
);

export const kartStudioTheme = studioTheme.withParams({
  fontFamily: FONT,
  fontSize: 14,
  textColor: v("ink"),
  foregroundColor: v("ink"),
  subtleTextColor: v("muted"),
  backgroundColor: v("surface"),
  borderColor: v("line"),
  accentColor: v("action"),
  iconColor: v("muted"),
  rowHoverColor: v("tint"),

  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: v("bg"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: v("bg"),
  studioCanvasPadding: 16,
  studioCanvasRowHeight: 18,
  studioCanvasFontFamily: FONT,

  // Widgets look like Kart's cards: white, 1px line, 14px radius.
  studioWidgetBackgroundColor: v("surface"),
  studioWidgetBorder: line("line"),
  studioWidgetBorderRadius: 14,
  studioWidgetPadding: 12,
  studioWidgetTitleFontFamily: FONT,
  studioWidgetTitleFontSize: 14,
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleTextColor: v("ink"),
  studioWidgetSubtitleFontFamily: FONT,
  studioWidgetSubtitleFontSize: 12.5,
  studioWidgetSubtitleTextColor: v("muted"),
  studioWidgetCaptionFontFamily: FONT,
  studioWidgetCaptionFontSize: 12,
  studioWidgetCaptionTextColor: v("subtle"),
  studioWidgetResizeBorderColor: v("action"),

  studioPanelContainerBackgroundColor: v("surface"),
  studioPanelContainerBorder: line("line"),
  studioPanelContainerBorderRadius: 0,
  studioPanelDividerColor: v("line"),
  studioPanelDividerActiveColor: v("action"),
  studioPanelSectionBorderColor: v("line"),
  studioPanelHeaderFontFamily: FONT,
  studioPanelHeaderFontWeight: 600,
  studioPanelChevronButtonHoverBackgroundColor: v("tint"),
  studioPanelChevronButtonHoverColor: v("action"),
  studioToggleButtonActiveBackgroundColor: v("tint"),
  studioToggleButtonActiveBorderColor: v("action"),
  studioToggleButtonActiveColor: v("action"),

  gridFontFamily: FONT,
  gridFontSize: 13,
  gridCellTextColor: v("ink"),
  gridHeaderBackgroundColor: v("surface"),
  gridHeaderTextColor: v("muted"),
  gridHeaderFontWeight: 600,
  gridHeaderFontSize: 12.5,
  gridRowHeight: 38,
  gridRowBorder: line("line"),
  gridHeaderRowBorder: line("line"),
  gridPinnedRowBorder: line("line"),
  gridRowHoverColor: v("tint"),
  gridWrapperBorder: false,

  chartFontFamily: FONT,
  chartTextColor: v("ink"),
  chartSubtleTextColor: v("muted"),
  chartAxisLineColor: v("line"),
  chartGridLineColor: v("grid"),
  ...palette,
});
