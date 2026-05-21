import { sampleDesignSpec } from "@/lib/designSpec";

const { width: CANVAS_W, height: CANVAS_H } = sampleDesignSpec.canvas;

/** Helper text for info tooltips on the main / editor (not guided /demo). */

export const HELP_DESIGN_INTAKE =
  "Enter the homepage URL first. Analysis can suggest identity, brand copy, and design content from a bounded site fetch.";

export const HELP_ANALYZE_WEBSITE =
  "Fetches the homepage and up to three same-origin pages (about, services, contact). Uses Claude when configured; otherwise mocked extraction for the prototype. Run after the URL looks correct.";

export const HELP_REVIEW_IDENTITY =
  "Confirm the business name designers should use on the concept.";

export const HELP_STYLE_SUGGESTION =
  "Illustrative guidance for the selected style: typical brand fit, layout direction, and copy tone. Not a final brand system.";

export const HELP_THEME_PREVIEW =
  "Swatches preview the style preference only. Final colors can still come from the customer brand.";

export const HELP_REVIEW_EXTRACTED =
  "Toggle rows and edit text. Checked items feed the design brief and canvas.";

export const HELP_DESIGN_BRIEF =
  "Updates live from the form. Refresh re-syncs brief text from your current selections.";

export const HELP_PAGE_INTRO =
  "Prototype editor: design intake through an editable Fabric canvas.";

export const HELP_CLAUDE_FALLBACK =
  "Claude-assisted homepage analysis when configured; mocked fallback when unavailable.";

export const HELP_DEV_TOOLS = `Export PNG, SVG, and JSON at full ${CANVAS_W}×${CANVAS_H}px canvas size. Load JSON from the textarea or a file, and inspect raw Fabric state below.`;

export const HELP_CONCEPT_PREVIEW =
  "Artboard preview scales to your screen. PNG/SVG/JSON exports stay at full resolution.";

export const HELP_GENERATE_CONCEPT =
  "Rebuilds the concept from intake data. Manual canvas edits persist until you generate again.";

export const HELP_DESIGN_SURFACES =
  "Select product components in Design intake. One surface is shown at a time for now.";

export const HELP_LOGO_CANDIDATES =
  "Candidates are scraped from the site and ranked for design use. Confirm or upload a production-quality logo before final print.";

export const HELP_TYPOGRAPHY_SIGNALS =
  "Fonts detected from static HTML/CSS are mapped to safe canvas fallbacks in the concept generator.";
