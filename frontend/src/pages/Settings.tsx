import { useState, useEffect } from "react";
import { getConfig, saveConfig } from "../api";
import type { UserConfig, UserConfigPublic } from "../api";

const STORAGE_KEY = "omnipost_settings";

type ProviderDef = {
  value: string;
  label: string;
  placeholder: string;
  models: { name: string; note: string }[];
  defaultModel: string;
};

const PROVIDERS: ProviderDef[] = [
  {
    value: "deepseek",
    label: "DeepSeek",
    placeholder: "sk-...",
    defaultModel: "deepseek-chat",
    models: [
      { name: "deepseek-chat", note: "聊天版，便宜快（推荐日常用）" },
      { name: "deepseek-reasoner", note: "深度推理，慢但强（难判断的复杂任务）" },
    ],
  },
  {
    value: "claude",
    label: "Claude",
    placeholder: "sk-ant-...",
    defaultModel: "claude-sonnet-4-5",
    models: [
      { name: "claude-haiku-4", note: "最便宜最快" },
      { name: "claude-sonnet-4-5", note: "平衡型（推荐）" },
      { name: "claude-opus-4-5", note: "最强但最贵" },
    ],
  },
  {
    value: "openai",
    label: "OpenAI",
    placeholder: "sk-...",
    defaultModel: "gpt-4o-mini",
    models: [
      { name: "gpt-4o-mini", note: "便宜小模型（推荐）" },
      { name: "gpt-4o", note: "标准版，能力强" },
      { name: "o1-mini", note: "推理模型（数学/逻辑强）" },
    ],
  },
];

export default function Settings() {
  const [provider, setProvider] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKeyHint, setApiKeyHint] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [tavilyEnabled, setTavilyEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // 切换 provider 时，如果当前 model 不在新 provider 的建议列表里，自动切到默认 model
  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    const def = PROVIDERS.find((p) => p.value === newProvider);
    if (def) {
      const knownModels = def.models.map((m) => m.name);
      if (!knownModels.includes(model)) {
        setModel(def.defaultModel);
      }
    }
  }

  useEffect(() => {
    getConfig()
      .then((cfg: UserConfigPublic) => {
        setProvider(cfg.provider ?? "deepseek");
        setApiKeySet(cfg.api_key_set);
        setApiKeyHint(cfg.api_key_hint ?? "");
        setTavilyEnabled(cfg.tavily_enabled ?? true);
        const def = PROVIDERS.find((p) => p.value === (cfg.provider ?? "deepseek"));
        setModel(cfg.model || def?.defaultModel || "deepseek-chat");
      })
      .catch((e) => {
        console.warn("getConfig failed, fallback to localStorage:", e);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            setProvider(parsed.provider ?? "deepseek");
            setApiKey(parsed.api_key ?? "");
            setModel(parsed.model ?? "deepseek-chat");
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
      model: model.trim(),
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
          <label className="block text-sm text-gray-500 mb-2">AI 服务商</label>
          <div className="flex gap-2" role="group" aria-label="AI 服务商选择">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={provider === p.value}
                onClick={() => handleProviderChange(p.value)}
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

        {/* Model */}
        <div>
          <label htmlFor="model-input" className="block text-sm text-gray-500 mb-2">
            模型名称
          </label>
          <input
            id="model-input"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={current.defaultModel}
            className="w-full text-sm p-2 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 font-mono"
          />
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-1.5">常用选项（点击填入）：</p>
            <div className="space-y-1">
              {current.models.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setModel(m.name)}
                  className={`block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100 transition ${
                    model === m.name ? "bg-gray-100" : ""
                  }`}
                >
                  <span className="font-mono text-gray-700">{m.name}</span>
                  <span className="text-gray-400 ml-2">— {m.note}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-300 mt-2">
              支持自定义：新模型一发布，直接输入名字即可
            </p>
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
