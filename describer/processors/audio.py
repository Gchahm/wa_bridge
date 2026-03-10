"""Audio transcription processor using MLX Whisper (Metal GPU accelerated)."""

import logging
import tempfile
from pathlib import Path

log = logging.getLogger('describer.audio')


class AudioProcessor:
    def __init__(self, model: str = 'mlx-community/whisper-base-mlx', language: str = 'pt'):
        self.model = model
        self.language = language

    def describe(self, data: bytes, ext: str) -> str:
        """Transcribe audio data to text."""
        import mlx_whisper

        suffix = f'.{ext}' if ext else '.ogg'
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as f:
            f.write(data)
            f.flush()

            result = mlx_whisper.transcribe(
                f.name,
                language=self.language,
                path_or_hf_repo=self.model,
            )

        text = result.get('text', '').strip()
        if not text:
            return '[sem fala detectada]'
        return text
