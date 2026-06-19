"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PlatformShell from "@/components/PlatformShell";

type BreakoutRoom = { id: string; name: string; isActive: boolean };
type Meeting = {
  id: string; title: string; roomName: string; type: string;
  host?: { name: string } | null; participantCount?: number;
  createdAt: string; isActive: boolean;
};

export default function AdminMeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [persistent, setPersistent] = useState<Meeting | null>(null);
  const [rooms, setRooms] = useState<BreakoutRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState("");
  const [editingRoom, setEditingRoom] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [persistRes, meetListRes] = await Promise.all([
        fetch("/api/meetings/persistent"),
        fetch("/api/meetings"),
      ]);
      if (persistRes.ok) {
        const d = await persistRes.json();
        setPersistent(d.meeting || null);
        setRooms(d.meeting?.breakoutRooms || []);
      }
      if (meetListRes.ok) {
        const d = await meetListRes.json();
        setMeetings(d.meetings || []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveRooms(newRooms: string[]) {
    if (!persistent) return;
    setSaving(true);
    await fetch("/api/meetings/persistent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ breakoutRoomNames: newRooms }),
    });
    await fetchData();
    setSaving(false);
  }

  function handleAdd() {
    if (!newRoomName.trim()) return;
    saveRooms([...rooms.map(r => r.name), newRoomName.trim()]);
    setNewRoomName("");
  }

  function handleRename(id: string) {
    if (!editingRoom || !editingRoom.name.trim()) return;
    saveRooms(rooms.map(r => r.id === id ? editingRoom.name.trim() : r.name));
    setEditingRoom(null);
  }

  function handleDelete(name: string) {
    if (!confirm(`Delete breakout room "${name}"?`)) return;
    saveRooms(rooms.filter(r => r.name !== name).map(r => r.name));
  }

  if (loading) return <PlatformShell title="Meetings" description="Loading..." user={{ id: "", name: "", email: "", role: "super_admin" as const }}><div className="p-6 text-slate-400">Loading...</div></PlatformShell>;

  return (
    <PlatformShell title="Meetings" description="View and manage all meeting rooms." user={{ id: "", name: "", email: "", role: "super_admin" as const }}>
      <div className="grid gap-6">
        {persistent && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-bold text-white">Breakout Rooms — {persistent.title}</h2>
            <div className="mb-4 flex gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                placeholder="New room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
              <button onClick={handleAdd} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 transition disabled:opacity-50">
                {saving ? "..." : "Add"}
              </button>
            </div>
            <div className="space-y-2">
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2">
                  {editingRoom?.id === r.id ? (
                    <>
                      <input
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-sm text-white outline-none"
                        value={editingRoom.name}
                        onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(r.id); if (e.key === "Escape") setEditingRoom(null); }}
                      />
                      <button onClick={() => handleRename(r.id)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Save</button>
                      <button onClick={() => setEditingRoom(null)} className="rounded-lg bg-slate-600 px-2 py-1 text-xs text-slate-300">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-200">{r.name}</span>
                      <button onClick={() => setEditingRoom({ id: r.id, name: r.name })} className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600">Rename</button>
                      <button onClick={() => handleDelete(r.name)} className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20">Delete</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-widest text-slate-400">
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Room</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Host</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Participants</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m.id} className="border-b border-slate-800 text-slate-300">
                    <td className="px-3 py-3 font-medium text-white">{m.title}</td>
                    <td className="px-3 py-3 font-mono text-xs">{m.roomName}</td>
                    <td className="px-3 py-3 capitalize">{m.type}</td>
                    <td className="px-3 py-3">{m.host?.name || "-"}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${m.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>{m.isActive ? "Active" : "Ended"}</span></td>
                    <td className="px-3 py-3">{m.participantCount ?? 0}</td>
                    <td className="px-3 py-3 text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}