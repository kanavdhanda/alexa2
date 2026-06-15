import { useState, useEffect } from 'react';
import { useAppStore_ as useAppStoreHook, useInstalledModules } from '../../hooks/useBackendApi';
import type { AppStoreModule } from '../../api';

// ── Safety class badge ─────────────────────────────────────────────────────────
function SafetyBadge({ cls }: { cls?: string }) {
  if (!cls) return null;
  const map: Record<string, { color: string; bg: string; label: string }> = {
    CRITICAL:    { color: '#EF4444', bg: '#1A0000', label: '🔴 CRITICAL' },
    STANDARD:    { color: '#FBB040', bg: '#1A1000', label: '🟡 STANDARD' },
    CONVENIENCE: { color: '#4ADE80', bg: '#001A00', label: '🟢 CONVENIENCE' },
  };
  const c = map[cls] ?? map['STANDARD'];
  return (
    <span
      className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.color}30` }}
    >
      {c.label}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ color: '#60A5FA', background: '#0A1828', border: '1px solid #1E3A5F' }}>
      ✓ Verified
    </span>
  );
}

// ── Module Card ────────────────────────────────────────────────────────────────
function ModuleCard({ mod, onInstall, installing }: {
  mod: AppStoreModule;
  onInstall: (id: string, name: string) => void;
  installing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const categoryEmoji: Record<string, string> = {
    water: '💧', hvac: '❄️', security: '🔒', kitchen: '🍳',
    energy: '⚡', lighting: '💡', audio: '🔊', sensors: '📡',
    pumps: '🌊', appliances: '🏠',
  };
  const emoji = categoryEmoji[mod.category?.toLowerCase()] ?? '📦';

  return (
    <div
      className="rounded-xl border transition-all"
      style={{ background: '#1A1A1A', border: expanded ? '1px solid #00A8E0' : '1px solid #383838' }}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: '#242424' }}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-bold text-white truncate">{mod.name}</p>
            {mod.verified && <VerifiedBadge />}
          </div>
          <p className="text-[10px] text-[#8A8A8A] mt-0.5">
            {mod.brand ? `${mod.brand} · ` : ''}{mod.device_type}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <SafetyBadge cls={mod.safety_class} />
            <span className="text-[9px] text-[#666]">📥 {mod.downloads ?? 0}</span>
            {mod.rating && <span className="text-[9px] text-[#FBB040]">★ {mod.rating.toFixed(1)}</span>}
          </div>
        </div>
        <button
          onClick={() => onInstall(mod.module_id, mod.name)}
          disabled={installing}
          className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
          style={{ background: '#00A8E0', color: '#000' }}
        >
          {installing ? '…' : 'Install'}
        </button>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-[9px] text-[#555] pb-2 hover:text-[#888] transition-colors"
      >
        {expanded ? '▲ Less' : '▼ Details'}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-[#2A2A2A] pt-2">
          {mod.description && (
            <p className="text-[10px] text-[#8A8A8A] leading-relaxed">{mod.description}</p>
          )}
          {mod.auto_t0_rules && mod.auto_t0_rules.length > 0 && (
            <div>
              <p className="text-[9px] text-[#555] font-semibold uppercase tracking-wider mb-1">
                Auto T0 Rules ({mod.auto_t0_rules.length})
              </p>
              {mod.auto_t0_rules.slice(0, 3).map((r, i) => (
                <p key={i} className="text-[10px] text-[#4ADE80]">⚡ {r.description}</p>
              ))}
            </div>
          )}
          {mod.t1_intents && mod.t1_intents.length > 0 && (
            <div>
              <p className="text-[9px] text-[#555] font-semibold uppercase tracking-wider mb-1">Voice Patterns</p>
              {mod.t1_intents.slice(0, 2).map((intent, i) => (
                <p key={i} className="text-[10px] text-[#60A5FA]">🧠 {intent}</p>
              ))}
            </div>
          )}
          {mod.knowledge_pack_frag && (
            <div>
              <p className="text-[9px] text-[#555] font-semibold uppercase tracking-wider mb-1">Knowledge Pack</p>
              <p className="text-[10px] text-[#8A8A8A] leading-relaxed line-clamp-3">{mod.knowledge_pack_frag}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI Generator ──────────────────────────────────────────────────────────────
function AIGeneratorTab({ onGenerate }: {
  onGenerate: (desc: string, type: string, brand?: string) => Promise<unknown>;
}) {
  const [desc, setDesc] = useState('');
  const [deviceType, setDeviceType] = useState('smart_plug');
  const [brand, setBrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const DEVICE_TYPES = [
    'fan','light','geyser','water_pump','ac','smart_plug',
    'inverter','ro_purifier','door_lock','tv','motion_sensor','smoke_detector',
  ];

  const handleGenerate = async () => {
    if (!desc.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await onGenerate(desc, deviceType, brand || undefined) as {
        message?: string; draft?: { name?: string };
      };
      if (data) setResult(data.message ?? `Module "${data.draft?.name ?? 'draft'}" generated!`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="p-3 rounded-xl" style={{ background: '#111', border: '1px dashed #383838' }}>
        <p className="text-[10px] text-[#00A8E0] font-bold uppercase tracking-wider mb-1">🤖 AI Module Generator</p>
        <p className="text-[9px] text-[#555] mb-2">Describe a new smart device — AI generates the full module</p>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. A smart mosquito repellent plug used at night. It has power, refill level, and child-safe lock."
          className="w-full bg-[#1A1A1A] border border-[#383838] rounded-lg p-2 text-[10px] text-white placeholder-[#555] focus:outline-none focus:border-[#00A8E0] resize-none"
          rows={3}
        />
        <div className="flex gap-2 mt-2">
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
          >
            {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Brand (optional)"
            className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded-lg px-2 py-1 text-[10px] text-white placeholder-[#555] focus:outline-none"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || !desc.trim()}
          className="w-full mt-2 py-2 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
          style={{ background: '#0A2A20', border: '1px solid #4ADE80', color: '#4ADE80' }}
        >
          {loading ? '⏳ Generating…' : '▶ Generate with AI'}
        </button>
        {result && <p className="text-[10px] text-[#4ADE80] mt-2 leading-relaxed">{result}</p>}
      </div>

      <div className="p-3 rounded-xl" style={{ background: '#0A1A10', border: '1px solid #166534' }}>
        <p className="text-[9px] text-[#4ADE80] font-bold uppercase tracking-wider mb-1">How it works</p>
        <p className="text-[10px] text-[#8A8A8A] leading-relaxed">
          1. Describe the device in plain English<br />
          2. Amazon Bedrock generates a module with T0 rules, voice patterns &amp; knowledge<br />
          3. Draft is saved as unverified — publish to the store to share<br />
          4. Other homes can install it without hub code changes
        </p>
      </div>
    </div>
  );
}

// ── Publish Module Tab ─────────────────────────────────────────────────────────
function PublishTab({ onPublish }: { onPublish: (payload: Partial<AppStoreModule>) => Promise<unknown> }) {
  const [form, setForm] = useState({
    name: '', device_type: '', category: '', author: '', brand: '',
    version: '1.0.0', description: '',
    safety_class: 'STANDARD' as 'CRITICAL' | 'STANDARD' | 'CONVENIENCE',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const field = (key: keyof typeof form, placeholder: string, type: 'input' | 'select' = 'input') => {
    if (type === 'select') return null;
    return (
      <input
        key={key}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1.5 text-[10px] text-white placeholder-[#555] focus:outline-none focus:border-[#00A8E0]"
      />
    );
  };

  const handlePublish = async () => {
    if (!form.name || !form.device_type) return;
    setLoading(true);
    setResult(null);
    try {
      await onPublish(form);
      setResult('Module published successfully!');
      setForm({ name: '', device_type: '', category: '', author: '', brand: '', version: '1.0.0', description: '', safety_class: 'STANDARD' });
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[9px] text-[#555] uppercase tracking-widest font-bold">POST /api/app-store/modules</p>
      <div className="flex flex-col gap-1.5">
        {field('name', 'Module name *')}
        {field('device_type', 'Device type * (e.g. geyser)')}
        {field('category', 'Category (e.g. water)')}
        {field('author', 'Author')}
        {field('brand', 'Brand (e.g. Kirloskar)')}
        {field('version', 'Version')}
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1.5 text-[10px] text-white placeholder-[#555] focus:outline-none focus:border-[#00A8E0] resize-none"
        />
        <select
          value={form.safety_class}
          onChange={(e) => setForm((f) => ({ ...f, safety_class: e.target.value as typeof form.safety_class }))}
          className="w-full bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]"
        >
          <option value="CONVENIENCE">CONVENIENCE</option>
          <option value="STANDARD">STANDARD</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
      </div>
      <button
        onClick={handlePublish}
        disabled={loading || !form.name || !form.device_type}
        className="w-full py-2 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
        style={{ background: '#00A8E022', border: '1px solid #00A8E066', color: '#00A8E0' }}
      >
        {loading ? '⏳ Publishing…' : '🚀 Publish Module'}
      </button>
      {result && (
        <p className={`text-[10px] ${result.includes('success') ? 'text-[#4ADE80]' : 'text-[#F44336]'}`}>
          {result}
        </p>
      )}
    </div>
  );
}

// ── Installed Tab ─────────────────────────────────────────────────────────────
function InstalledTab() {
  const { modules } = useInstalledModules();

  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
        <span className="text-3xl">📦</span>
        <p className="text-xs text-[#555]">No modules installed yet.</p>
        <p className="text-[10px] text-[#444]">Install from the Browse tab above</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {modules.map((m) => (
        <div key={m.module_id} className="px-3 py-2.5 rounded-xl border border-[#383838]" style={{ background: '#1A1A1A' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-white">{m.name}</p>
              <p className="text-[9px] text-[#555]">{m.brand} · +{m.extra_rules ?? 0} T0 rules</p>
            </div>
            <span className="text-[9px] text-[#4ADE80] font-bold">Active</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main AppStorePanel ─────────────────────────────────────────────────────────
export function AppStorePanel() {
  const { storeStats, modules, loading, searchModules, installModule, generateModule, publishModule } = useAppStoreHook();
  const [activeTab, setActiveTab] = useState<'browse' | 'installed' | 'generate' | 'publish'>('browse');
  const [searchQ, setSearchQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const CATEGORIES = ['', 'Water', 'HVAC', 'Security', 'Kitchen', 'Energy', 'Pumps', 'Sensors'];

  useEffect(() => {
    searchModules(searchQ || undefined, categoryFilter || undefined);
  }, [searchQ, categoryFilter, searchModules]);

  const handleInstall = async (moduleId: string, moduleName: string) => {
    setInstallingId(moduleId);
    await installModule(moduleId, moduleName);
    setInstallingId(null);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#121212' }}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🛒</span>
          <div>
            <p className="text-xs font-bold text-white">MCP Module App Store</p>
            <p className="text-[9px] text-[#555]">Device adapters for Indian smart home</p>
          </div>
        </div>

        {storeStats && (
          <div className="flex gap-2 mb-2">
            {[
              { label: 'Modules',  value: storeStats.total_modules,    color: '#00A8E0' },
              { label: 'Installs', value: storeStats.total_installs,   color: '#4ADE80' },
              { label: 'Verified', value: storeStats.verified_modules, color: '#FBB040' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-1 rounded-lg p-2 text-center" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                <p className="text-sm font-black" style={{ color }}>{value}</p>
                <p className="text-[8px] text-[#555] uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-0.5 bg-[#1A1A1A] rounded-lg p-0.5">
          {([
            { id: 'browse',   label: '🔍 Browse' },
            { id: 'installed',label: '📦 Mine' },
            { id: 'generate', label: '🤖 AI' },
            { id: 'publish',  label: '🚀 Publish' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-1 rounded-md text-[8px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: activeTab === tab.id ? '#00A8E0' : 'transparent',
                color: activeTab === tab.id ? '#000' : '#555',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Browse */}
      {activeTab === 'browse' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 pb-2 shrink-0 space-y-1.5">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search modules (e.g. kirloskar, daikin…)"
              className="w-full bg-[#1A1A1A] border border-[#383838] rounded-lg px-3 py-1.5 text-[10px] text-white placeholder-[#555] focus:outline-none focus:border-[#00A8E0]"
            />
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-medium whitespace-nowrap transition-all"
                  style={{
                    background: categoryFilter === cat ? '#00A8E0' : '#1A1A1A',
                    color: categoryFilter === cat ? '#000' : '#666',
                    border: `1px solid ${categoryFilter === cat ? '#00A8E0' : '#383838'}`,
                  }}
                >
                  {cat || 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <div className="w-5 h-5 rounded-full border-2 border-[#00A8E0] border-t-transparent animate-spin" />
              </div>
            ) : modules.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="text-2xl">🔍</span>
                <p className="text-[10px] text-[#555]">No modules found</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {modules.map((mod) => (
                  <ModuleCard
                    key={mod.module_id}
                    mod={mod}
                    onInstall={handleInstall}
                    installing={installingId === mod.module_id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'installed' && (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <InstalledTab />
        </div>
      )}

      {activeTab === 'generate' && (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <AIGeneratorTab onGenerate={generateModule} />
        </div>
      )}

      {activeTab === 'publish' && (
        <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
          <PublishTab onPublish={publishModule} />
        </div>
      )}
    </div>
  );
}
