import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileText,
  ImagePlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  ScanText,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  assessGuestClaims,
  extractGuestFile,
  extractGuestText,
  findGuestEvidence,
  GuestAssessmentResponse,
  GuestClaim,
  GuestEvidenceResponse,
  GuestExtractionResponse,
  GuestProductInfo,
  GuestVerificationStatus,
} from '../../services/guestVerification';

type InputMethod = 'image' | 'text' | 'pdf';
type WorkflowStep = 'welcome' | 'input' | 'confirmation' | 'evidence' | 'results';
type ProcessingState = 'extracting' | 'finding-evidence' | 'assessing' | null;
type StatusFilter = 'all' | GuestVerificationStatus;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 20_000;
const PROGRESS_STEPS = ['Input', 'Extraction', 'Confirmation', 'Evidence', 'Assessment', 'Results'];

const STATUS_DETAILS: Record<
  GuestVerificationStatus,
  { label: string; icon: React.ElementType; color: string; panel: string }
> = {
  supported: {
    label: 'Supported',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    panel: 'border-emerald-500/25 bg-emerald-500/5',
  },
  contradicted: {
    label: 'Contradicted',
    icon: XCircle,
    color: 'text-red-400',
    panel: 'border-red-500/25 bg-red-500/5',
  },
  unsupported: {
    label: 'Unsupported',
    icon: CircleHelp,
    color: 'text-amber-400',
    panel: 'border-amber-500/25 bg-amber-500/5',
  },
  inconclusive: {
    label: 'Inconclusive',
    icon: CircleHelp,
    color: 'text-sky-400',
    panel: 'border-sky-500/25 bg-sky-500/5',
  },
};

const newClaimId = () =>
  `guest-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;

const formatFileSize = (size: number) =>
  size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

const inputLabel: Record<InputMethod, string> = {
  image: 'Product image',
  text: 'Pasted text',
  pdf: 'PDF document',
};

const getStepIndex = (step: WorkflowStep, processing: ProcessingState) => {
  if (processing === 'extracting') return 1;
  if (processing === 'finding-evidence') return 3;
  if (processing === 'assessing') return 4;
  if (step === 'input') return 0;
  if (step === 'confirmation') return 2;
  if (step === 'evidence') return 3;
  if (step === 'results') return 5;
  return -1;
};

export const GuestScanner: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WorkflowStep>('welcome');
  const [inputMethod, setInputMethod] = useState<InputMethod | null>(null);
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [product, setProduct] = useState<GuestProductInfo>({
    name: null,
    brand: null,
    category: null,
    model: null,
    identification: 'uncertain',
  });
  const [claims, setClaims] = useState<GuestClaim[]>([]);
  const [newClaimText, setNewClaimText] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [evidenceResponse, setEvidenceResponse] = useState<GuestEvidenceResponse | null>(null);
  const [assessment, setAssessment] = useState<GuestAssessmentResponse | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>(null);
  const [error, setError] = useState('');
  const [extractionNotice, setExtractionNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile || inputMethod !== 'image') {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile, inputMethod]);

  const activeProgressIndex = getStepIndex(step, processing);

  const startNewVerification = () => {
    setStep('welcome');
    setInputMethod(null);
    setTextInput('');
    setSelectedFile(null);
    setSourceText('');
    setProduct({ name: null, brand: null, category: null, model: null, identification: 'uncertain' });
    setClaims([]);
    setNewClaimText('');
    setReferenceText('');
    setEvidenceResponse(null);
    setAssessment(null);
    setProcessing(null);
    setError('');
    setExtractionNotice('');
    setStatusFilter('all');
    setExpandedClaimId(null);
  };

  const chooseInputMethod = (method: InputMethod) => {
    setInputMethod(method);
    setTextInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError('');
    setStep('input');
  };

  const handleFile = (file?: File) => {
    if (!file || !inputMethod || inputMethod === 'text') return;

    const rejectFile = (message: string) => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(message);
    };
    const allowed = inputMethod === 'pdf'
      ? file.name.toLowerCase().endsWith('.pdf')
      : /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!allowed) {
      rejectFile(inputMethod === 'pdf' ? 'Select a PDF document.' : 'Select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejectFile('The selected file is larger than the 8 MB limit.');
      return;
    }
    if (!file.size) {
      rejectFile('The selected file is empty.');
      return;
    }

    setError('');
    setSelectedFile(file);
  };

  const handleExtract = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setEvidenceResponse(null);
    setAssessment(null);

    if (!inputMethod) {
      setError('Choose an input method to continue.');
      return;
    }

    if (inputMethod === 'text') {
      const cleanText = textInput.trim();
      if (!cleanText) {
        setError('Paste product information or marketing claims before extracting.');
        return;
      }
      if (cleanText.length > MAX_TEXT_CHARACTERS) {
        setError('Text is too long. The maximum is 20,000 characters.');
        return;
      }
    } else if (!selectedFile) {
      setError(inputMethod === 'image' ? 'Select a product image first.' : 'Select a PDF first.');
      return;
    }

    setProcessing('extracting');
    try {
      let extracted: GuestExtractionResponse;
      if (inputMethod === 'text') {
        extracted = await extractGuestText(textInput.trim());
      } else if (selectedFile) {
        extracted = await extractGuestFile(selectedFile);
      } else {
        setError(inputMethod === 'image' ? 'Select a product image first.' : 'Select a PDF first.');
        return;
      }

      setSourceText(extracted.source_text);
      setProduct(extracted.product);
      setClaims(extracted.claims);
      setExtractionNotice(extracted.extraction_notice);
      setStep('confirmation');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Extraction failed. Try another input.');
    } finally {
      setProcessing(null);
    }
  };

  const updateClaim = (claimId: string, value: string) => {
    setClaims((previous) =>
      previous.map((claim) =>
        claim.id === claimId
          ? { ...claim, text: value, normalized: value.trim().replace(/\s+/g, ' ') }
          : claim,
      ),
    );
  };

  const addClaim = () => {
    const value = newClaimText.trim();
    if (!value) return;
    if (value.length > 1_000) {
      setError('Each claim must be 1,000 characters or fewer.');
      return;
    }
    if (claims.length >= 25) {
      setError('A verification can contain at most 25 claims.');
      return;
    }
    setClaims((previous) => [
      ...previous,
      { id: newClaimId(), text: value, normalized: value.replace(/\s+/g, ' '), claim_type: 'other' },
    ]);
    setNewClaimText('');
    setError('');
  };

  const continueToEvidence = () => {
    const validClaims = claims
      .map((claim) => ({
        ...claim,
        text: claim.text.trim(),
        normalized: claim.text.trim().replace(/\s+/g, ' '),
      }))
      .filter((claim) => claim.text.length > 0);

    if (!validClaims.length) {
      setError('Add at least one valid claim before searching for evidence.');
      return;
    }
    setClaims(validClaims);
    setError('');
    setEvidenceResponse(null);
    setAssessment(null);
    setStep('evidence');
  };

  const handleFindEvidence = async () => {
    if (!claims.length) return;
    setError('');
    setProcessing('finding-evidence');
    try {
      const result = await findGuestEvidence(
        { name: product.name, brand: product.brand },
        claims,
        referenceText.trim(),
        inputMethod || 'text',
      );
      setEvidenceResponse(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Evidence search failed. Please retry.');
    } finally {
      setProcessing(null);
    }
  };

  const handleAssess = async () => {
    if (!claims.length) return;
    setError('');
    setProcessing('assessing');
    try {
      const result = await assessGuestClaims(
        { name: product.name, brand: product.brand },
        claims,
        referenceText.trim(),
        inputMethod || 'text',
      );
      setAssessment(result);
      setStep('results');
      setStatusFilter('all');
      setExpandedClaimId(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Assessment failed. Please retry.');
    } finally {
      setProcessing(null);
    }
  };

  const counts = assessment
    ? assessment.findings.reduce(
        (total, finding) => ({ ...total, [finding.status]: total[finding.status] + 1 }),
        { supported: 0, contradicted: 0, unsupported: 0, inconclusive: 0 },
      )
    : { supported: 0, contradicted: 0, unsupported: 0, inconclusive: 0 };

  const visibleFindings =
    assessment?.findings.filter(
      (finding) => statusFilter === 'all' || finding.status === statusFilter,
    ) || [];

  const suppliedEvidenceCount =
    assessment?.findings.reduce((count, finding) => count + finding.evidence.length, 0) || 0;

  const handleErrorDismiss = () => setError('');

  return (
    <main className="entry-main min-h-screen px-4 pb-10 pt-20 sm:px-6 sm:pt-24 lg:px-8">
      <div className={`mx-auto ${step === 'results' ? 'max-w-5xl' : 'max-w-4xl'}`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (step === 'welcome' ? navigate('/') : setStep('welcome'))}
            className="inline-flex items-center gap-2 rounded-lg text-sm text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {step === 'welcome' ? 'Back to ProofLine' : 'Exit verification'}
          </button>
          {step !== 'welcome' && (
            <button
              type="button"
              onClick={startNewVerification}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              Start New
            </button>
          )}
        </div>

        {step !== 'welcome' && (
          <ProgressIndicator activeIndex={activeProgressIndex} />
        )}

        {error && (
          <div
            role="alert"
            className="form-error mb-5 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={handleErrorDismiss}
              aria-label="Dismiss error"
              className="shrink-0 rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 'welcome' && (
          <WelcomeStep onStart={() => setStep('input')} />
        )}

        {step === 'input' && !processing && (
          <InputStep
            inputMethod={inputMethod}
            textInput={textInput}
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            fileInputRef={fileInputRef}
            onChooseMethod={chooseInputMethod}
            onTextChange={setTextInput}
            onFile={handleFile}
            onRemoveFile={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            onExtract={handleExtract}
          />
        )}

        {processing && (
          <ProcessingPanel processing={processing} />
        )}

        {step === 'confirmation' && !processing && (
          <ConfirmationStep
            product={product}
            claims={claims}
            newClaimText={newClaimText}
            extractionNotice={extractionNotice}
            sourceText={sourceText}
            onProductChange={(key, value) =>
              setProduct((current) => ({ ...current, [key]: value || null }))
            }
            onClaimChange={updateClaim}
            onDeleteClaim={(claimId) =>
              setClaims((previous) => previous.filter((claim) => claim.id !== claimId))
            }
            onNewClaimChange={setNewClaimText}
            onAddClaim={addClaim}
            onBack={() => setStep('input')}
            onContinue={continueToEvidence}
          />
        )}

        {step === 'evidence' && !processing && (
          <EvidenceStep
            inputMethod={inputMethod || 'text'}
            productName={product.name}
            claims={claims}
            referenceText={referenceText}
            evidenceResponse={evidenceResponse}
            onReferenceChange={(value) => {
              setReferenceText(value);
              setEvidenceResponse(null);
            }}
            onBack={() => setStep('confirmation')}
            onFindEvidence={handleFindEvidence}
            onAssess={handleAssess}
          />
        )}

        {step === 'results' && assessment && !processing && (
          <ResultsStep
            assessment={assessment}
            inputMetadata={
              selectedFile
                ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`
                : `${sourceText.length.toLocaleString()} characters`
            }
            counts={counts}
            suppliedEvidenceCount={suppliedEvidenceCount}
            filter={statusFilter}
            visibleFindings={visibleFindings}
            expandedClaimId={expandedClaimId}
            onFilterChange={setStatusFilter}
            onToggleClaim={(claimId) =>
              setExpandedClaimId((current) => (current === claimId ? null : claimId))
            }
            onStartNew={startNewVerification}
            onBack={() => setStep('evidence')}
          />
        )}
      </div>
    </main>
  );
};

const ProgressIndicator: React.FC<{ activeIndex: number }> = ({ activeIndex }) => (
  <nav aria-label="Verification progress" className="mb-7 overflow-x-auto pb-1">
    <ol className="flex min-w-[610px] items-center">
      {PROGRESS_STEPS.map((label, index) => {
        const completed = index < activeIndex;
        const active = index === activeIndex;
        const compactLabel =
          label === 'Extraction' ? 'Extract'
            : label === 'Confirmation' ? 'Confirm'
              : label === 'Assessment' ? 'Assess'
                : label === 'Results' ? 'Result'
                  : label;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  completed
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : active
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-slate-700 bg-slate-900 text-slate-500'
                }`}
              >
                {completed ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={`text-[11px] font-medium ${active ? 'text-white' : 'text-slate-500'}`}>
                <span className="lg:hidden">{compactLabel}</span>
                <span className="hidden lg:inline">{label}</span>
              </span>
            </div>
            {index < PROGRESS_STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`mx-2 h-px flex-1 ${completed ? 'bg-blue-500/60' : 'bg-slate-700/70'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

const WelcomeStep: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <section className="portal-panel mx-auto max-w-[620px] rounded-2xl px-6 py-8 text-center sm:px-10 sm:py-10">
    <span className="portal-mark mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl">
      <ShieldCheck className="h-6 w-6" />
    </span>
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">
      Public verification workspace
    </p>
    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[30px]">
      Verify a Product
    </h1>
    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
      Analyze product information and marketing claims using available evidence.
    </p>
    <button
      type="button"
      onClick={onStart}
      className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      Start Verification
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </button>
    <p className="mt-5 text-[11px] text-slate-500">
      No account required. Guest submissions are not saved to the Office workspace.
    </p>
  </section>
);

interface InputStepProps {
  inputMethod: InputMethod | null;
  textInput: string;
  selectedFile: File | null;
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onChooseMethod: (method: InputMethod) => void;
  onTextChange: (text: string) => void;
  onFile: (file?: File) => void;
  onRemoveFile: () => void;
  onExtract: (event: React.FormEvent) => void;
}

const InputStep: React.FC<InputStepProps> = ({
  inputMethod,
  textInput,
  selectedFile,
  previewUrl,
  fileInputRef,
  onChooseMethod,
  onTextChange,
  onFile,
  onRemoveFile,
  onExtract,
}) => (
  <section>
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Step 1 · Input</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
        Choose an input method
      </h1>
      <p className="mt-1.5 text-sm text-slate-400">Start with a product image, pasted copy, or readable PDF.</p>
    </div>

    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <InputMethodCard
        selected={inputMethod === 'image'}
        icon={<ImagePlus className="h-4 w-4" />}
        title="Product image"
        detail="JPG, PNG, WEBP · max 8 MB"
        onClick={() => onChooseMethod('image')}
      />
      <InputMethodCard
        selected={inputMethod === 'text'}
        icon={<ScanText className="h-4 w-4" />}
        title="Paste claim or text"
        detail="Descriptions, ads, specifications"
        onClick={() => onChooseMethod('text')}
      />
      <InputMethodCard
        selected={inputMethod === 'pdf'}
        icon={<FileText className="h-4 w-4" />}
        title="Upload PDF"
        detail="Text-based PDFs · max 8 MB"
        onClick={() => onChooseMethod('pdf')}
      />
    </div>

    <form onSubmit={onExtract} className="portal-panel rounded-2xl p-5 sm:p-6">
      {!inputMethod && (
        <div className="rounded-xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-500">
          Select an input method above to continue.
        </div>
      )}

      {inputMethod === 'text' && (
        <div>
          <label htmlFor="guest-product-text" className="mb-2 block text-sm font-semibold text-slate-200">
            Product description or marketing copy
          </label>
          <textarea
            id="guest-product-text"
            value={textInput}
            onChange={(event) => onTextChange(event.target.value)}
            maxLength={MAX_TEXT_CHARACTERS}
            rows={7}
            placeholder="Example: NovaWear SmartWatch X provides 48 hours of battery life and includes a 3-year warranty."
            className="entry-field w-full resize-y rounded-xl px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            aria-describedby="guest-text-limit"
          />
          <div id="guest-text-limit" className="mt-1.5 flex justify-between text-[11px] text-slate-500">
            <span>Text is processed for this session and not stored.</span>
            <span>{textInput.length.toLocaleString()} / {MAX_TEXT_CHARACTERS.toLocaleString()}</span>
          </div>
        </div>
      )}

      {(inputMethod === 'image' || inputMethod === 'pdf') && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={inputMethod === 'image' ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp' : 'application/pdf,.pdf'}
            className="sr-only"
            aria-label={inputMethod === 'image' ? 'Choose product image' : 'Choose PDF'}
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          {!selectedFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onFile(event.dataTransfer.files[0]);
              }}
              className="flex min-h-48 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-900/30 px-5 py-8 text-center transition-colors hover:border-blue-500/60 hover:bg-blue-500/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Upload className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-200">
                Drop your {inputMethod === 'image' ? 'image' : 'PDF'} here or browse files
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {inputMethod === 'image' ? 'JPG, JPEG, PNG, WEBP · up to 8 MB' : 'PDF · up to 8 MB'}
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-700/80 bg-slate-900/30 p-4 sm:flex-row sm:items-center">
              {inputMethod === 'image' && previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected product preview"
                  className="h-32 w-full rounded-lg border border-slate-700 object-contain bg-slate-950/60 sm:w-40"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <FileText className="h-7 w-7" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-semibold text-slate-200">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatFileSize(selectedFile.size)} · {inputLabel[inputMethod]}
                </p>
                {inputMethod === 'image' && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    If server-side Gemini is configured, this image is sent to Google for extraction. If not, the service will say so.
                  </p>
                )}
                {inputMethod === 'pdf' && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Text-based PDFs only. Scanned pages are not OCR-processed.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={onRemoveFile}
                  aria-label="Remove selected file"
                  className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-red-500/40 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-5 flex flex-col-reverse justify-between gap-3 border-t border-slate-700/60 pt-4 sm:flex-row sm:items-center">
        <p className="text-[11px] leading-relaxed text-slate-500">
          No information is added to the private Office Evidence Vault.
        </p>
        <button
          type="submit"
          disabled={!inputMethod}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Extract Product + Claims
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </form>
  </section>
);

interface InputMethodCardProps {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}

const InputMethodCard: React.FC<InputMethodCardProps> = ({ selected, icon, title, detail, onClick }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      selected
        ? 'border-blue-500/50 bg-blue-500/[0.07]'
        : 'border-slate-700/80 bg-slate-900/35 hover:border-slate-600 hover:bg-slate-900/60'
    }`}
  >
    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block text-xs font-semibold text-slate-200">{title}</span>
      <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{detail}</span>
    </span>
  </button>
);

const ProcessingPanel: React.FC<{ processing: Exclude<ProcessingState, null> }> = ({ processing }) => {
  const content = {
    extracting: {
      title: 'Extracting product and claims',
      description: 'Reading your input and preparing details for your review.',
    },
    'finding-evidence': {
      title: 'Finding available evidence',
      description: 'Searching only the public demonstration collection and guest-provided references.',
    },
    assessing: {
      title: 'Assessing confirmed claims',
      description: 'Comparing claims against retrieved evidence. No private Office data is used.',
    },
  }[processing];

  return (
    <section className="portal-panel rounded-2xl px-6 py-12 text-center sm:py-16" role="status" aria-live="polite">
      <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-blue-500" />
      <h2 className="mt-5 text-base font-semibold text-white">{content.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">{content.description}</p>
      <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
      </div>
    </section>
  );
};

interface ConfirmationStepProps {
  product: GuestProductInfo;
  claims: GuestClaim[];
  newClaimText: string;
  extractionNotice: string;
  sourceText: string;
  onProductChange: (key: 'name' | 'brand' | 'category' | 'model', value: string) => void;
  onClaimChange: (id: string, value: string) => void;
  onDeleteClaim: (id: string) => void;
  onNewClaimChange: (value: string) => void;
  onAddClaim: () => void;
  onBack: () => void;
  onContinue: () => void;
}

const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  product,
  claims,
  newClaimText,
  extractionNotice,
  sourceText,
  onProductChange,
  onClaimChange,
  onDeleteClaim,
  onNewClaimChange,
  onAddClaim,
  onBack,
  onContinue,
}) => (
  <section>
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Step 3 · Confirmation</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
        Confirm product and claims
      </h1>
      <p className="mt-1.5 text-sm text-slate-400">
        Review and correct the extraction. Nothing is assessed until you continue.
      </p>
    </div>

    {product.identification === 'uncertain' && (
      <div className="form-notice mb-4 rounded-xl px-4 py-3 text-xs leading-relaxed">
        Product identification was uncertain. Product details below are editable, and no missing attributes were inferred.
      </div>
    )}

    <div className="portal-panel rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-white">Product information</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EditableField label="Product name" value={product.name || ''} onChange={(value) => onProductChange('name', value)} />
        <EditableField label="Brand" value={product.brand || ''} onChange={(value) => onProductChange('brand', value)} />
        <EditableField label="Category" value={product.category || ''} onChange={(value) => onProductChange('category', value)} />
        <EditableField label="Model / variant" value={product.model || ''} onChange={(value) => onProductChange('model', value)} />
      </div>
    </div>

    <div className="portal-panel mt-4 rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Extracted claims</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Edit claim wording, remove mistakes, or add any that were missed.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-400">
          {claims.filter((claim) => claim.text.trim()).length} claims
        </span>
      </div>

      {sourceText && (
        <details className="mb-4 rounded-xl border border-slate-700/70 bg-slate-900/25 px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-medium text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            Review extracted source text
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-400">{sourceText}</p>
        </details>
      )}

      {claims.length ? (
        <ul className="space-y-2.5">
          {claims.map((claim, index) => (
            <li key={claim.id} className="flex items-start gap-3 rounded-xl border border-slate-700/70 bg-slate-900/20 p-3">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-400">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <textarea
                  aria-label={`Claim ${index + 1}`}
                  value={claim.text}
                  onChange={(event) => onClaimChange(claim.id, event.target.value)}
                  rows={2}
                  maxLength={1_000}
                  className="entry-field w-full resize-y rounded-lg px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <span className="mt-1 inline-block rounded-md bg-slate-800/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                  {claim.claim_type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDeleteClaim(claim.id)}
                aria-label={`Remove claim ${index + 1}`}
                className="mt-1 rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-300">No claims were extracted.</p>
          <p className="mt-1 text-xs text-slate-500">Add claims below to continue, or go back and provide more context.</p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={newClaimText}
          onChange={(event) => onNewClaimChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onAddClaim();
          }}
          maxLength={1_000}
          aria-label="Add a missing claim"
          placeholder="Add a claim that was missed"
          className="entry-field min-h-10 min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        />
        <button
          type="button"
          onClick={onAddClaim}
          disabled={!newClaimText.trim() || claims.length >= 25}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Add claim
        </button>
      </div>
    </div>

    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{extractionNotice}</p>

    <div className="mt-5 flex flex-col-reverse justify-between gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Input
      </button>
      <button
        type="button"
        onClick={onContinue}
        disabled={!claims.some((claim) => claim.text.trim())}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        Confirm and Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  </section>
);

const EditableField: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <label className="block text-xs font-medium text-slate-400">
    {label}
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="entry-field mt-1.5 min-h-10 w-full rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
    />
  </label>
);

interface EvidenceStepProps {
  inputMethod: InputMethod;
  productName: string | null;
  claims: GuestClaim[];
  referenceText: string;
  evidenceResponse: GuestEvidenceResponse | null;
  onReferenceChange: (value: string) => void;
  onBack: () => void;
  onFindEvidence: () => void;
  onAssess: () => void;
}

const EvidenceStep: React.FC<EvidenceStepProps> = ({
  inputMethod,
  productName,
  claims,
  referenceText,
  evidenceResponse,
  onReferenceChange,
  onBack,
  onFindEvidence,
  onAssess,
}) => {
  const evidenceByClaim = new Map(
    (evidenceResponse?.claims || []).map((entry) => [entry.claim_id, entry.evidence]),
  );

  return (
    <section>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Step 4 · Evidence</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">Find available evidence</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {productName ? `Evidence related to ${productName}.` : 'Evidence related to the confirmed claims.'}
        </p>
      </div>

      <div className="form-notice mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs leading-relaxed">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Guest searches use only a clearly labeled fictional public demo collection and the reference text you provide.
          No Office Vault or live web search is used.
        </span>
      </div>

      <div className="portal-panel rounded-2xl p-5 sm:p-6">
        <label htmlFor="guest-reference" className="mb-2 block text-sm font-semibold text-slate-200">
          Add a reference fact (optional)
        </label>
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Paste an approved source passage you are allowed to share. It is processed for this request only and is not stored.
        </p>
        <textarea
          id="guest-reference"
          value={referenceText}
          onChange={(event) => onReferenceChange(event.target.value)}
          maxLength={10_000}
          rows={4}
          placeholder="Example: The product warranty lasts 2 years from the purchase date."
          className="entry-field w-full resize-y rounded-xl px-3.5 py-3 text-sm leading-relaxed outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        />
        <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
          <span>Maximum 10,000 characters</span>
          <span>{referenceText.length.toLocaleString()} / 10,000</span>
        </div>
        <div className="mt-4 flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Confirmation
          </button>
          <button
            type="button"
            onClick={onFindEvidence}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ScanText className="h-4 w-4" />
            Find Available Evidence
          </button>
        </div>
      </div>

      {evidenceResponse && (
        <div className="portal-panel mt-4 rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">Evidence search complete</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{evidenceResponse.evidence_source_note}</p>
            </div>
          </div>
          <ul className="space-y-3">
            {claims.map((claim, index) => {
              const items = evidenceByClaim.get(claim.id) || [];
              return (
                <li key={claim.id} className="rounded-xl border border-slate-700/70 bg-slate-900/20 p-3.5">
                  <p className="text-xs font-semibold leading-relaxed text-slate-200">
                    <span className="mr-1.5 text-slate-500">{index + 1}.</span>{claim.text}
                  </p>
                  {items.length ? (
                    <ul className="mt-3 space-y-2">
                      {items.map((item) => (
                        <li key={`${claim.id}-${item.id}-${item.source_type}`} className="border-l-2 border-blue-500/40 pl-3">
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-semibold text-blue-400">
                              {item.source_type === 'demonstration' ? 'Public demonstration evidence · fictional' : 'Guest-provided reference'}
                            </span>
                            <span className="text-slate-500">{item.source_title}</span>
                            <span className="text-slate-500" title="Text relevance, not source reliability">
                              Relevance {Math.round(item.relevance_score * 100)}%
                            </span>
                          </div>
                          <blockquote className="mt-1.5 text-xs leading-relaxed text-slate-300">
                            “{item.passage}”
                          </blockquote>
                          {item.source_url && (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-[11px] text-blue-400 underline underline-offset-2"
                            >
                              View source
                            </a>
                          )}
                          <p className="mt-1 text-[10px] text-slate-500">
                            Retrieved {new Date(item.retrieved_at).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-amber-400">
                      No relevant permitted evidence was found for this claim.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onAssess}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Assess Claims
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

interface ResultsStepProps {
  assessment: GuestAssessmentResponse;
  inputMetadata: string;
  counts: Record<GuestVerificationStatus, number>;
  suppliedEvidenceCount: number;
  filter: StatusFilter;
  visibleFindings: GuestAssessmentResponse['findings'];
  expandedClaimId: string | null;
  onFilterChange: (filter: StatusFilter) => void;
  onToggleClaim: (id: string) => void;
  onStartNew: () => void;
  onBack: () => void;
}

const ResultsStep: React.FC<ResultsStepProps> = ({
  assessment,
  inputMetadata,
  counts,
  suppliedEvidenceCount,
  filter,
  visibleFindings,
  expandedClaimId,
  onFilterChange,
  onToggleClaim,
  onStartNew,
  onBack,
}) => {
  const statusFilters: StatusFilter[] = ['all', 'supported', 'contradicted', 'unsupported', 'inconclusive'];
  const summary =
    counts.contradicted > 0
      ? 'One or more claims conflict with the available evidence. Review the cited passages and suggested wording.'
      : counts.unsupported > 0
        ? 'Some claims have no matching evidence in the permitted sources. This does not establish that they are false.'
        : counts.inconclusive > 0
          ? 'Some claims need additional context or review before a reliable determination can be made.'
          : 'All assessed claims matched the available evidence. This is a demonstration comparison, not a certification.';

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Step 6 · Results</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">Verification summary</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {assessment.product.name || 'Product not identified'}
            {assessment.product.brand ? ` · ${assessment.product.brand}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Start New Verification
        </button>
      </div>

      <div className="portal-panel rounded-2xl p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Verification overview</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{summary}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
          <span>{assessment.findings.length} claims analyzed</span>
          <span>{suppliedEvidenceCount} evidence passages returned</span>
          <span>Input: {inputLabel[assessment.input_method]} · {inputMetadata}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {(['supported', 'contradicted', 'unsupported', 'inconclusive'] as const).map((status) => {
          const Icon = STATUS_DETAILS[status].icon;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onFilterChange(filter === status ? 'all' : status)}
              aria-pressed={filter === status}
              className={`portal-panel rounded-xl p-3 text-left transition-colors hover:border-blue-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                filter === status ? 'ring-1 ring-blue-500/50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-400">{STATUS_DETAILS[status].label}</span>
                <Icon className={`h-4 w-4 ${STATUS_DETAILS[status].color}`} />
              </div>
              <span className={`mt-1 block text-2xl font-bold ${STATUS_DETAILS[status].color}`}>{counts[status]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Claim details and evidence</h2>
          <div className="flex flex-wrap gap-1.5" aria-label="Filter claims by verification status">
            {statusFilters.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={filter === status}
                onClick={() => onFilterChange(status)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {status === 'all' ? 'All' : STATUS_DETAILS[status].label}
              </button>
            ))}
          </div>
        </div>

        {visibleFindings.length ? (
          <ul className="space-y-2.5">
            {visibleFindings.map((finding, index) => {
              const details = STATUS_DETAILS[finding.status];
              const Icon = details.icon;
              const expanded = expandedClaimId === finding.claim_id;
              return (
                <li key={finding.claim_id} className="portal-panel overflow-hidden rounded-xl">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => onToggleClaim(finding.claim_id)}
                    className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${details.color}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-200">{finding.original_claim}</span>
                      <span className={`mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide ${details.color}`}>
                        {details.label}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="border-t border-slate-700/70 px-4 pb-4 pt-3 sm:pl-12">
                      <div className={`rounded-lg border p-3 ${details.panel}`}>
                        <p className="text-xs leading-relaxed text-slate-200">{finding.explanation}</p>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <DetailValue label="Normalized claim" value={finding.normalized_claim} />
                        <DetailValue label="Claim type" value={finding.claim_type} />
                      </div>
                      <div className="mt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Relevant evidence</p>
                        {finding.evidence.length ? (
                          <ul className="mt-2 space-y-2">
                            {finding.evidence.map((item) => (
                              <li key={`${finding.claim_id}-${item.id}-${item.source_type}`} className="rounded-lg border border-slate-700/70 bg-slate-900/20 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-semibold text-blue-400">
                                    {item.source_type === 'demonstration' ? 'Fictional public demonstration' : 'Guest-provided'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{item.source_title}</span>
                                </div>
                                <blockquote className="mt-1.5 text-xs leading-relaxed text-slate-300">
                                  “{item.passage}”
                                </blockquote>
                                {item.source_url && (
                                  <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-blue-400 underline">
                                    Open source
                                  </a>
                                )}
                                <p className="mt-1 text-[10px] text-slate-500">
                                  {item.source_type === 'guest_provided' ? 'Provided by the guest' : 'Synthetic demonstration source'} · Retrieved {new Date(item.retrieved_at).toLocaleString()}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">
                            No evidence passage is available. The status does not mean the claim is false.
                          </p>
                        )}
                      </div>
                      {finding.suggested_correction && (
                        <div className="mt-3">
                          <DetailValue label="Evidence-based wording to consider" value={finding.suggested_correction} />
                        </div>
                      )}
                      {finding.limitation && (
                        <div className="mt-3 rounded-lg border border-slate-700/70 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Limitation</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">{finding.limitation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="portal-panel rounded-xl px-4 py-8 text-center text-sm text-slate-500">
            No claims match this filter.
          </div>
        )}
      </div>

      <div className="form-notice mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed">
        {assessment.evidence_source_note} {assessment.processing_notice}
      </div>
      <p className="mt-2 text-right text-[10px] text-slate-500">
        Assessed {new Date(assessment.assessed_at).toLocaleString()}
      </p>

      <div className="mt-5 flex justify-start">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Evidence
        </button>
      </div>
    </section>
  );
};

const DetailValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-1 break-words text-xs leading-relaxed text-slate-300">{value}</p>
  </div>
);

