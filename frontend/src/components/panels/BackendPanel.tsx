import { useState, useCallback } from 'react';
import { backendApi, homeApi, simulateApi } from '../../api';
import type { RegimeState, T0Rule, ProposedRule } from '../../api';
import { env } from '../../config/env';

// ── Helpers ────────────────────────────────────────────────────────────────────

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="mt-1.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-2.5 text-[9px] text-[#00CAFF] overflow-auto max-h-40 leading-relaxed whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StatusBadge({ ok, msg }: { ok: boolean | null; msg?: string }) {
  if (ok === null) return null;
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
        ok ? 'bg-[#1DB95433] text-[#1DB954]' : 'bg-[#F4433633] text-[#F44336]'
      }`}
    >
      {ok ? 'OK' : 'ERR'}{msg ? ` — ${msg}` : ''}
    </span>
  );
}

interface SectionProps { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }
function Section({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1A1A1A] hover:bg-[#222] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-white">
          <span>{icon}</span>
          {title}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-[#555] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-3 flex flex-col gap-3 bg-[#121212]">{children}</div>}
    </div>
  );
}

function Btn({
  label, onClick, color = 'blue', small = false,
}: {
  label: string;
  onClick: () => void;
  color?: 'blue' | 'orange' | 'green' | 'red' | 'gray';
  small?: boolean;
}) {
  const colors = {
    blue:   'bg-[#00A8E022] border-[#00A8E066] text-[#00A8E0] hover:bg-[#00A8E044]',
    orange: 'bg-[#FF8C0022] border-[#FF8C0066] text-[#FF8C00] hover:bg-[#FF8C0044]',
    green:  'bg-[#1DB95422] border-[#1DB95466] text-[#1DB954] hover:bg-[#1DB95444]',
    red:    'bg-[#F4433622] border-[#F4433666] text-[#F44336] hover:bg-[#F4433644]',
    gray:   'bg-[#242424] border-[#383838] text-[#8A8A8A] hover:text-white',
  };
  return (
    <button
      onClick={onClick}
      className={`border rounded-lg font-semibold transition-colors ${small ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1.5 text-[10px]'} ${colors[color]}`}
    >
      {label}
    </button>
  );
}

// ── Generic call-and-show hook ─────────────────────────────────────────────────

function useApiCall<T>(fn: () => Promise<T>) {
  const [result, setResult] = useState<T | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fn();
      setResult(data);
      setOk(true);
    } catch (e) {
      setResult(e instanceof Error ? { error: e.message } as unknown as T : null);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, [fn]);

  return { run, result, ok, loading };
}

// ── Sub-panels ─────────────────────────────────────────────────────────────────

function HealthPanel() {
  const { run, result, ok, loading } = useApiCall(() => backendApi.health());
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Btn label={loading ? '…' : 'Check Health'} onClick={run} color="green" />
        <StatusBadge ok={ok} />
      </div>
      {result && <JsonBlock data={result} />}
    </div>
  );
}

function HomePanel() {
  const { run: runState, result: stateRes, ok: stateOk } = useApiCall(() => backendApi.getHomeState());
  const { run: runStats, result: statsRes, ok: statsOk } = useApiCall(() => backendApi.getHomeStats());
  const { run: runReset, result: resetRes, ok: resetOk } = useApiCall(() => backendApi.resetHome());
  const { run: runEvents, result: eventsRes, ok: eventsOk } = useApiCall(() => backendApi.getEventHistory());
  const { run: runSeed, result: seedRes, ok: seedOk } = useApiCall(() => homeApi.seedHome());
  const { run: runSeedHist, result: seedHistRes, ok: seedHistOk } = useApiCall(() => homeApi.seedLearningHistory());
  const [invItems, setInvItems] = useState('{"milk": 2, "bread": 1}');
  const [invRes, setInvRes] = useState<unknown>(null); const [invOk, setInvOk] = useState<boolean | null>(null);

  const runInventory = async () => {
    try {
      const items = JSON.parse(invItems);
      const r = await backendApi.updateInventory(undefined, items);
      setInvRes(r); setInvOk(true);
    } catch (e) { setInvRes({ error: e instanceof Error ? e.message : 'err' }); setInvOk(false); }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[9px] text-[#555] uppercase tracking-widest">Home ID: {env.HOME_ID}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Btn label="State" onClick={runState} color="blue" />
            <StatusBadge ok={stateOk} />
          </div>
          {stateRes && <JsonBlock data={stateRes} />}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Btn label="Stats" onClick={runStats} color="blue" />
            <StatusBadge ok={statsOk} />
          </div>
          {statsRes && <JsonBlock data={statsRes} />}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5">
          <Btn label="Seed Home" onClick={runSeed} color="green" />
          <StatusBadge ok={seedOk} msg={(seedRes as { message?: string } | null)?.message} />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Seed History" onClick={runSeedHist} color="green" />
          <StatusBadge ok={seedHistOk} />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Reset Home" onClick={runReset} color="red" />
          <StatusBadge ok={resetOk} />
        </div>
      </div>
      {resetRes && <JsonBlock data={resetRes} />}
      {seedHistRes && <JsonBlock data={seedHistRes} />}
      <div className="flex items-center gap-1.5 mt-1">
        <Btn label="Event History" onClick={runEvents} color="gray" />
        <StatusBadge ok={eventsOk} />
      </div>
      {eventsRes && <JsonBlock data={eventsRes} />}

      {/* PATCH inventory */}
      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2 mt-1">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">PATCH — Inventory</p>
        <textarea
          value={invItems}
          onChange={(e) => setInvItems(e.target.value)}
          rows={2}
          className="bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white font-mono focus:outline-none focus:border-[#00A8E0] resize-none"
        />
        <div className="flex items-center gap-1.5">
          <Btn label="Update Inventory" onClick={runInventory} color="orange" />
          <StatusBadge ok={invOk} />
        </div>
        {invRes && <JsonBlock data={invRes} />}
      </div>
    </div>
  );
}

function DevicePanel() {
  const { run: runTypes, result: typesRes, ok: typesOk } = useApiCall(() => backendApi.listDeviceTypes());
  const { run: runList, result: listRes, ok: listOk } = useApiCall(() => backendApi.listDevices());
  const [regForm, setRegForm] = useState({ name: '', type: 'smart-bulb', room_id: '' });
  const { run: runReg, result: regRes, ok: regOk } = useApiCall(() =>
    backendApi.registerDevice(undefined, { name: regForm.name, type: regForm.type, room_id: regForm.room_id || undefined })
  );
  const [updateForm, setUpdateForm] = useState({ device_id: '', property: 'isOn', value: 'true' });
  const [updateRes, setUpdateRes] = useState<unknown>(null); const [updateOk, setUpdateOk] = useState<boolean | null>(null);
  const [deleteId, setDeleteId] = useState('');
  const [deleteRes, setDeleteRes] = useState<unknown>(null); const [deleteOk, setDeleteOk] = useState<boolean | null>(null);
  const [onlineForm, setOnlineForm] = useState({ device_id: '', online: true });
  const [onlineRes, setOnlineRes] = useState<unknown>(null); const [onlineOk, setOnlineOk] = useState<boolean | null>(null);

  const runUpdate = async () => {
    try {
      const v = updateForm.value === 'true' ? true : updateForm.value === 'false' ? false : updateForm.value;
      const r = await backendApi.updateDevice(undefined, updateForm.device_id, updateForm.property, v);
      setUpdateRes(r); setUpdateOk(true);
    } catch (e) { setUpdateRes({ error: e instanceof Error ? e.message : 'err' }); setUpdateOk(false); }
  };
  const runDelete = async () => {
    try { const r = await backendApi.deleteDevice(undefined, deleteId); setDeleteRes(r); setDeleteOk(true); }
    catch (e) { setDeleteRes({ error: e instanceof Error ? e.message : 'err' }); setDeleteOk(false); }
  };
  const runOnline = async () => {
    try { const r = await backendApi.setDeviceOnline(undefined, onlineForm.device_id, onlineForm.online); setOnlineRes(r); setOnlineOk(true); }
    catch (e) { setOnlineRes({ error: e instanceof Error ? e.message : 'err' }); setOnlineOk(false); }
  };

  const inp = (placeholder: string, value: string, onChange: (v: string) => void) => (
    <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]" />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <div className="flex items-center gap-1.5">
          <Btn label="Device Types" onClick={runTypes} color="blue" />
          <StatusBadge ok={typesOk} />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="List Devices" onClick={runList} color="blue" />
          <StatusBadge ok={listOk} />
        </div>
      </div>
      {typesRes && <JsonBlock data={typesRes} />}
      {listRes && <JsonBlock data={listRes} />}

      {/* POST — register */}
      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">POST — Register Device</p>
        {inp('Device name', regForm.name, (v) => setRegForm((f) => ({ ...f, name: v })))}
        {inp('Type (e.g. smart-bulb)', regForm.type, (v) => setRegForm((f) => ({ ...f, type: v })))}
        {inp('Room ID (optional)', regForm.room_id, (v) => setRegForm((f) => ({ ...f, room_id: v })))}
        <div className="flex items-center gap-1.5">
          <Btn label="Register" onClick={runReg} color="green" />
          <StatusBadge ok={regOk} />
        </div>
        {regRes && <JsonBlock data={regRes} />}
      </div>

      {/* PATCH — update property */}
      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">PATCH — Update Property</p>
        {inp('Device ID', updateForm.device_id, (v) => setUpdateForm((f) => ({ ...f, device_id: v })))}
        <div className="flex gap-1.5">
          {inp('Property', updateForm.property, (v) => setUpdateForm((f) => ({ ...f, property: v })))}
          {inp('Value', updateForm.value, (v) => setUpdateForm((f) => ({ ...f, value: v })))}
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Update" onClick={runUpdate} color="orange" />
          <StatusBadge ok={updateOk} />
        </div>
        {updateRes && <JsonBlock data={updateRes} />}
      </div>

      {/* PATCH — set online */}
      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">PATCH — Set Online/Offline</p>
        <div className="flex gap-1.5 items-center">
          {inp('Device ID', onlineForm.device_id, (v) => setOnlineForm((f) => ({ ...f, device_id: v })))}
          <select value={String(onlineForm.online)} onChange={(e) => setOnlineForm((f) => ({ ...f, online: e.target.value === 'true' }))}
            className="bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none">
            <option value="true">Online</option>
            <option value="false">Offline</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Set" onClick={runOnline} color="blue" />
          <StatusBadge ok={onlineOk} />
        </div>
        {onlineRes && <JsonBlock data={onlineRes} />}
      </div>

      {/* DELETE */}
      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">DELETE — Remove Device</p>
        <div className="flex gap-1.5">
          {inp('Device ID', deleteId, setDeleteId)}
          <Btn label="Delete" onClick={runDelete} color="red" />
        </div>
        <StatusBadge ok={deleteOk} />
        {deleteRes && <JsonBlock data={deleteRes} />}
      </div>
    </div>
  );
}

function RoomsPanel() {
  const { run: runList, result: listRes, ok: listOk } = useApiCall(() => backendApi.listRooms());
  const [roomForm, setRoomForm] = useState({ name: '', width: '5', depth: '5' });
  const { run: runCreate, result: createRes, ok: createOk } = useApiCall(() =>
    backendApi.createRoom(undefined, { name: roomForm.name, width: Number(roomForm.width), depth: Number(roomForm.depth) })
  );
  const [occForm, setOccForm] = useState({ room_id: '', occupied: true });
  const [occRes, setOccRes] = useState<unknown>(null); const [occOk, setOccOk] = useState<boolean | null>(null);

  const runOccupancy = async () => {
    try { const r = await backendApi.updateOccupancy(undefined, occForm.room_id, occForm.occupied); setOccRes(r); setOccOk(true); }
    catch (e) { setOccRes({ error: e instanceof Error ? e.message : 'err' }); setOccOk(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Btn label="List Rooms" onClick={runList} color="blue" />
        <StatusBadge ok={listOk} />
      </div>
      {listRes && <JsonBlock data={listRes} />}

      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">POST — Create Room</p>
        <input placeholder="Room name" value={roomForm.name} onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))}
          className="bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]" />
        <div className="flex gap-1.5">
          <input placeholder="Width (m)" value={roomForm.width} onChange={(e) => setRoomForm((f) => ({ ...f, width: e.target.value }))}
            className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]" />
          <input placeholder="Depth (m)" value={roomForm.depth} onChange={(e) => setRoomForm((f) => ({ ...f, depth: e.target.value }))}
            className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]" />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Create" onClick={runCreate} color="green" />
          <StatusBadge ok={createOk} />
        </div>
        {createRes && <JsonBlock data={createRes} />}
      </div>

      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">PATCH — Room Occupancy</p>
        <div className="flex gap-1.5 items-center">
          <input placeholder="Room ID" value={occForm.room_id} onChange={(e) => setOccForm((f) => ({ ...f, room_id: e.target.value }))}
            className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]" />
          <select value={String(occForm.occupied)} onChange={(e) => setOccForm((f) => ({ ...f, occupied: e.target.value === 'true' }))}
            className="bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none">
            <option value="true">Occupied</option>
            <option value="false">Empty</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Update" onClick={runOccupancy} color="orange" />
          <StatusBadge ok={occOk} />
        </div>
        {occRes && <JsonBlock data={occRes} />}
      </div>
    </div>
  );
}

const REGIMES = ['normal', 'sleep', 'away', 'party', 'work', 'morning', 'evening'];

function RegimePanel() {
  const [regime, setRegime] = useState(REGIMES[0]);
  const { run: runGet, result: getRes, ok: getOk } = useApiCall(() => backendApi.getRegime());
  const { run: runForce, result: forceRes, ok: forceOk } = useApiCall(() => backendApi.forceRegime(undefined, regime));
  const { run: runRefresh, result: refreshRes, ok: refreshOk } = useApiCall(() => backendApi.refreshRegime());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Btn label="Get Regime" onClick={runGet} color="blue" />
        <StatusBadge ok={getOk} msg={(getRes as RegimeState | null)?.current_regime} />
      </div>
      {getRes && <JsonBlock data={getRes} />}

      <div className="flex items-center gap-1.5">
        <Btn label="Refresh" onClick={runRefresh} color="gray" />
        <StatusBadge ok={refreshOk} />
      </div>
      {refreshRes && <JsonBlock data={refreshRes} />}

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">Force Regime</p>
        <div className="flex gap-1.5">
          <select
            value={regime}
            onChange={(e) => setRegime(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]"
          >
            {REGIMES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <Btn label="Force" onClick={runForce} color="orange" />
            <StatusBadge ok={forceOk} />
          </div>
        </div>
        {forceRes && <JsonBlock data={forceRes} />}
      </div>
    </div>
  );
}

function RulesPanel() {
  const { run: runList, result: listRes, ok: listOk } = useApiCall(() => backendApi.listT0Rules());
  const { run: runMine, result: mineRes, ok: mineOk } = useApiCall(() => backendApi.runRuleMiner());
  const { run: runProposed, result: proposedRes, ok: proposedOk } = useApiCall(() => backendApi.listProposedRules());
  const [actionRes, setActionRes] = useState<{ ok: boolean; id: string; msg: string } | null>(null);

  const confirmRule = async (id: string) => {
    try {
      const res = await backendApi.confirmRule(undefined, id);
      setActionRes({ ok: true, id, msg: String((res as { message?: string }).message ?? 'confirmed') });
    } catch (e) {
      setActionRes({ ok: false, id, msg: e instanceof Error ? e.message : 'error' });
    }
  };

  const rejectRule = async (id: string) => {
    try {
      const res = await backendApi.rejectRule(undefined, id);
      setActionRes({ ok: true, id, msg: String((res as { message?: string }).message ?? 'rejected') });
    } catch (e) {
      setActionRes({ ok: false, id, msg: e instanceof Error ? e.message : 'error' });
    }
  };

  const proposed = (proposedRes as { proposed?: ProposedRule[] } | null)?.proposed ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <div className="flex items-center gap-1.5">
          <Btn label="T0 Rules" onClick={runList} color="blue" />
          <StatusBadge ok={listOk} />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Run Miner" onClick={runMine} color="orange" />
          <StatusBadge ok={mineOk} />
        </div>
      </div>

      {listRes && (
        <div>
          <p className="text-[9px] text-[#555] mb-1">
            {(listRes as { rules?: T0Rule[] }).rules?.length ?? 0} T0 rules
          </p>
          <JsonBlock data={listRes} />
        </div>
      )}
      {mineRes && <JsonBlock data={mineRes} />}

      <div className="flex items-center gap-1.5">
        <Btn label="Proposed Rules" onClick={runProposed} color="blue" />
        <StatusBadge ok={proposedOk} />
      </div>

      {proposed.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {proposed.map((p) => (
            <div key={p.proposal_id} className="border border-[#2A2A2A] rounded-lg p-2 flex flex-col gap-1">
              <p className="text-[10px] text-white font-medium">{p.description}</p>
              <p className="text-[9px] text-[#555]">Confidence: {((p.confidence ?? 0) * 100).toFixed(0)}% · {p.status}</p>
              {p.status === 'pending' && (
                <div className="flex gap-1 mt-0.5">
                  <Btn label="Confirm" onClick={() => confirmRule(p.proposal_id)} color="green" small />
                  <Btn label="Reject" onClick={() => rejectRule(p.proposal_id)} color="red" small />
                </div>
              )}
              {actionRes?.id === p.proposal_id && (
                <StatusBadge ok={actionRes.ok} msg={actionRes.msg} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VoicePanel() {
  const { run: runConfig, result: configRes, ok: configOk } = useApiCall(() => backendApi.getVoiceConfig());
  const [ttsText, setTtsText] = useState('Hello, your home is ready.');
  const { run: runTts, result: ttsRes, ok: ttsOk } = useApiCall(() => backendApi.speak(ttsText));
  const [respondText, setRespondText] = useState('');
  const [respondRes, setRespondRes] = useState<unknown>(null);
  const [respondOk, setRespondOk] = useState<boolean | null>(null);
  const { run: runDemo, result: demoRes, ok: demoOk } = useApiCall(() => backendApi.getDemoPhrases());

  const runRespond = async () => {
    try {
      const { apiClient, endpoints } = await import('../../api');
      const res = await apiClient.post(endpoints.voiceRespond, { text: respondText });
      setRespondRes(res); setRespondOk(true);
    } catch (e) {
      setRespondRes({ error: e instanceof Error ? e.message : 'error' }); setRespondOk(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Btn label="Voice Config" onClick={runConfig} color="blue" />
        <StatusBadge ok={configOk} />
      </div>
      {configRes && <JsonBlock data={configRes} />}

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">POST /voice/speak (TTS)</p>
        <input
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          className="bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]"
        />
        <div className="flex items-center gap-1.5">
          <Btn label="Synthesize" onClick={runTts} color="blue" />
          <StatusBadge ok={ttsOk} />
        </div>
        {ttsRes && <JsonBlock data={ttsRes} />}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">POST /voice/respond</p>
        <input
          value={respondText}
          onChange={(e) => setRespondText(e.target.value)}
          placeholder="Event result text to speak aloud"
          className="bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]"
        />
        <div className="flex items-center gap-1.5">
          <Btn label="Respond" onClick={runRespond} color="blue" />
          <StatusBadge ok={respondOk} />
        </div>
        {respondRes && <JsonBlock data={respondRes} />}
      </div>

      {/* GET /voice/speak — TTS via query param */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">GET /voice/speak</p>
        <a
          href={`${env.BACKEND_URL}/api/voice/speak?text=${encodeURIComponent(ttsText)}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-[#00A8E0] underline truncate"
        >
          Open audio URL ↗
        </a>
      </div>

      <div className="flex items-center gap-1.5">
        <Btn label="Demo Phrases" onClick={runDemo} color="gray" />
        <StatusBadge ok={demoOk} />
      </div>
      {demoRes && <JsonBlock data={demoRes} />}
    </div>
  );
}

const SIMULATIONS: { key: keyof typeof backendApi; label: string; color: 'orange' | 'red' | 'blue' | 'gray' }[] = [
  { key: 'simulateGeyser',       label: '🚿 Geyser',           color: 'red' },
  { key: 'simulateInventoryDrop',label: '📦 Inventory Drop',    color: 'orange' },
  { key: 'simulateUnknownSound', label: '🔊 Unknown Sound',     color: 'orange' },
  { key: 'simulateMotorSafety',  label: '⚙️ Motor Safety',      color: 'red' },
  { key: 'simulateStudyMode',    label: '📚 Study Mode',         color: 'blue' },
  { key: 'simulateNightSafety',  label: '🌙 Night Safety',       color: 'blue' },
  { key: 'simulatePowerCut',     label: '⚡ Power Cut',           color: 'red' },
];

function SimulatePanel() {
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [voiceText, setVoiceText] = useState('turn on the lights');

  const run = async (key: string, fn: () => Promise<unknown>) => {
    try {
      const res = await fn();
      setResults((r) => ({ ...r, [key]: { ok: true, msg: (res as { message?: string })?.message ?? 'done' } }));
    } catch (e) {
      setResults((r) => ({ ...r, [key]: { ok: false, msg: e instanceof Error ? e.message : 'error' } }));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-1.5">
        {SIMULATIONS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between">
            <Btn label={label} onClick={() => run(key, () => (backendApi[key] as () => Promise<unknown>)())} color={color} />
            {results[key] && <StatusBadge ok={results[key].ok} msg={results[key].msg} />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-[#2A2A2A] pt-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">Voice Command Sim</p>
        <input
          value={voiceText}
          onChange={(e) => setVoiceText(e.target.value)}
          className="bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]"
        />
        <div className="flex items-center gap-1.5">
          <Btn
            label="Simulate Voice"
            onClick={() => run('voiceCommand', () => backendApi.simulateVoiceCommand(undefined, voiceText))}
            color="blue"
          />
          {results['voiceCommand'] && <StatusBadge ok={results['voiceCommand'].ok} msg={results['voiceCommand'].msg} />}
        </div>
      </div>
    </div>
  );
}

function AppStoreExtrasPanel() {
  const { run: runTemplate, result: templateRes, ok: templateOk } = useApiCall(() => backendApi.getModuleTemplate());
  const { run: runMods, result: modsRes, ok: modsOk } = useApiCall(() => backendApi.getInstalledModules());
  const [soundClusterId, setSoundClusterId] = useState('');
  const [soundRes, setSoundRes] = useState<unknown>(null); const [soundOk, setSoundOk] = useState<boolean | null>(null);

  const runIdentifySound = async () => {
    if (!soundClusterId.trim()) return;
    try { const r = await backendApi.identifySound(undefined, soundClusterId); setSoundRes(r); setSoundOk(true); }
    catch (e) { setSoundRes({ error: e instanceof Error ? e.message : 'err' }); setSoundOk(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <div className="flex items-center gap-1.5">
          <Btn label="Module Template" onClick={runTemplate} color="blue" />
          <StatusBadge ok={templateOk} />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn label="Installed Modules" onClick={runMods} color="blue" />
          <StatusBadge ok={modsOk} />
        </div>
      </div>
      {templateRes && <JsonBlock data={templateRes} />}
      {modsRes && <JsonBlock data={modsRes} />}

      {/* PATCH /sounds/:cluster_id/identify */}
      <div className="border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2">
        <p className="text-[9px] font-bold text-[#8A8A8A] uppercase tracking-wider">PATCH — Identify Sound Cluster</p>
        <div className="flex gap-1.5">
          <input
            placeholder="Cluster ID"
            value={soundClusterId}
            onChange={(e) => setSoundClusterId(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#00A8E0]"
          />
          <Btn label="Identify" onClick={runIdentifySound} color="orange" />
        </div>
        <StatusBadge ok={soundOk} />
        {soundRes && <JsonBlock data={soundRes} />}
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function BackendPanel() {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[#121212] h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold text-[#00A8E0] uppercase tracking-widest">Backend API Explorer</p>
        <span className="text-[9px] text-[#555]">{env.BACKEND_URL}</span>
      </div>

      <Section title="Health" icon="💚" defaultOpen>
        <HealthPanel />
      </Section>

      <Section title="Home" icon="🏠">
        <HomePanel />
      </Section>

      <Section title="Devices" icon="💡">
        <DevicePanel />
      </Section>

      <Section title="Rooms" icon="🛋️">
        <RoomsPanel />
      </Section>

      <Section title="Regime" icon="🎛️">
        <RegimePanel />
      </Section>

      <Section title="Rules" icon="📋">
        <RulesPanel />
      </Section>

      <Section title="Voice" icon="🎙️">
        <VoicePanel />
      </Section>

      <Section title="Simulate" icon="⚡" defaultOpen>
        <SimulatePanel />
      </Section>

      <Section title="App Store Extras" icon="🛒">
        <AppStoreExtrasPanel />
      </Section>
    </div>
  );
}
