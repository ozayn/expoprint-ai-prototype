export type ParsedScoreSummary = {
  filename: string;
  inputFile: string;
  totalRows: number;
  rowsWithOverallScore: number;
  rowsMissingOverallScore: number;
  reviewerNotesNonEmptyCount: number;
  extractionSuccessCount: number;
  extractionFailedCount: number;
  averages: Record<string, string>;
  statusCounts: Record<string, number>;
  topReviewerNotes: string[];
};
