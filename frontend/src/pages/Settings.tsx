import { useState, useEffect } from "react";
import { getConfig, saveConfig, listStyles, createStyle, updateStyle, deleteStyle } from "../api";
import type { UserConfig, UserConfigPublic, StyleSample } from "../api";

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
  const [autoReview, setAutoReview] = useState(false);
  const [styleSamples, setStyleSamples] = useState("");
  const [styles, setStyles] = useState<StyleSample[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [editingStyle, setEditingStyle] = useState<{ id: string | null; name: string; content: string; is_default: boolean } | null>(null);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

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
        setAutoReview(cfg.auto_review ?? false);
        setStyleSamples(cfg.style_samples ?? "");
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

    setStylesLoading(true);
    listStyles()
      .then(setStyles)
      .catch((e) => console.warn("listStyles failed:", e))
      .finally(() => setStylesLoading(false));
  }, []);

  async function refreshStyles() {
    try {
      const xs = await listStyles();
      setStyles(xs);
    } catch (e) {
      console.warn("listStyles failed:", e);
    }
  }

  function startNewStyle() {
    setStyleError(null);
    setEditingStyle({ id: null, name: "", content: "", is_default: styles.length === 0 });
  }

  function startEditStyle(s: StyleSample) {
    setStyleError(null);
    setEditingStyle({ id: s.id, name: s.name, content: s.content, is_default: s.is_default });
  }

  async function saveStyle() {
    if (!editingStyle) return;
    if (!editingStyle.name.trim()) {
      setStyleError("名称不能为空");
      return;
    }
    if (!editingStyle.content.trim()) {
      setStyleError("内容不能为空");
      return;
    }
    const body = {
      name: editingStyle.name.trim(),
      content: editingStyle.content,
      is_default: editingStyle.is_default,
      sort_order: 0,
    };
    try {
      if (editingStyle.id) {
        await updateStyle(editingStyle.id, body);
      } else {
        await createStyle(body);
      }
      setEditingStyle(null);
      await refreshStyles();
    } catch (e: any) {
      setStyleError(String(e?.message || e));
    }
  }

  async function removeStyle(id: string) {
    if (!confirm("删除这个风格？")) return;
    try {
      await deleteStyle(id);
      await refreshStyles();
    } catch (e: any) {
      alert("删除失败: " + (e?.message || e));
    }
  }

  async function setAsDefault(s: StyleSample) {
    try {
      await updateStyle(s.id, {
        name: s.name,
        content: s.content,
        is_default: true,
        sort_order: s.sort_order,
      });
      await refreshStyles();
    } catch (e: any) {
      alert("设置默认失败: " + (e?.message || e));
    }
  }

  async function handleSave() {
    const cfg: UserConfig = {
      provider,
      api_key: apiKey,
      model: model.trim(),
      tavily_enabled: tavilyEnabled,
      auto_review: autoReview,
      style_samples: styleSamples,
    };
    try {
      const result = await saveConfig(cfg);
      setApiKeySet(result.api_key_set);
      setApiKeyHint(result.api_key_hint ?? "");
      setApiKey("");
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

  if (loading) return (
    <div className="space-y-3">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-32" />
      <div className="skeleton h-32" />
    </div>
  );

  const current = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  return (
    <div>
      <header className="mb-10">
        <p className="h-eyebrow mb-2">Settings</p>
        <h1 className="h-display mb-2">设置</h1>
        <p className="text-sm text-ink-500">模型选择 · API 密钥 · 写作风格</p>
      </header>

      <div className="space-y-6 max-w-2xl">
        {/* Provider */}
        <div className="card-pad">
          <label className="block font-serif text-base text-ink-900 mb-3">AI 服务商</label>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="AI 服务商选择">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={provider === p.value}
                onClick={() => handleProviderChange(p.value)}
                className={`text-sm px-4 py-2 rounded border transition ${
                  provider === p.value
                    ? "bg-accent-500 text-white border-accent-500 shadow-warm"
                    : "bg-paper-50 text-ink-700 border-paper-300 hover:border-accent-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div className="card-pad">
          <label htmlFor="model-input" className="block font-serif text-base text-ink-900 mb-3">
            模型名称
          </label>
          <input
            id="model-input"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={current.defaultModel}
            className="input font-mono"
          />
          <div className="mt-4">
            <p className="text-xs text-ink-500 mb-2">常用选项 · 点击填入</p>
            <div className="space-y-1">
              {current.models.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setModel(m.name)}
                  className={`block w-full text-left text-xs px-3 py-2 rounded transition border ${
                    model === m.name
                      ? "bg-accent-50 border-accent-500/30 text-ink-900"
                      : "border-transparent hover:bg-paper-200/60"
                  }`}
                >
                  <span className="font-mono text-ink-900">{m.name}</span>
                  <span className="text-ink-500 ml-2">— {m.note}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-400 mt-3">
              支持自定义 · 新模型发布后直接输入名字即可
            </p>
          </div>
        </div>

        {/* API Key */}
        <div className="card-pad">
          <label htmlFor="api-key-input" className="block font-serif text-base text-ink-900 mb-3">
            API Key
          </label>
          {apiKeySet && (
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className="pill-success">✓ 已设置</span>
              <span className="text-xs text-ink-500 font-mono">{apiKeyHint}</span>
            </div>
          )}
          <input
            id="api-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeySet ? "输入新 Key 以更换，留空保持不变" : current.placeholder}
            className="input font-mono"
          />
          <p className="text-xs text-ink-400 mt-2">
            保存后存储在服务器，关闭页面不会丢失
          </p>
        </div>

        {/* Tavily */}
        <div className="card-pad">
          <div className="flex items-center justify-between mb-2">
            <label className="block font-serif text-base text-ink-900">联网搜索</label>
            <button
              type="button"
              role="switch"
              aria-checked={tavilyEnabled}
              onClick={() => setTavilyEnabled(!tavilyEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                tavilyEnabled ? "bg-accent-500" : "bg-paper-300"
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                tavilyEnabled ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </button>
          </div>
          <p className="text-xs text-ink-500">
            开启后价值判断会用 Tavily 搜全网竞品内容作为参考
          </p>
        </div>

        {/* Auto-review */}
        <div className="card-pad">
          <div className="flex items-center justify-between mb-2">
            <label className="block font-serif text-base text-ink-900">自动改稿</label>
            <button
              type="button"
              role="switch"
              aria-checked={autoReview}
              onClick={() => setAutoReview(!autoReview)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                autoReview ? "bg-accent-500" : "bg-paper-300"
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                autoReview ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </button>
          </div>
          <p className="text-xs text-ink-500">
            主编挑刺 + 重写。每条内容多调一次 LLM，能显著减少 AI 腔。
          </p>
        </div>

        {/* Style Library */}
        <div className="card-pad">
          <div className="flex items-center justify-between mb-2">
            <label className="block font-serif text-base text-ink-900">
              风格库
            </label>
            <button
              type="button"
              onClick={startNewStyle}
              className="text-xs px-3 py-1.5 rounded border border-accent-400 text-accent-700 hover:bg-accent-50"
            >
              + 新建风格
            </button>
          </div>
          <p className="text-xs text-ink-500 mb-3">
            保存多套写作风格（小红书、公众号、推特等），生成时下拉选择。默认风格在没指定时使用。
          </p>

          {stylesLoading && <p className="text-xs text-ink-400">加载中…</p>}

          {!stylesLoading && styles.length === 0 && !editingStyle && (
            <p className="text-xs text-ink-400 italic">还没有风格。点上方"新建风格"添加第一条。</p>
          )}

          {styles.length > 0 && (
            <ul className="space-y-2 mb-3">
              {styles.map((s) => (
                <li key={s.id} className="flex items-start gap-3 p-3 rounded border border-paper-300 bg-paper-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-serif text-sm text-ink-900 truncate">{s.name}</span>
                      {s.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-500 text-white">默认</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500 line-clamp-2">{s.content.slice(0, 120)}{s.content.length > 120 && "…"}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditStyle(s)}
                      className="text-xs px-2 py-1 rounded hover:bg-paper-200 text-ink-600"
                    >
                      编辑
                    </button>
                    {!s.is_default && (
                      <button
                        type="button"
                        onClick={() => setAsDefault(s)}
                        className="text-xs px-2 py-1 rounded hover:bg-paper-200 text-ink-600"
                      >
                        设默认
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeStyle(s.id)}
                      className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-600"
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editingStyle && (
            <div className="p-3 rounded border border-accent-300 bg-accent-50/30 space-y-3">
              <div>
                <label className="block text-xs text-ink-600 mb-1">名称</label>
                <input
                  type="text"
                  value={editingStyle.name}
                  onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })}
                  placeholder="例如：小红书爆款风"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-600 mb-1">风格样本内容</label>
                <textarea
                  value={editingStyle.content}
                  onChange={(e) => setEditingStyle({ ...editingStyle, content: e.target.value })}
                  rows={8}
                  placeholder="贴 2–5 段你最满意的内容，AI 会模仿其句式、断句、用词……"
                  className="textarea font-serif text-[14px] leading-relaxed"
                />
                <p className="text-xs text-ink-400 mt-1">建议 500–2000 字。</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={editingStyle.is_default}
                  onChange={(e) => setEditingStyle({ ...editingStyle, is_default: e.target.checked })}
                />
                <span>设为默认风格</span>
              </label>
              {styleError && <p className="text-xs text-red-600">{styleError}</p>}
              <div className="flex gap-2">
                <button onClick={saveStyle} className="btn-primary text-sm">保存</button>
                <button
                  onClick={() => { setEditingStyle(null); setStyleError(null); }}
                  className="text-sm px-3 py-1.5 rounded border border-paper-300 text-ink-600 hover:bg-paper-200"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 sticky bottom-6 bg-paper-100/95 backdrop-blur py-3 -mx-2 px-2 rounded-lg">
          <button onClick={handleSave} className="btn-primary">
            {saved ? "✓ 已保存" : "保存设置"}
          </button>
          {saved && (
            <span className="text-xs text-success-700 fade-in">设置已生效</span>
          )}
        </div>
      </div>
    </div>
  );
}
