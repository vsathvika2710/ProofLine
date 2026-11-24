import { officeApiBase } from './officeAuth';

export type GuestClaimType =
  | 'warranty'
  | 'battery'
  | 'pricing'
  | 'performance'
  | 'specification'
  | 'comparative'
  | 'promotional'
  | 'other';

export type GuestVerificationStatus = 'supported' | 'contradicted' | 'unsupported' | 'inconclusive';
export type GuestEvidenceType = 'demonstration' | 'guest_provided' | 'office_approved';

export interface GuestProductInfo {
  name: string | null;
  brand: string | null;
  category: string | null;
  model: string | null;
  identification: 'identified' | 'uncertain';
}

export interface GuestClaim {
  id: string;
  text: string;
  normalized: string;
  claim_type: GuestClaimType;
}

export interface GuestExtractionResponse {
  input_method: 'text' | 'image' | 'pdf';
  source_text: string;
  product: GuestProductInfo;
  claims: GuestClaim[];
  extraction_notice: string;
}

export interface GuestProductInput {
  name: string | null;
  brand: string | null;
}

export interface GuestEvidenceItem {
  id: string;
  claim_id: string;
  source_type: GuestEvidenceType;
  source_title: string;
  passage: string;
  source_url: string | null;
  retrieved_at: string;
  relevance_score: number;
  topic: string;
}

export interface GuestClaimEvidence {
  claim_id: string;
  evidence: GuestEvidenceItem[];
}

export interface GuestEvidenceResponse {
  product_name: string | null;
  evidence_source_note: string;
  claims: GuestClaimEvidence[];
}

export interface GuestClaimFinding {
  claim_id: string;
  original_claim: string;
  normalized_claim: string;
  claim_type: GuestClaimType;
  status: GuestVerificationStatus;
  explanation: string;
  evidence: GuestEvidenceItem[];
  suggested_correction: string | null;
  limitation: string | null;
}

export interface GuestAssessmentResponse {
  product: GuestProductInput;
  input_method: 'text' | 'image' | 'pdf';
  findings: GuestClaimFinding[];
  evidence_source_note: string;
  assessed_at: string;
  processing_notice: string;
}

const API_BASE_URL = officeApiBase();
const REQUEST_TIMEOUT_MS = 30_000;

const requestJson = async <T>(path: string, init: RequestInit): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | T
      | null;
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string'
          ? payload.detail
          : `Guest verification request failed (${response.status}).`;
      throw new Error(message);
    }
    if (!payload) {
      throw new Error('The verification service returned an empty response.');
    }
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request took too long. Please try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the verification service. Check the connection and try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const extractGuestText = (text: string) =>
  requestJson<GuestExtractionResponse>('/api/guest/extract/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

export const extractGuestFile = (file: File) => {
  const body = new FormData();
  body.append('file', file);
  return requestJson<GuestExtractionResponse>('/api/guest/extract/file', {
    method: 'POST',
    body,
  });
};

const createGuestPayload = (
  product: GuestProductInput,
  claims: GuestClaim[],
  referenceText: string,
  inputMethod: 'text' | 'image' | 'pdf',
) => ({
  product,
  claims,
  reference_text: referenceText,
  input_method: inputMethod,
});

export const findGuestEvidence = (
  product: GuestProductInput,
  claims: GuestClaim[],
  referenceText: string,
  inputMethod: 'text' | 'image' | 'pdf',
) =>
  requestJson<GuestEvidenceResponse>('/api/guest/evidence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createGuestPayload(product, claims, referenceText, inputMethod)),
  });

export const assessGuestClaims = (
  product: GuestProductInput,
  claims: GuestClaim[],
  referenceText: string,
  inputMethod: 'text' | 'image' | 'pdf',
) =>
  requestJson<GuestAssessmentResponse>('/api/guest/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createGuestPayload(product, claims, referenceText, inputMethod)),
  });

