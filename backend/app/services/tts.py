"""TTS service — Edge TTS for video script narration."""

import asyncio
import logging
import os
import uuid

import edge_tts
from app.core.config import _BASE_DIR

logger = logging.getLogger(__name__)
OUTPUT_DIR = os.path.join(_BASE_DIR, "static", "tts")

_MAX_TTS_CHARS = 5000
_ALLOWED_VOICES = {
    "zh-CN-XiaoxiaoNeural",
    "zh-CN-YunxiNeural",
    "zh-CN-YunyangNeural",
    "zh-CN-XiaoyiNeural",
}


class TTSError(Exception):
    pass


def _ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


async def generate_speech(text: str, voice: str = "zh-CN-XiaoxiaoNeural") -> dict:
    """Generate speech from text using Microsoft Edge TTS.

    Args:
        text: The text to convert to speech (max 5000 chars).
        voice: The voice to use (whitelist enforced).

    Returns:
        {"filename": str, "path": str, "url": str}
    """
    if not text or len(text.strip()) < 5:
        raise TTSError("文本太短，至少需要 5 个字符")
    if len(text) > _MAX_TTS_CHARS:
        raise TTSError(f"文本过长，最多 {_MAX_TTS_CHARS} 字符")
    if voice not in _ALLOWED_VOICES:
        raise TTSError("不支持的 voice")

    _ensure_output_dir()
    filename = f"{uuid.uuid4().hex[:12]}.mp3"
    filepath = os.path.realpath(os.path.join(OUTPUT_DIR, filename))
    if not filepath.startswith(os.path.realpath(OUTPUT_DIR) + os.sep):
        raise TTSError("非法输出路径")

    try:
        communicate = edge_tts.Communicate(text, voice)
        await asyncio.wait_for(communicate.save(filepath), timeout=60)
    except asyncio.TimeoutError as e:
        raise TTSError("TTS 生成超时") from e
    except Exception as e:
        logger.exception("TTS 失败")
        raise TTSError(f"TTS 生成失败: {type(e).__name__}") from e

    return {
        "filename": filename,
        "path": filepath,
        "url": f"/static/tts/{filename}",
    }
