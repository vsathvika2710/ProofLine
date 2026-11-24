export type ClaimStatus = 'supported' | 'contradicted' | 'outdated' | 'unsupported' | 'tone_issue' | 'accessibility';

export type ClaimCategory = 'numeric' | 'comparative' | 'ingredient_spec' | 'policy_terms' | 'superlative' | 'brand_language';

export type UserRole = 'brand_manager' | 'legal_compliance' | 'content_creator' | 'agency_reviewer';

export interface Fact {
  id: string;
  code: string; // e.g. "FACT-WTY-01"
  name: string;
  category: 'Product Specs' | 'Pricing & Policy' | 'Ingredients & Storage' | 'Brand Identity';
  currentValue: string;
  previousValue?: string;
  lastUpdated: string;
  version: string;
  owner: string;
  status: 'active' | 'superseded' | 'under_review';
  sourceDocId: string;
  sourceDocName: string;
  sourcePassage: string;
  effectiveDate: string;
  expiryDate: string;
  tags: string[];
}

export interface EvidenceDocument {
  id: string;
  title: string;
  docNumber: string;
  category: string;
  version: string;
  owner: string;
  approvedDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring_soon' | 'expired';
  summary: string;
  sections: {
    heading: string;
    text: string;
  }[];
}

export interface Claim {
  id: string;
  text: string;
  category: ClaimCategory;
  status: ClaimStatus;
  confidence: number; // 0 - 100
  matchedFactId?: string;
  matchedFactName?: string;
  expectedValue?: string;
  foundValue?: string;
  sourceCitation?: {
    documentName: string;
    passage: string;
    version: string;
  };
  explanation: string;
  suggestedCorrection: string;
  location?: {
    start: number;
    end: number;
  };
}

export interface ContentAsset {
  id: string;
  title: string;
  type: 'website_page' | 'sales_brochure' | 'instagram_post' | 'email_newsletter' | 'packaging_label' | 'support_faq';
  channel: string;
  urlOrPath: string;
  status: 'approved' | 'approval_invalidated' | 'under_review' | 'draft' | 'rejected' | 'revision_requested';
  lastScanned: string;
  content: string;
  linkedFactIds: string[];
  claimsCount: number;
  issuesCount: number;
  assignedReviewer: string;
  lastApprovedBy?: string;
  lastApprovedDate?: string;
}

export interface ChangeImpactResult {
  factId: string;
  factName: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  totalAssetsScanned: number;
  affectedAssets: {
    assetId: string;
    assetTitle: string;
    assetType: ContentAsset['type'];
    channel?: string;
    affectedClaims: {
      claimText: string;
      reason: string;
      suggestedFix: string;
    }[];
    impactSeverity: 'high' | 'medium' | 'low';
  }[];
  unaffectedAssets: {
    assetId: string;
    assetTitle: string;
    checkedReason: string;
  }[];
}

export interface ReviewTask {
  id: string;
  assetId: string;
  assetTitle: string;
  assetType: ContentAsset['type'];
  trigger: 'content_scan' | 'fact_change_cascade' | 'expiry_alert';
  triggerFactId?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  assignedRole: UserRole;
  createdAt: string;
  originalText: string;
  suggestedText: string;
  currentText: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  auditTrail: {
    action: string;
    by: string;
    role: string;
    timestamp: string;
    note?: string;
  }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: 'FACT_UPDATED' | 'IMPACT_EVALUATED' | 'APPROVAL_INVALIDATED' | 'CORRECTION_APPLIED' | 'CONTENT_APPROVED' | 'OVERRIDE_GRANTED' | 'ASSET_CREATED';
  target: string;
  details: string;
  factVersion?: string;
}

export interface ScenarioDataset {
  id: string;
  name: string;
  brand: string;
  tagline: string;
  description: string;
  facts: Fact[];
  documents: EvidenceDocument[];
  assets: ContentAsset[];
  sampleTexts: {
    id: string;
    title: string;
    type: string;
    text: string;
  }[];
}
