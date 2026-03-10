"""PDF/document text extraction processor."""

import logging
import tempfile

log = logging.getLogger('describer.document')

MAX_TEXT_LENGTH = 4000


class DocumentProcessor:
    def describe(self, data: bytes, ext: str) -> str:
        """Extract text from a document."""
        if ext.lower() == 'pdf':
            return self._extract_pdf(data)
        return f'[unsupported document type: .{ext}]'

    def _extract_pdf(self, data: bytes) -> str:
        """Extract text from PDF using pdfplumber."""
        import pdfplumber

        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=True) as f:
            f.write(data)
            f.flush()

            pages_text = []
            with pdfplumber.open(f.name) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        pages_text.append(text.strip())

        full_text = '\n\n'.join(pages_text)
        if not full_text:
            return '[PDF sem texto extraível]'

        if len(full_text) > MAX_TEXT_LENGTH:
            return full_text[:MAX_TEXT_LENGTH] + '...'
        return full_text
