import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  AlertCircle,
  Bell,
  ChevronRight,
  Clock3,
  FilePlus2,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  Search,
  Send,
  Shield,
  Sparkles,
  UserCircle2,
  X,
} from 'lucide-react';
import { ThemeSelector } from '../ThemeSelector';
import {
  GuestAssessmentResponse,
  GuestClaim,
  GuestClaimType,
  GuestProductInfo,
  assessGuestClaims,
  extractGuestFile,
  extractGuestText,
} from '../../services/guestVerification';
import {
  EvaluationDemoAsset,
  EvaluationDemoEvent,
  EvaluationDemoRequestError,
  getEvaluationDemoSessionStatus,
  listEvaluationDemoContent,
  restartEvaluationDemoSession,
  saveEvaluationDemoContent,
  subscribeEvaluationDemoSessionStatus,
  submitEvaluationDemoContent,
} from '../../services/evaluationDemoWorkspace';
import {
  listOfficeCreatorWorkspace,
  saveOfficeContent,
  scanOfficeClaims,
  submitOfficeContentAsset,
} from '../../services/officeWorkspace';
import { WorkspaceNotice } from '../WorkspaceNotice';

type CreatorPage =
  | 'overview'
  | 'studio'
  | 'scanner'
  | 'results'
  | 'content'
  | 'submissions'
  | 'history'
  | 'notifications';

interface CreatorWorkspaceProps {
  publicDemo: boolean;
  organizationLabel: string;
  canSwitchWorkspace?: boolean;
  availableOfficeRoles?: Array<'creator' | 'reviewer' | 'admin'>;
  onSwitchWorkspace?: (workspace: 'admin' | 'creator' | 'reviewer') => void;
  onLogout?: () => void | Promise<void>;
}

const navigation: Array<{ id: CreatorPage; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { id: 'studio', label: 'Content Studio', icon: <FilePlus2 size={17} /> },
  { id: 'scanner', label: 'Claim Scanner', icon: <ScanSearch size={17} /> },
  { id: 'results', label: 'Verification Results', icon: <Shield size={17} /> },
  { id: 'content', label: 'My Content', icon: <FileText size={17} /> },
  { id: 'submissions', label: 'Submissions', icon: <Send size={17} /> },
  { id: 'history', label: 'Revision History', icon: <History size={17} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={17} /> },
];

const titles: Record<CreatorPage, string> = {
  overview: 'Content Overview',
  studio: 'Content Studio',
  scanner: 'Claim Scanner',
  results: 'Verification Results',
  content: 'My Content',
  submissions: 'Submissions',
  history: 'Revision History',
  notifications: 'Notifications',
};

const defaultProduct: GuestProductInfo = {
  name: 'NovaWear SmartWatch X',
  brand: 'NovaWear',
  category: 'Smartwatch',
  model: 'X',
  identification: 'identified',
};

const claimCategories: Array<{ value: GuestClaimType; label: string }> = [
  { value: 'specification', label: 'Numeric / product specification' },
  { value: 'comparative', label: 'Comparative' },
  { value: 'warranty', label: 'Policy or warranty' },
  { value: 'promotional', label: 'Superlative / promotional' },
  { value: 'battery', label: 'Battery' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'performance', label: 'Performance' },
  { value: 'other', label: 'Brand language / other' },
];

const surface = 'rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface)]';
const inputClass = 'w-full rounded-lg border border-[var(--pl-border)] bg-[var(--pl-input)] px-3 py-2 text-sm text-[var(--pl-text)] outline-none focus:border-blue-500';

const statusClass = (status: string) => {
  if (status === 'supported' || status === 'approved') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'contradicted' || status === 'revision_requested') return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  if (status === 'in_review') return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  if (status === 'unsupported' || status === 'inconclusive') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
};

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const CreatorWorkspace: React.FC<CreatorWorkspaceProps> = ({
  publicDemo,
  organizationLabel,
  canSwitchWorkspace = false,
  availableOfficeRoles = [],
  onSwitchWorkspace,
  onLogout,
}) => {
  const evaluationSessionStatus = useSyncExternalStore(
    subscribeEvaluationDemoSessionStatus,
    getEvaluationDemoSessionStatus,
    getEvaluationDemoSessionStatus,
  );
  const [page, setPage] = useState<CreatorPage>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [assets, setAssets] = useState<EvaluationDemoAsset[]>([]);
  const [events, setEvents] = useState<EvaluationDemoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restartingDemo, setRestartingDemo] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [inputMethod, setInputMethod] = useState<'text' | 'image' | 'pdf'>('text');
  const [product, setProduct] = useState<GuestProductInfo>(publicDemo ? defaultProduct : {
    name: null,
    brand: null,
    category: null,
    model: null,
    identification: 'uncertain',
  });
  const [claims, setClaims] = useState<GuestClaim[]>([]);
  const [assessment, setAssessment] = useState<GuestAssessmentResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const previewUrl = useMemo(
    () => selectedFile ? URL.createObjectURL(selectedFile) : '',
    [selectedFile],
  );
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const workspace = publicDemo
        ? await listEvaluationDemoContent()
        : await listOfficeCreatorWorkspace();
      setAssets(workspace.assets);
      setEvents(workspace.events);
    } catch (cause) {
      setError(publicDemo
        ? cause instanceof EvaluationDemoRequestError ? cause.message : 'Could not load the Evaluation Creator workspace. Try again.'
        : cause instanceof Error ? cause.message : 'Could not load the Office Creator workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [publicDemo]);

  const restartDemo = async () => {
    if (restartingDemo) return;
    setRestartingDemo(true);
    setError('');
    try {
      await restartEvaluationDemoSession();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The demo could not be restarted. Try again.');
    } finally {
      setRestartingDemo(false);
    }
  };

  const changePage = (nextPage: CreatorPage) => {
    setPage(nextPage);
    setMobileOpen(false);
    setError('');
  };

  const clearDraft = () => {
    setCurrentId(undefined);
    setTitle('');
    setDescription('');
    setSourceText('');
    setInputMethod('text');
    setProduct(defaultProduct);
    setClaims([]);
    setAssessment(null);
    setSelectedFile(null);
    setError('');
  };

  const openDraft = (asset: EvaluationDemoAsset) => {
    setCurrentId(asset.id);
    setTitle(asset.title);
    setDescription(asset.description);
    setSourceText(asset.source_text);
    setInputMethod(asset.input_method);
    setProduct(asset.product);
    setClaims(asset.claims);
    setAssessment(asset.assessment);
    setSelectedFile(null);
    changePage('studio');
  };

  const handleExtract = async () => {
    if (!publicDemo && selectedFile) {
      setError('Office claim scanning currently supports pasted text only. Clear the uploaded file and paste the content to scan.');
      return;
    }
    setSaving(true);
    setError('');
    setAssessment(null);
    try {
      if (publicDemo) {
        const result = selectedFile
          ? await extractGuestFile(selectedFile)
          : await extractGuestText(sourceText);
        setSourceText(result.source_text);
        setInputMethod(result.input_method);
        setProduct(result.product.name || result.product.brand ? result.product : defaultProduct);
        setClaims(result.claims);
      } else {
        const result = await scanOfficeClaims(sourceText);
        setAssessment(result);
        setClaims(result.findings.map((finding) => ({
          id: finding.claim_id,
          text: finding.original_claim,
          normalized: finding.normalized_claim,
          claim_type: finding.claim_type,
        })));
        setInputMethod('text');
      }
      setPage('scanner');
    } catch (cause) {
      setError(publicDemo
        ? 'Claim extraction failed. Check the content and try again.'
        : cause instanceof Error ? cause.message : 'Claim extraction failed. Check the content and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!claims.length) {
      setError('Extract or add at least one claim before verification.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = publicDemo
        ? await assessGuestClaims(
          { name: product.name, brand: product.brand },
          claims,
          '',
          inputMethod,
        )
        : await scanOfficeClaims(sourceText);
      setAssessment(result);
      setPage('results');
    } catch (cause) {
      setError(publicDemo
        ? 'Evidence verification failed. Please retry.'
        : cause instanceof Error ? cause.message : 'Evidence verification failed. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async (): Promise<EvaluationDemoAsset | null> => {
    if (!title.trim()) {
      setError('Enter a content title before saving.');
      return null;
    }
    if (!sourceText.trim() && (publicDemo ? !claims.length : true)) {
      setError('Add content text or confirmed claims before saving.');
      return null;
    }
    setSaving(true);
    setError('');
    try {
      const asset = publicDemo
        ? await saveEvaluationDemoContent({
          id: currentId,
          title,
          description,
          source_text: sourceText,
          input_method: inputMethod,
          product,
          claims,
          assessment,
        })
        : await saveOfficeContent({
          id: currentId,
          title,
          assetType: 'website_page',
          channel: description || 'Office',
          rawText: sourceText,
        });
      setCurrentId(asset.id);
      await reload();
      return asset;
    } catch (cause) {
      setError(publicDemo
        ? cause instanceof EvaluationDemoRequestError ? cause.message : 'Draft could not be saved. Please try again.'
        : cause instanceof Error ? cause.message : 'Draft could not be saved.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (asset?: EvaluationDemoAsset) => {
    const targetAssessment = asset?.assessment ?? assessment;
    const targetClaims = asset?.claims ?? claims;
    if (publicDemo && (!targetAssessment || !targetClaims.length)) {
      setError('Verify at least one confirmed claim before submitting for review.');
      return;
    }
    const saved = asset || await saveDraft();
    if (!saved) return;
    setSaving(true);
    setError('');
    try {
      if (publicDemo) {
        await submitEvaluationDemoContent(saved.id);
      } else {
        await submitOfficeContentAsset(saved.id);
      }
      await reload();
      changePage('submissions');
    } catch (cause) {
      setError(publicDemo
        ? cause instanceof EvaluationDemoRequestError ? cause.message : 'Submission failed. The Reviewer Queue was not changed.'
        : cause instanceof Error ? cause.message : 'Submission failed. The Reviewer Queue was not changed.');
    } finally {
      setSaving(false);
    }
  };

  const startNew = () => {
    clearDraft();
    changePage('studio');
  };

  const recentAssessment = assets.find((asset) => asset.assessment)?.assessment;
  const filteredAssets = assets.filter((asset) =>
    `${asset.title} ${asset.description}`.toLowerCase().includes(search.toLowerCase()),
  );

  const overview = (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Content Overview</h2>
        <p className="mt-1 text-sm text-[var(--pl-muted)]">Manage your content, verification results and submissions.</p>
        <p className="mt-2 text-xs text-[var(--pl-muted)]">{publicDemo ? 'Fictional NovaWear Demo · session-isolated data' : 'Organization-scoped Office content and review data.'}</p>
      </header>
          <section aria-label="Content overview metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['My Assets', assets.length],
              ['Drafts', assets.filter((asset) => asset.approval_status === 'draft').length],
              ['In Review', assets.filter((asset) => asset.approval_status === 'in_review').length],
              ['Approved', assets.filter((asset) => asset.approval_status === 'approved').length],
            ].map(([label, value]) => (
              <div key={label} className={`${surface} p-4`}>
                <p className="text-sm text-[var(--pl-muted)]">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-[10px] text-[var(--pl-muted)]">{publicDemo ? 'Fictional demo data' : 'Organization data'}</p>
              </div>
            ))}
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className={`${surface} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Recent Content</h3>
                <button type="button" onClick={() => changePage('content')} className="text-xs font-medium text-blue-600">View all</button>
              </div>
              {assets.length ? <div className="divide-y divide-[var(--pl-border)]">
                {assets.slice(0, 4).map((asset) => (
                  <button key={asset.id} type="button" onClick={() => openDraft(asset)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{asset.title}</span><span className="text-xs text-[var(--pl-muted)]">Version {asset.version} · {dateLabel(asset.updated_at)}</span></span>
                    <StatusBadge status={asset.approval_status} />
                  </button>
                ))}
              </div> : <EmptyState text="No content has been created yet." />}
            </section>
            <section className={`${surface} p-4`}>
              <h3 className="text-sm font-semibold">Pending Revisions</h3>
              <div className="mt-3 space-y-2">
                {assets.filter((asset) => asset.approval_status === 'revision_requested').map((asset) => (
                  <button key={asset.id} type="button" onClick={() => openDraft(asset)} className="flex w-full items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-left text-sm">
                    <AlertCircle size={16} className="shrink-0 text-amber-600" /><span className="truncate">{asset.title}</span><ChevronRight size={15} className="ml-auto" />
                  </button>
                ))}
                {!assets.some((asset) => asset.approval_status === 'revision_requested') && <EmptyState text="No revision requests are pending." />}
              </div>
            </section>
          </div>
          <section className={`${surface} p-4`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Recent Verification Results</h3>
              <button type="button" onClick={() => changePage('results')} className="text-xs font-medium text-blue-600">Open results</button>
            </div>
            {recentAssessment ? <FindingList assessment={recentAssessment} compact /> : <EmptyState text={publicDemo ? 'Verification results appear after a content claim is checked against the public fictional evidence collection.' : 'Verification results appear after content is scanned against organization-approved evidence.'} />}
          </section>
          <button type="button" onClick={startNew} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><FilePlus2 size={16} />Create New Content</button>
    </div>
  );

  const editor = (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">{currentId ? 'Edit Content Draft' : 'Prepare Content'}</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">{publicDemo ? 'Extract claims, review them, and verify against fictional demonstration evidence.' : 'Prepare content and scan claims against organization-approved facts and evidence.'}</p></div>
        {currentId && <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-[var(--pl-muted)]">Draft {currentId.slice(-8)}</span>}
      </header>
      <section className={`${surface} space-y-4 p-4 sm:p-5`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium">Content title<input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Content title" maxLength={160} /></label>
          <label className="space-y-1.5 text-xs font-medium">Description<input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional context" maxLength={1000} /></label>
        </div>
        {publicDemo && <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium">Product name<input className={inputClass} value={product.name || ''} onChange={(event) => setProduct((previous) => ({ ...previous, name: event.target.value || null }))} maxLength={160} /></label>
          <label className="space-y-1.5 text-xs font-medium">Brand<input className={inputClass} value={product.brand || ''} onChange={(event) => setProduct((previous) => ({ ...previous, brand: event.target.value || null }))} maxLength={100} /></label>
        </div>}
        <label className="block space-y-1.5 text-xs font-medium">Paste content text
          <textarea className={`${inputClass} min-h-40 resize-y leading-6`} value={sourceText} onChange={(event) => { setSourceText(event.target.value); setInputMethod('text'); setSelectedFile(null); setClaims([]); setAssessment(null); }} placeholder="Paste campaign copy, product text or a draft to analyze..." maxLength={20000} />
          <span className="block text-right text-[11px] font-normal text-[var(--pl-muted)]">{sourceText.length.toLocaleString()} / 20,000 characters</span>
        </label>
        <div className="rounded-lg border border-dashed border-[var(--pl-border)] p-3">
          <label className="block text-xs font-medium">{publicDemo ? 'Or upload a JPG, PNG, WEBP image or PDF (maximum 8 MB)' : 'Office claim scanning currently supports pasted text'}
            <input disabled={!publicDemo} className="mt-2 block w-full text-sm text-[var(--pl-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white disabled:opacity-50" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (!file) return;
              const extension = file.name.split('.').pop()?.toLowerCase();
              if (file.size > 8 * 1024 * 1024 || !['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(extension || '')) {
                setSelectedFile(null);
                setError(file.size > 8 * 1024 * 1024 ? 'Files must be 8 MB or smaller.' : 'Choose a JPG, JPEG, PNG, WEBP image or PDF.');
                event.target.value = '';
                return;
              }
              setError('');
              setSelectedFile(file);
              setSourceText('');
              setClaims([]);
              setAssessment(null);
              setInputMethod(extension === 'pdf' ? 'pdf' : 'image');
            }} />
          </label>
          {selectedFile && <div className="mt-3 flex items-center gap-3 text-xs text-[var(--pl-muted)]">
            {selectedFile.type.startsWith('image/') ? <img src={previewUrl} alt="Selected product content preview" className="h-16 w-16 rounded-md border border-[var(--pl-border)] object-cover" /> : <FileText size={24} />}
            <span>{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>}
          {publicDemo && <p className="mt-2 text-[11px] text-[var(--pl-muted)]">PDF text is extracted on the server; scanned PDFs are not OCR-processed. Image analysis requires the server's image-analysis configuration. The uploaded file itself is not retained.</p>}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[var(--pl-border)] pt-4">
          <button type="button" onClick={() => void handleExtract()} disabled={saving || (!selectedFile && !sourceText.trim())} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Sparkles size={15} />{saving ? 'Processing…' : publicDemo ? 'Extract Claims' : 'Scan Claims'}</button>
          <button type="button" onClick={() => void saveDraft()} disabled={saving} className="rounded-lg border border-[var(--pl-border)] px-3.5 py-2 text-sm font-medium disabled:opacity-50">Save Draft</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={saving || (publicDemo ? !assessment : (!title.trim() || !sourceText.trim()))} className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3.5 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/30"><Send size={15} />Submit for Review</button>
          <button type="button" onClick={clearDraft} className="ml-auto rounded-lg px-3 py-2 text-sm text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)]">Clear</button>
        </div>
      </section>
    </div>
  );

  const scanner = (
    <div className="space-y-4">
      <header><h2 className="text-2xl font-semibold tracking-tight">Claim Scanner</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">{publicDemo ? 'Confirm, edit or remove extracted claims before checking the fictional evidence collection.' : 'Review extracted claims and organization-scoped verification results.'}</p></header>
      {claims.length ? <section className={`${surface} divide-y divide-[var(--pl-border)]`}>
        {claims.map((claim, index) => <div key={claim.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-start">
          <label className="space-y-1 text-xs font-medium">Claim {index + 1}<textarea className={`${inputClass} min-h-16 resize-y`} value={claim.text} maxLength={1000} onChange={(event) => { setClaims((previous) => previous.map((item) => item.id === claim.id ? { ...item, text: event.target.value, normalized: event.target.value } : item)); setAssessment(null); }} /></label>
          <label className="space-y-1 text-xs font-medium">Category<select className={inputClass} value={claim.claim_type} onChange={(event) => setClaims((previous) => previous.map((item) => item.id === claim.id ? { ...item, claim_type: event.target.value as GuestClaimType } : item))}>{claimCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          <button type="button" onClick={() => { setClaims((previous) => previous.filter((item) => item.id !== claim.id)); setAssessment(null); }} className="mt-5 rounded-md px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-500/10">Remove</button>
        </div>)}
      </section> : <section className={`${surface} p-5`}><EmptyState text="No extracted claims. Add or paste content in Content Studio and run extraction; nothing is invented when extraction returns no claims." /><button type="button" onClick={() => changePage('studio')} className="mt-3 text-sm font-medium text-blue-600">Open Content Studio</button></section>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleVerify()} disabled={saving || !claims.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Verifying…' : 'Verify Confirmed Claims'}</button>
        <button type="button" onClick={() => void saveDraft()} disabled={saving} className="rounded-lg border border-[var(--pl-border)] px-4 py-2 text-sm font-medium disabled:opacity-50">Save Draft</button>
      </div>
      {!!assets.length && <p className="text-xs text-[var(--pl-muted)]">{publicDemo ? 'Evidence matching uses only the public fictional demonstration collection, never the Office Evidence Vault.' : 'Evidence matching uses only organization-scoped approved facts and evidence.'}</p>}
    </div>
  );

  const contentList = (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">My Content</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">Search drafts, verification results and submission status.</p></div><button type="button" onClick={startNew} className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white">New Content</button></header>
      <section className={`${surface} overflow-hidden`}>
        <div className="border-b border-[var(--pl-border)] p-3"><label className="relative block"><Search size={15} className="absolute left-3 top-2.5 text-[var(--pl-muted)]" /><input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or description" /></label></div>
        {filteredAssets.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-[var(--pl-surface-raised)] text-xs text-[var(--pl-muted)]"><tr><th className="px-4 py-3">Content</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Approval</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Last modified</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-[var(--pl-border)]">{filteredAssets.map((asset) => <tr key={asset.id}><td className="px-4 py-3"><p className="font-medium">{asset.title}</p><p className="text-xs text-[var(--pl-muted)]">{asset.description || '—'}</p></td><td className="px-4 py-3 capitalize">{publicDemo ? asset.input_method : asset.description || 'Office'}</td><td className="px-4 py-3"><StatusBadge status={asset.assessment ? 'verified' : 'not verified'} /></td><td className="px-4 py-3"><StatusBadge status={asset.approval_status} /></td><td className="px-4 py-3 tabular-nums">v{asset.version}</td><td className="px-4 py-3 text-xs text-[var(--pl-muted)]">{dateLabel(asset.created_at)}</td><td className="px-4 py-3 text-xs text-[var(--pl-muted)]">{dateLabel(asset.updated_at)}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openDraft(asset)} disabled={!['draft', 'revision_requested', 'rejected'].includes(asset.approval_status)} className="text-xs font-medium text-blue-600 disabled:opacity-40">Edit draft</button><button type="button" onClick={() => { openDraft(asset); changePage(asset.assessment ? 'results' : 'scanner'); }} className="text-xs font-medium text-blue-600">Inspect</button><button type="button" onClick={() => void handleSubmit(asset)} disabled={(publicDemo && !asset.assessment) || !['draft', 'revision_requested'].includes(asset.approval_status) || saving} className="text-xs font-medium text-blue-600 disabled:opacity-40">Submit</button><button type="button" onClick={() => changePage('history')} className="text-xs font-medium text-blue-600">History</button></div></td></tr>)}</tbody></table></div> : <EmptyState text={search ? 'No matching content.' : 'No content has been saved yet.'} />}
      </section>
    </div>
  );

  const resultsView = (
    <div className="space-y-4">
      <header><h2 className="text-2xl font-semibold tracking-tight">Verification Results</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">{publicDemo ? 'Results are based on the configured fictional demonstration evidence source.' : 'Results are based on this organization’s approved facts and evidence.'}</p></header>
      {assessment ? <section className={`${surface} p-4 sm:p-5`}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">{title || 'Current content'}</h3><p className="mt-1 text-xs text-[var(--pl-muted)]">{assessment.evidence_source_note}</p></div><button type="button" onClick={() => changePage('studio')} className="rounded-lg border border-[var(--pl-border)] px-3 py-2 text-xs font-medium">Revise and recheck</button></div><FindingList assessment={assessment} /></section>
        : <section className={`${surface} p-5`}><EmptyState text="No verification result is selected. Verify claims in the Content Studio or open a saved asset." /><button type="button" onClick={() => changePage('studio')} className="mt-3 text-sm font-medium text-blue-600">Open Content Studio</button></section>}
    </div>
  );

  const submissionsView = (
    <div className="space-y-4"><header><h2 className="text-2xl font-semibold tracking-tight">Submissions</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">{publicDemo ? 'Items submitted to the isolated Evaluation Reviewer Queue.' : 'Items submitted to the organization-scoped Reviewer Queue.'}</p></header>
      <section className={`${surface} divide-y divide-[var(--pl-border)]`}>
        {assets.filter((asset) => asset.review_task_id || asset.approval_status !== 'draft').map((asset) => <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-medium">{asset.title}</p><p className="mt-1 text-xs text-[var(--pl-muted)]">Version {asset.version} · Updated {dateLabel(asset.updated_at)}</p></div><StatusBadge status={asset.approval_status} /></div>)}
        {!assets.some((asset) => asset.review_task_id || asset.approval_status !== 'draft') && <EmptyState text="No submissions yet. Submit a draft for review to see it here." />}
      </section>
    </div>
  );

  const historyView = (
    <div className="space-y-4"><header><h2 className="text-2xl font-semibold tracking-tight">Revision History</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">{publicDemo ? 'Saved versions of demo content drafts and their verification outcomes.' : 'Previous content versions and approval history for this organization.'}</p></header>
      <section className={`${surface} divide-y divide-[var(--pl-border)]`}>
        {assets.flatMap((asset) => asset.revision_history.map((revision) => ({ ...revision, assetTitle: asset.title, assetId: asset.id }))).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((revision) => <div key={`${revision.assetId}-${revision.version}`} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-medium">{revision.assetTitle} · version {revision.version}</p><p className="mt-1 line-clamp-2 text-xs text-[var(--pl-muted)]">{revision.source_text || 'No extracted text'}</p><p className="mt-1 text-xs text-[var(--pl-muted)]">{revision.author} · {dateLabel(revision.updated_at)}</p></div><div className="flex flex-wrap gap-1.5"><StatusBadge status={revision.assessment ? 'verified' : 'unverified'} /><StatusBadge status={revision.approval_status} /></div></div>)}
        {!assets.some((asset) => asset.revision_history.length) && <EmptyState text="A version is recorded when an existing draft is saved again." />}
      </section>
    </div>
  );

  const notificationsView = (
    <div className="space-y-4"><header><h2 className="text-2xl font-semibold tracking-tight">Notifications</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">{publicDemo ? 'Session events recorded by the demonstration workflow.' : 'Office workflow events for this organization.'}</p></header>
      <section className={`${surface} divide-y divide-[var(--pl-border)]`}>
        {events.map((event) => <div key={event.id} className="flex gap-3 p-4"><Bell size={16} className="mt-0.5 shrink-0 text-blue-600" /><div className="min-w-0"><p className="text-sm font-medium">{event.title}</p><p className="mt-1 text-xs text-[var(--pl-muted)]">{event.details}</p><time className="mt-1 block text-[11px] text-[var(--pl-muted)]">{dateLabel(event.timestamp)}</time></div></div>)}
        {!events.length && <EmptyState text="No workflow events are recorded yet." />}
      </section>
    </div>
  );

  const content = (() => {
    switch (page) {
      case 'overview': return overview;
      case 'studio': return editor;
      case 'scanner': return scanner;
      case 'results': return resultsView;
      case 'content': return contentList;
      case 'submissions': return submissionsView;
      case 'history': return historyView;
      case 'notifications': return notificationsView;
    }
  })();

  return (
    <div className="admin-workspace creator-workspace flex min-h-screen bg-[var(--pl-app-bg)] text-[var(--pl-text)]">
      {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--pl-border)] bg-[var(--pl-sidebar)] transition-all md:sticky md:top-0 md:h-screen ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${collapsed ? 'w-[76px]' : 'w-64'}`}>
        <div className="flex h-[68px] items-center justify-between border-b border-[var(--pl-border)] px-4">
          <div className={`flex min-w-0 items-center gap-2.5 ${collapsed ? 'md:justify-center' : ''}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"><Shield size={18} /></span>{!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold">ProofLine</p><p className="truncate text-[11px] text-[var(--pl-muted)]">{organizationLabel}</p></div>}</div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-md p-1.5 text-[var(--pl-muted)] md:hidden"><X size={18} /></button>
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden rounded-md p-1.5 text-[var(--pl-muted)] md:inline-flex">{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
        </div>
        {!collapsed && <div className="px-4 pb-3 pt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--pl-muted)]">Content Creator</p></div>}
        <nav aria-label="Content Creator navigation" className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {navigation.map((item) => <button key={item.id} type="button" title={collapsed ? item.label : undefined} onClick={() => changePage(item.id)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors ${page === item.id ? 'bg-blue-600/10 font-medium text-blue-700 dark:text-blue-300' : 'text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)] hover:text-[var(--pl-text)]'} ${collapsed ? 'md:justify-center md:px-0' : ''}`}><span className="shrink-0">{item.icon}</span>{!collapsed && <span className="truncate">{item.label}</span>}</button>)}
        </nav>
        {!collapsed && <div className="border-t border-[var(--pl-border)] p-3"><div className="rounded-lg bg-[var(--pl-surface-raised)] p-2.5"><p className="text-xs font-medium">Workspace active</p><p className="mt-0.5 text-[10px] text-[var(--pl-muted)]">{publicDemo ? 'Isolated demo session' : 'Organization-scoped Office data'}</p></div></div>}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-[var(--pl-border)] bg-[var(--pl-surface)] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-md p-2 text-[var(--pl-muted)] md:hidden"><Menu size={19} /></button><div className="min-w-0"><h1 className="truncate text-sm font-semibold sm:text-base">{titles[page]}</h1><p className="truncate text-xs text-[var(--pl-muted)]">{organizationLabel}</p></div></div>
          <div className="flex items-center gap-2 sm:gap-3"><button type="button" onClick={() => changePage('notifications')} aria-label="Open notifications" className="relative rounded-lg border border-[var(--pl-border)] p-2 text-[var(--pl-muted)]"><Bell size={17} />{events.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] text-white">{Math.min(events.length, 99)}</span>}</button><ThemeSelector compact /><span className="hidden items-center gap-1.5 rounded-lg border border-[var(--pl-border)] px-2.5 py-2 text-xs font-medium sm:inline-flex"><Shield size={14} className="text-blue-600" /> Content Creator</span>{(publicDemo || canSwitchWorkspace) && onSwitchWorkspace && <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--pl-border)] px-2.5 py-2 text-xs font-medium"><span className="hidden sm:inline">Switch Workspace</span><select aria-label={publicDemo ? 'Switch Evaluation workspace' : 'Switch authorized Office workspace'} value="creator" onChange={(event) => onSwitchWorkspace(event.target.value as 'admin' | 'creator' | 'reviewer')} className="max-w-36 cursor-pointer bg-transparent text-xs outline-none">{(publicDemo ? ['admin', 'creator', 'reviewer'] : availableOfficeRoles).map((role) => <option key={role} value={role}>{role === 'creator' ? 'Content Creator' : role === 'admin' ? 'Admin' : 'Reviewer'}</option>)}</select></label>}<div className="relative"><button type="button" aria-expanded={userMenuOpen} aria-label="Open user menu" onClick={() => setUserMenuOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--pl-border)] px-2.5 py-2 text-xs font-medium"><UserCircle2 size={16} /><span className="hidden sm:inline">{publicDemo ? 'Demo Visitor' : 'Creator'}</span></button>{userMenuOpen && <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-52 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface)] p-2 shadow-lg"><p className="px-2 py-2 text-xs text-[var(--pl-muted)]">{publicDemo ? 'Anonymous Evaluation session' : 'Database-assigned Content Creator'}</p>{onLogout && <button type="button" role="menuitem" onClick={() => { setUserMenuOpen(false); void onLogout(); }} className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-[var(--pl-surface-raised)]">Sign out</button>}</div>}</div></div>
        </header>
        <main className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6 lg:p-8">
          <div className={`flex items-start gap-2 rounded-lg border px-3.5 py-3 text-xs ${publicDemo ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200'}`}>
            <Shield size={15} className="mt-0.5 shrink-0" /><p>{publicDemo ? 'Public demonstration mode · fictional NovaWear data is isolated to this anonymous server session and expires automatically.' : 'Office content, claim scans and review submissions are scoped to your authorized organization.'}</p>
          </div>
          {publicDemo && evaluationSessionStatus === 'restoring' && <WorkspaceNotice tone="info">Restoring the Evaluation demo session…</WorkspaceNotice>}
          {publicDemo && evaluationSessionStatus === 'expired' && <WorkspaceNotice
            tone="warning"
            action={<button type="button" disabled={restartingDemo} onClick={() => void restartDemo()} className="font-semibold underline disabled:opacity-60">{restartingDemo ? 'Restarting…' : 'Restart Demo'}</button>}
          >
            <p>This demo session could not be recovered. Restarting starts a new session; previous demo changes may be lost.</p>
            {error && <p className="mt-1">{error}</p>}
          </WorkspaceNotice>}
          {error && !(publicDemo && evaluationSessionStatus === 'expired') && <WorkspaceNotice
            tone="warning"
            onDismiss={() => setError('')}
          >
            {error}
          </WorkspaceNotice>}
          {loading ? <div className={`${surface} p-8 text-center text-sm text-[var(--pl-muted)]`}><Clock3 className="mx-auto mb-2 animate-pulse" size={20} />{publicDemo && evaluationSessionStatus === 'restoring' ? 'Restoring Evaluation demo session…' : 'Loading workspace…'}</div> : content}
        </main>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusClass(status)}`}>{status.replaceAll('_', ' ')}</span>;

const EmptyState: React.FC<{ text: string }> = ({ text }) => <p className="py-5 text-sm text-[var(--pl-muted)]">{text}</p>;

const FindingList: React.FC<{ assessment: GuestAssessmentResponse; compact?: boolean }> = ({ assessment, compact = false }) => (
  <div className="space-y-3">
    {assessment.findings.map((finding) => <article key={finding.claim_id} className="rounded-lg border border-[var(--pl-border)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="max-w-3xl text-sm font-medium">{finding.original_claim}</p><StatusBadge status={finding.status} /></div>
      <p className="mt-2 text-xs leading-5 text-[var(--pl-muted)]">{finding.explanation}</p>
      {!compact && finding.evidence.length > 0 && <div className="mt-3 space-y-2">{finding.evidence.map((evidence) => <div key={evidence.id} className="rounded-md bg-[var(--pl-surface-raised)] p-2.5"><p className="text-xs font-semibold">{evidence.source_title} · {evidence.source_type === 'demonstration' ? 'Fictional demo evidence' : 'Creator-provided reference'}</p><p className="mt-1 text-xs leading-5 text-[var(--pl-muted)]">“{evidence.passage}”</p><p className="mt-1 text-[10px] text-[var(--pl-muted)]">Evidence version is not supplied by the public demo evidence source.</p></div>)}</div>}
      {!compact && finding.evidence.length === 0 && <p className="mt-3 rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">No approved demonstration evidence found for this claim.</p>}
      {finding.suggested_correction && <p className="mt-2 text-xs"><span className="font-semibold">Suggested correction: </span>{finding.suggested_correction}</p>}
      {finding.limitation && <p className="mt-2 text-[11px] text-[var(--pl-muted)]">{finding.limitation}</p>}
    </article>)}
    {!assessment.findings.length && <EmptyState text="No findings were returned. No claims are fabricated when extraction or verification yields none." />}
    <p className="text-[11px] leading-5 text-[var(--pl-muted)]">{assessment.evidence_source_note} {assessment.processing_notice}</p>
  </div>
);
