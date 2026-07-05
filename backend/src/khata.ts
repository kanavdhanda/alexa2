export interface KhataEntry {
  id: string;
  vendor: 'doodhwala' | 'dhobi' | 'maid' | 'newspaper';
  vendor_hi: string;
  kind: 'delivery' | 'missed' | 'items' | 'payment';
  quantity: number;
  unit: string;
  amount_inr: number;
  date: string;
  raw: string;
}

export interface SettleLine {
  vendor: 'doodhwala' | 'dhobi' | 'maid' | 'newspaper';
  vendor_hi: string;
  detail: string;
  amount_inr: number;
}

export interface VendorLedger {
  vendor: 'doodhwala' | 'dhobi' | 'maid' | 'newspaper';
  vendor_hi: string;
  entries: KhataEntry[];
  subtotal_inr: number;
}

const vendorMap: Record<string, { vendor: 'doodhwala' | 'dhobi' | 'maid' | 'newspaper'; vendor_hi: string; rate: number }> = {
  doodhwala: { vendor: 'doodhwala', vendor_hi: 'दूधवाला', rate: 60 },
  dhobi: { vendor: 'dhobi', vendor_hi: 'धोबी', rate: 30 },
  maid: { vendor: 'maid', vendor_hi: 'नौकरानी', rate: 15 },
  newspaper: { vendor: 'newspaper', vendor_hi: 'अखबार वाला', rate: 5 },
};

export function parseKhataUtteranceMock(utterance: string): KhataEntry {
  const lower = utterance.toLowerCase();
  let vendor: 'doodhwala' | 'dhobi' | 'maid' | 'newspaper' = 'doodhwala';
  let kind: 'delivery' | 'missed' | 'items' | 'payment' = 'delivery';
  let quantity = 1;
  let unit = 'item';
  let amount = 0;

  // Detect vendor
  if (lower.includes('doodhwala')) vendor = 'doodhwala';
  else if (lower.includes('dhobi')) vendor = 'dhobi';
  else if (lower.includes('maid')) vendor = 'maid';
  else if (lower.includes('newspaper')) vendor = 'newspaper';

  // Detect kind
  if (lower.includes('missed') || lower.includes('nahi') || lower.includes('nai')) kind = 'missed';
  else if (lower.includes('payment') || lower.includes('pay') || lower.includes('rupees')) kind = 'payment';
  else if (lower.includes('items') || lower.includes('kapde')) kind = 'items';
  else kind = 'delivery';

  // Extract quantity and unit
  const numberMatch = utterance.match(/(\d+)/);
  if (numberMatch) quantity = parseInt(numberMatch[1], 10);

  if (lower.includes('liter')) unit = 'liter';
  else if (lower.includes('kapde') || lower.includes('items')) unit = 'items';
  else if (lower.includes('din') || lower.includes('days')) unit = 'days';
  else unit = 'item';

  // Extract amount if present (₹ or rupees)
  const rupeeMatch = utterance.match(/₹\s*(\d+)\s*(?!per)|(\d+)\s*rupees/i);
  const perRate = utterance.match(/₹\s*(\d+)\s*per|(\d+)\s*per/i);

  if (perRate && kind !== 'payment') {
    // For delivery with per-unit rate: quantity * rate
    const rate = parseInt(perRate[1] || perRate[2], 10);
    amount = quantity * rate;
  } else if (rupeeMatch) {
    amount = parseInt(rupeeMatch[1] || rupeeMatch[2], 10);
  } else if (kind === 'payment') {
    // For payment, extract amount from context
    const payMatch = utterance.match(/(\d+)/);
    if (payMatch) amount = parseInt(payMatch[1], 10);
  } else {
    // For delivery without specific amount, calculate: quantity * rate
    const vendorInfo = vendorMap[vendor];
    amount = quantity * vendorInfo.rate;
  }

  const vendorInfo = vendorMap[vendor];
  return {
    id: `khata-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    vendor,
    vendor_hi: vendorInfo.vendor_hi,
    kind,
    quantity,
    unit,
    amount_inr: amount,
    date: new Date().toISOString().split('T')[0],
    raw: utterance,
  };
}

class KhataStore {
  private byHome = new Map<string, KhataEntry[]>();

  reset() {
    this.byHome.clear();
  }

  add(homeId: string, entry: KhataEntry) {
    if (!this.byHome.has(homeId)) this.byHome.set(homeId, []);
    this.byHome.get(homeId)!.push(entry);
  }

  ledger(homeId: string) {
    const entries = this.byHome.get(homeId) ?? [];
    const vendors = [...new Set(entries.map(e => e.vendor))].map(v => {
      const ve = entries.filter(e => e.vendor === v);
      return { vendor: v, vendor_hi: ve[0].vendor_hi, entries: ve, subtotal_inr: ve.reduce((s, e) => s + e.amount_inr, 0) };
    });
    return { vendors, month: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
  }

  settle(homeId: string) {
    const { vendors } = this.ledger(homeId);
    const lines: SettleLine[] = vendors.map(v => ({
      vendor: v.vendor, vendor_hi: v.vendor_hi,
      detail: `${v.entries.length} entries`, amount_inr: v.subtotal_inr,
    }));
    const total = lines.reduce((s, l) => s + l.amount_inr, 0);
    return { lines, total_inr: total, upi_link: `upi://pay?pa=household@upi&am=${total}&tn=Monthly%20hisab` };
  }
}

export const khataStore = new KhataStore();
