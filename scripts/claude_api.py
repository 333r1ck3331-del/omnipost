#!/usr/bin/env python3
"""Direct Claude API caller via pikachu proxy.

Usage:
  python3 claude_api.py "Analyze this code"
  python3 claude_api.py --system "You are a reviewer" "Review"
  echo "prompt" | python3 claude_api.py
"""

import os, sys, json, httpx, asyncio, time

BASE_URL = "https://pikachu.claudecode.love/v1"
MODEL = "claude-opus-4-7"

def _load_key():
    path = os.path.expanduser("/opt/data/home/.claude_env")
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                if "ANTHROPIC_AUTH_TOKEN" in line:
                    return line.strip().split("=")[1].strip('"').strip("'")
    return ""

API_KEY = os.getenv("CLAUDE_API_KEY", "") or _load_key()

async def call(prompt: str, system: str = "", max_tokens: int = 8000) -> dict:
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }
    body = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        body["system"] = system

    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post(f"{BASE_URL}/messages", headers=headers, json=body)
    latency = (time.monotonic() - t0) * 1000

    if r.status_code != 200:
        raise RuntimeError(f"Claude API {r.status_code}: {r.text[:300]}")

    data = r.json()
    content = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    return {"content": content, "usage": data.get("usage", {}), "latency_ms": int(latency)}

if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else sys.stdin.read().strip()
    if not prompt:
        print("Usage: python3 claude_api.py 'your prompt'")
        sys.exit(1)
    result = asyncio.run(call(prompt))
    print(result["content"])
