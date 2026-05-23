import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import type {
  DesignIntakeExtractResponse,
  DesignIntakeExtractSuccess,
} from "@/lib/designIntakeApiSchema";
import { resolveCanvasLogo } from "@/lib/logoCanvasPreference";
import {
  mapExtractApiResponseToIntake,
  type ExtractApiFormContext,
} from "@/lib/mapExtractApiResponseToIntake";

export type PreviewLogoSelectionMode = "auto" | "manual";

export const PREVIEW_LOGO_SELECTION_NOTE =
  "Preview-only selection; not part of the integration API response.";

export type ExtractApiPreviewBlock = {
  selectedLogoCandidateUrl: string;
  selectedLogoCandidate: LogoCandidate | null;
  logoSelectionMode: PreviewLogoSelectionMode;
  note: string;
};

/** Raw API response plus a preview-only block for /api-test UI state. */
export type ExtractApiPreviewJson = DesignIntakeExtractResponse & {
  preview: ExtractApiPreviewBlock;
};

export function resolveExtractApiPreviewLogoSelection(
  response: DesignIntakeExtractSuccess,
  form: ExtractApiFormContext,
  selectedPreviewLogoCandidateUrl: string,
): ExtractApiPreviewBlock {
  const manualUrl = selectedPreviewLogoCandidateUrl.trim();
  const logoCandidates = response.brand.logoCandidates ?? [];

  if (manualUrl) {
    return {
      selectedLogoCandidateUrl: manualUrl,
      selectedLogoCandidate:
        logoCandidates.find((candidate) => candidate.url === manualUrl) ?? null,
      logoSelectionMode: "manual",
      note: PREVIEW_LOGO_SELECTION_NOTE,
    };
  }

  const intake = mapExtractApiResponseToIntake(response, form, {
    selectedLogoUrl: "",
  });
  const canvasLogo = resolveCanvasLogo(intake);

  return {
    selectedLogoCandidateUrl: canvasLogo.url,
    selectedLogoCandidate: canvasLogo.candidate ?? null,
    logoSelectionMode: "auto",
    note: PREVIEW_LOGO_SELECTION_NOTE,
  };
}

export function buildExtractApiPreviewJson(
  response: DesignIntakeExtractResponse,
  preview: ExtractApiPreviewBlock,
): ExtractApiPreviewJson {
  return {
    ...response,
    preview,
  };
}
