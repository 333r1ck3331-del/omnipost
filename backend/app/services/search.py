"""Search service — Tavily API wrapper for competitor research."""

import httpx
from app.core.config import TAVILY_API_KEY, TAVILY_ENABLED

TAVILY_URL = "https://api.tavily.com/search"


class SearchError(Exception):
    pass


async def search_competitors(query: str, max_results: int = 5) -> list[dict]:
    """Search for related/competing content and return structured results.

    Returns:
        List of {title, url, content, score}
    """
    if not TAVILY_ENABLED:
        return []
    if not TAVILY_API_KEY or TAVILY_API_KEY.startswith("tvly-xxx"):
        raise SearchError("Tavily API Key 未配置。请在 backend/.env 中设置 TAVILY_API_KEY。")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TAVILY_URL,
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "search_depth": "basic",
                "max_results": max_results,
                "include_answer": False,
            },
        )

    if resp.status_code != 200:
        raise SearchError(f"Tavily 搜索失败 ({resp.status_code}): {resp.text[:200]}")

    data = resp.json()
    results = data.get("results", [])

    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", "")[:500],  # trim for prompt budget
            "score": r.get("score", 0),
        }
        for r in results
    ]


def format_search_results(results: list[dict]) -> str:
    """Format search results into a prompt-friendly string."""
    if not results:
        return "（未找到相关竞品内容）"

    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r['title']}")
        lines.append(f"   链接: {r['url']}")
        lines.append(f"   摘要: {r['content']}")
        lines.append("")
    return "\n".join(lines)


async def fetch_urls(urls: list[str]) -> list[dict]:
    """Fetch and extract text content from URLs (simple HTTP GET)."""
    results = []
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for url in urls[:3]:  # max 3 URLs to avoid blowing up
            try:
                resp = await client.get(url, headers={"User-Agent": "OmniPost/1.0"})
                if resp.status_code == 200:
                    text = resp.text[:3000]  # trim
                    # Crude HTML-to-text: remove tags
                    import re
                    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text).strip()
                    results.append({"url": url, "content": text[:2000]})
                else:
                    results.append({"url": url, "content": f"[HTTP {resp.status_code}]", "error": True})
            except Exception as e:
                results.append({"url": url, "content": f"[抓取失败: {e}]", "error": True})
    return results


def format_url_content(results: list[dict]) -> str:
    """Format fetched URL content for prompt injection."""
    if not results:
        return ""
    lines = ["【用户指定的参考链接内容】"]
    for r in results:
        lines.append(f"\n--- {r['url']} ---")
        lines.append(r['content'][:1500])
    return "\n".join(lines)
