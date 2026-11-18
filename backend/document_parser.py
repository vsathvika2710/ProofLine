import os
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Tuple

# Try PyMuPDF
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

# Try python-docx
try:
    import docx
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text using PyMuPDF if available, with a resilient fallback."""
    if HAS_PYMUPDF:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text_blocks = []
            for page in doc:
                text_blocks.append(page.get_text())
            return "\n".join(text_blocks).strip()
        except Exception as e:
            print(f"[Warning] PyMuPDF failed: {e}. Falling back to basic extractor.")

    # Pure Python basic PDF text extraction fallback
    try:
        content = file_bytes.decode('latin-1', errors='ignore')
        # Extract text within parentheses in text objects: (text) Tj
        matches = re.findall(r'\((.*?)\)\s*T[jJ]', content)
        if matches:
            return "\n".join(matches).strip()
        # Fallback to general printable ascii stream extraction
        clean_text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]', ' ', content)
        words = [w for w in clean_text.split() if len(w) > 2 and w.isprintable()]
        return " ".join(words[:1000])
    except Exception as err:
        return f"Error extracting PDF: {str(err)}"

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX using python-docx if available, or pure zipfile XML."""
    if HAS_DOCX:
        try:
            import io
            doc = docx.Document(io.BytesIO(file_bytes))
            return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception as e:
            print(f"[Warning] python-docx failed: {e}. Falling back to XML extractor.")

    # Pure Python DOCX fallback using zipfile and word/document.xml
    try:
        import io
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            # Find all w:t text elements
            texts = []
            for elem in tree.iter():
                if elem.tag.endswith('}t'):
                    if elem.text:
                        texts.append(elem.text)
            return " ".join(texts)
    except Exception as err:
        return f"Error extracting DOCX: {str(err)}"

def extract_text_from_txt(file_bytes: bytes) -> str:
    """Extract text from plain text file."""
    for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode('utf-8', errors='ignore')

def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.lower().split('.')[-1]
    if ext == 'pdf':
        return extract_text_from_pdf(file_bytes)
    elif ext in ['docx', 'doc']:
        return extract_text_from_docx(file_bytes)
    else:
        return extract_text_from_txt(file_bytes)

def chunk_document(text: str, chunk_size: int = 400, overlap: int = 80) -> List[Tuple[int, str, str]]:
    """
    Chunks document into overlapping passages.
    Returns list of (chunk_index, section_title, passage_text).
    """
    cleaned = re.sub(r'\s+', ' ', text).strip()
    if not cleaned:
        return []

    chunks = []
    # Try splitting by paragraph or section headers
    paragraphs = [p.strip() for p in re.split(r'\n{2,}|\.\s{2,}', text) if p.strip()]
    if not paragraphs:
        paragraphs = [cleaned]

    current_idx = 0
    for i, p in enumerate(paragraphs):
        if len(p) <= chunk_size:
            section_title = f"Section {i+1}"
            chunks.append((current_idx, section_title, p))
            current_idx += 1
        else:
            # Sub-chunk with overlap
            words = p.split()
            step = 60
            for start in range(0, len(words), step):
                chunk_words = words[start:start + step + 15]
                passage = " ".join(chunk_words)
                section_title = f"Section {i+1} (Part {start//step + 1})"
                chunks.append((current_idx, section_title, passage))
                current_idx += 1

    return chunks
