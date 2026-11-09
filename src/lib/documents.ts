interface DocumentLinks {
  sourcePdfUrl?: string | null;
  contractAgreementUrl?: string | null;
  noticeToProceedUrl?: string | null;
  noticeOfAwardUrl?: string | null;
}

/**
 * Best link to the official contract document for a project.
 * Prefers direct DPWH document links; falls back to our document proxy route.
 */
export function getDocumentUrl(projectId: string, doc?: DocumentLinks | null): string {
  const direct =
    doc?.contractAgreementUrl ||
    doc?.noticeToProceedUrl ||
    doc?.noticeOfAwardUrl ||
    (doc?.sourcePdfUrl?.startsWith('http') && !doc.sourcePdfUrl.includes('dpwh.gov.ph')
      ? doc.sourcePdfUrl
      : null);
  return direct || `/api/projects/${encodeURIComponent(projectId)}/document`;
}
