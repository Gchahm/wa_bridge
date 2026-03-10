"""Image description processor using MLX-VLM (Metal GPU accelerated)."""

import logging
import tempfile
from pathlib import Path

log = logging.getLogger('describer.image')

DEFAULT_MODEL = 'mlx-community/Qwen2.5-VL-3B-Instruct-4bit'
PROMPT = 'Descreva esta imagem de forma concisa em português.'


class ImageProcessor:
    def __init__(self, model: str = DEFAULT_MODEL):
        self.model_path = model
        log.info('Loading vision model %s...', self.model_path)
        from mlx_vlm import load
        from mlx_vlm.utils import load_config

        self._model, self._processor = load(self.model_path)
        self._config = load_config(self.model_path)
        log.info('Vision model loaded')

    def describe(self, data: bytes, ext: str) -> str:
        """Generate a text description of an image."""
        from mlx_vlm import generate
        from mlx_vlm.prompt_utils import apply_chat_template

        suffix = f'.{ext}' if ext else '.jpg'
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as f:
            f.write(data)
            f.flush()

            formatted_prompt = apply_chat_template(
                self._processor, self._config, PROMPT, num_images=1
            )

            output = generate(
                self._model,
                self._processor,
                formatted_prompt,
                [f.name],
                verbose=False,
                max_tokens=256,
            )

        text = output.text.strip() if output else ''
        if not text:
            return '[sem descrição disponível]'
        return text
