import { useState, useEffect } from "react";
import { getConfig, saveConfig } from "../api";
import type { UserConfig, UserConfigPublic } from "../api";

const STORAGE_KEY = "omnipost_settings";

const PROVIDERS: { value: string; label: string; placeholder: string }[] = [
  { value: "deepseek", label: "DeepSeek", placeholder: "sk-..." },
  { value: "claude", label: "Claude", placeholder: "sk-ant-..." },
  { value: "custom", label: "自定义", placeholder: "你的 API Key" },
];

export default function Settings() {
  const [provider, setProvider] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKeyHint, setApiKeyHint] = useState("");
  const [tavilyEnabled, setTavilyEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // On mount: load from backend, fallback to localStorage
  useEffect(() => {
    getConfig()
      .then((cfg: UserConfigPublic) => {
        setProvider(cfg.provider ?? "deepseek");
        setApiKeySet(cfg.api_key_set);
        setApiKeyHint(cfg.api_key_hint ?? "");
        setTavilyEnabled(cfg.tavily_enabled ?? true);
        // Don't set apiKey from hint — user must re-enter to change
      })
      .catch((e) => {
        console.warn("getConfig failed, fallback to localStorage:", e);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            setProvider(parsed.provider ?? "deepseek");
            setApiKey(parsed.api_key ?? "");
            setTavilyEnabled(parsed.tavily_enabled ?? true);
          }
        } catch (err) {
          console.warn("localStorage parse failed:", err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const cfg: UserConfig = {
      provider,
      api_key: apiKey,
      tavily_enabled: tavilyEnabled,
    };
    try {
      const result = await saveConfig(cfg);
      setApiKeySet(result.api_key_set);
      setApiKeyHint(result.api_key_hint ?? "");
      setApiKey(""); // clear input after save
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.warn("saveConfig failed, saving locally:", e);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) return <p className="text-gray-300 text-sm">加载中...</p>;

  const current =
    PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">
        设置<span className="text-gray-300">Settings</span>
      </h1>
      <p className="text-xs text-gray-400 mb-12">模型 & 搜索偏好</p>

      <div className="space-y-10 max-w-lg">
        {/* Provider */}
        <div>
          <label className="block text-sm text-gray-500 mb-2">AI 模型</label>
          <div className="flex gap-2" role="group" aria-label="AI 模型选择">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={provider === p.value}
                onClick={() => setProvider(p.value)}
                className={`text-sm px-4 py-1.5 rounded transition ${
                  provider === p.value
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div>
          <label htmlFor="api-key-input" className="block text-sm text-gray-500 mb-2">
            API Key
          </label>
          {apiKeySet ? (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-green-600">✓ 已设置</span>
              <span className="text-xs text-gray-400 font-mono">{apiKeyHint}</span>
            </div>
          ) : null}
          <input
            id="api-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeySet ? "输入新 Key 以更换，留空保持不变" : current.placeholder}
            className="w-full text-sm p-2 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 placeholder-gray-300"
          />
          <p className="text-xs text-gray-300 mt-1">保存后存储在服务器，关闭页面不会丢失</p>
        </div>

        {/* Tavily */}
        <div>
          <label className="block text-sm text-gray-500 mb-2">联网搜索（Tavily）</label>
          <button
            type="button"
            aria-pressed={tavilyEnabled}
            onClick={() => setTavilyEnabled(!tavilyEnabled)}
            className={`text-sm px-4 py-1.5 rounded transition ${
              tavilyEnabled
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {tavilyEnabled ? "已开启" : "已关闭"}
          </button>
          <p className="text-xs text-gray-300 mt-1">
            开启后价值判断会搜索全网竞品内容作为参考
          </p>
        </div>

        {/* Save */}
        <div>
          <button
            onClick={handleSave}
            className="text-sm px-5 py-2 rounded bg-gray-800 text-white hover:bg-black transition"
          >
            {saved ? "已保存 ✓" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
