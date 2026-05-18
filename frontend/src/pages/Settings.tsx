import { useState, useEffect } from "react";
import { getConfig, saveConfig } from "../api";
import type { UserConfig } from "../api";

const STORAGE_KEY = "omnipost_settings";

const PROVIDERS: { value: string; label: string; placeholder: string }[] = [
  { value: "deepseek", label: "DeepSeek", placeholder: "sk-..." },
  { value: "claude", label: "Claude", placeholder: "sk-ant-..." },
  { value: "custom", label: "自定义", placeholder: "你的 API Key" },
];

export default function Settings() {
  const [settings, setSettings] = useState<UserConfig>({
    provider: "deepseek",
    api_key: "",
    tavily_enabled: true,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // On mount: load from backend, fallback to localStorage
  useEffect(() => {
    getConfig()
      .then((cfg) => setSettings(cfg))
      .catch(() => {
        // Backend unavailable — load from localStorage
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) setSettings(JSON.parse(raw));
        } catch {}
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    try {
      await saveConfig(settings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Backend save failed — at least save locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (loading) return <p className="text-gray-300 text-sm">加载中...</p>;

  const current = PROVIDERS.find((p) => p.value === settings.provider)!;

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
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setSettings({ ...settings, provider: p.value })}
                className={`text-sm px-4 py-1.5 rounded transition ${
                  settings.provider === p.value
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
          <label className="block text-sm text-gray-500 mb-2">API Key</label>
          <input
            type="password"
            value={settings.api_key}
            onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
            placeholder={current.placeholder}
            className="w-full text-sm p-2 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 placeholder-gray-300"
          />
          <p className="text-xs text-gray-300 mt-1">保存后存储在服务器，关闭页面不会丢失</p>
        </div>

        {/* Tavily */}
        <div>
          <label className="block text-sm text-gray-500 mb-2">联网搜索（Tavily）</label>
          <button
            onClick={() => setSettings({ ...settings, tavily_enabled: !settings.tavily_enabled })}
            className={`text-sm px-4 py-1.5 rounded transition ${
              settings.tavily_enabled
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {settings.tavily_enabled ? "已开启" : "已关闭"}
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
