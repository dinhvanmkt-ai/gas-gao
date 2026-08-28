"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Loader2, Package, TrendingDown, Calendar, X, Pencil } from "lucide-react";

interface RicePurchase {
  id: string;
  purchaseDate: string;
  supplierName: string | null;
  riceType: string;
  totalKg: number;
  pricePerKg: number;
  totalCost: number;
  note: string | null;
}

const EMPTY_FORM = {
  purchaseDate: new Date().toISOString().split("T")[0],
  supplierName: "",
  riceType: "",
  totalKg: "",
  pricePerKg: "",
  note: "",
};

function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()}`;
}

export default function RicePurchasesPage() {
  const [records, setRecords] = useState<RicePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Date filter
  const [preset, setPreset] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  function getRange() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === "month") return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    };
    if (preset === "lastMonth") {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: f.toISOString().split("T")[0], to: t.toISOString().split("T")[0] };
    }
    if (preset === "3months") {
      const f = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from: f.toISOString().split("T")[0], to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0] };
    }
    if (preset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    };
  }

  async function load() {
    setLoading(true);
    const range = getRange();
    const params = new URLSearchParams({ from: range.from, to: range.to });
    const res = await fetch(`/api/rice-purchases?${params}`);
    const data = await res.json();
    setRecords(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [preset, customFrom, customTo]);

  const totalKg = useMemo(() => records.reduce((s, r) => s + r.totalKg, 0), [records]);
  const totalCost = useMemo(() => records.reduce((s, r) => s + r.totalCost, 0), [records]);
  const avgPrice = totalKg > 0 ? totalCost / totalKg : 0;

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM, purchaseDate: new Date().toISOString().split("T")[0] });
    setError("");
    setShowForm(true);
  }

  function openEdit(r: RicePurchase) {
    setEditId(r.id);
    setForm({
      purchaseDate: r.purchaseDate.split("T")[0],
      supplierName: r.supplierName ?? "",
      riceType: r.riceType,
      totalKg: String(r.totalKg),
      pricePerKg: String(r.pricePerKg),
      note: r.note ?? "",
    });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.riceType.trim()) { setError("Vui lòng nhập loại gạo"); return; }
    if (!form.totalKg || Number(form.totalKg) <= 0) { setError("Số kg phải lớn hơn 0"); return; }
    if (!form.pricePerKg || Number(form.pricePerKg) <= 0) { setError("Giá/kg phải lớn hơn 0"); return; }

    setSaving(true);
    setError("");
    const url = editId ? `/api/rice-purchases/${editId}` : "/api/rice-purchases";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, totalKg: Number(form.totalKg), pricePerKg: Number(form.pricePerKg) }),
    });
    if (res.ok) {
      setShowForm(false);
      setEditId(null);
      await load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Có lỗi xảy ra");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/rice-purchases/${id}`, { method: "DELETE" });
    if (res.ok) { setDeleteId(null); await load(); }
  }

  const PRESETS = [
    { key: "month", label: "Tháng này" },
    { key: "lastMonth", label: "Tháng trước" },
    { key: "3months", label: "3 tháng" },
    { key: "custom", label: "Tùy chọn" },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Nhập Gạo" subtitle="Theo dõi lượng gạo nhập vào theo kg" />
      <main className="flex-1 p-6 space-y-5">

        {/* Date filter */}
        <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Khoảng thời gian:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${preset === p.key ? "bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20" : "bg-slate-800/60 text-slate-400 border-slate-700 hover:border-green-500/50 hover:text-slate-200"}`}
              >{p.label}</button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input py-1 text-xs w-auto" />
              <span className="text-slate-500">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input py-1 text-xs w-auto" />
            </div>
          )}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 kpi-green">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tổng kg nhập</p>
            <p className="text-2xl font-bold text-emerald-400">{totalKg.toLocaleString("vi-VN")} kg</p>
            <p className="text-xs text-slate-500 mt-1">{records.length} phiếu nhập</p>
          </div>
          <div className="card p-5 kpi-blue">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tổng tiền nhập</p>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalCost)}</p>
          </div>
          <div className="card p-5 kpi-orange">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Giá bình quân</p>
            <p className="text-2xl font-bold text-orange-400">{formatCurrency(avgPrice)}<span className="text-sm font-normal text-slate-400">/kg</span></p>
          </div>
        </div>

        {/* List */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Package className="w-4 h-4 text-green-400" /> Danh sách phiếu nhập gạo
            </h3>
            <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
              <Plus className="w-4 h-4" /> Thêm phiếu nhập
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-500" /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Chưa có phiếu nhập gạo nào trong kỳ này</p>
              <button onClick={openAdd} className="mt-3 text-green-400 hover:text-green-300 text-sm">+ Thêm phiếu nhập đầu tiên</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày nhập</th>
                    <th>Loại gạo</th>
                    <th>Nhà cung cấp</th>
                    <th>Số kg</th>
                    <th>Giá/kg</th>
                    <th>Tổng tiền</th>
                    <th>Ghi chú</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td className="text-slate-400 text-xs whitespace-nowrap">{formatDate(r.purchaseDate)}</td>
                      <td className="font-medium text-emerald-400">{r.riceType}</td>
                      <td className="text-slate-400">{r.supplierName ?? <span className="text-slate-600">—</span>}</td>
                      <td className="font-semibold">{r.totalKg.toLocaleString("vi-VN")} kg</td>
                      <td>{formatCurrency(r.pricePerKg)}</td>
                      <td className="font-semibold text-blue-400">{formatCurrency(r.totalCost)}</td>
                      <td className="text-slate-400 text-xs max-w-[160px] truncate">{r.note ?? "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(r.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800/60 font-bold">
                    <td colSpan={3} className="text-slate-300">Tổng cộng</td>
                    <td className="text-emerald-400">{totalKg.toLocaleString("vi-VN")} kg</td>
                    <td className="text-slate-400 text-xs">BQ: {formatCurrency(avgPrice)}</td>
                    <td className="text-blue-400">{formatCurrency(totalCost)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200">{editId ? "Sửa phiếu nhập gạo" : "Thêm phiếu nhập gạo"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ngày nhập</label>
                <input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Loại gạo <span className="text-red-400">*</span></label>
                <input type="text" placeholder="VD: ST25, Jasmine, Bắc Hương..." value={form.riceType} onChange={e => setForm(f => ({ ...f, riceType: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nhà cung cấp</label>
                <input type="text" placeholder="Tên NCC (không bắt buộc)" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} className="input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Số kg <span className="text-red-400">*</span></label>
                  <input type="number" min="0" step="0.5" placeholder="100" value={form.totalKg} onChange={e => setForm(f => ({ ...f, totalKg: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Giá/kg (đ) <span className="text-red-400">*</span></label>
                  <input type="number" min="0" step="100" placeholder="18000" value={form.pricePerKg} onChange={e => setForm(f => ({ ...f, pricePerKg: e.target.value }))} className="input w-full" />
                </div>
              </div>
              {form.totalKg && form.pricePerKg && Number(form.totalKg) > 0 && Number(form.pricePerKg) > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-sm">
                  <span className="text-slate-400">Tổng tiền: </span>
                  <span className="font-bold text-green-400">{formatCurrency(Number(form.totalKg) * Number(form.pricePerKg))}</span>
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ghi chú</label>
                <textarea rows={2} placeholder="Ghi chú thêm..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="input w-full resize-none" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm transition-colors">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editId ? "Lưu thay đổi" : "Thêm phiếu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {deleteId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-slate-200">Xác nhận xóa</h3>
            <p className="text-sm text-slate-400">Bạn có chắc muốn xóa phiếu nhập gạo này không?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm transition-colors">Hủy</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm transition-colors">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}