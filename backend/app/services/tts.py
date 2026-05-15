"""TTS service — Edge TTS for video script narration."""

import os
import uuid
import edge_tts
from app.core.config import _BASE_DIR

OUTPUT_DIR = os.path.join(_BASE_DIR, "static", "tts")
os.makedirs(OUTPUT_DIR, exist_ok=True)


class TTSError(Exception):
    pass


async def generate_speech(text: str, voice: str = "zh-CN-XiaoxiaoNeural") -> dict:
    """Generate speech from text using Microsoft Edge TTS.

    Args:
        text: The text to convert to speech.
        voice: The voice to use (default: Chinese female, Xiaoxiao).

    Returns:
        {"filename": str, "path": str, "url": str}
    """
    if not text or len(text.strip()) < 5:
        raise TTSError("文本太短，至少需要 5 个字符")

    filename = f"{uuid.uuid4().hex[:12]}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(filepath)

    return {
        "filename": filename,
        "path": filepath,
        "url": f"/static/tts/{filename}",
    }
