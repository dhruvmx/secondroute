"use client";
import Image from "next/image";
import { requestJSON, connectionMessage } from "@/lib/connection";
import { RecordNote } from "./record-note";
import VenueMap from "./venue-map";
import {
  AccountProvider,
  useAccount,
  ProfileButton,
  Notifications,
  Appearance,
  AccountSettings,
  ThemeEffect,
} from "./account-controls";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Leaf,
  MapPin,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import LocationPicker from "./location-picker";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Batch, Event, State } from "@/lib/types";
import { useUI, useSidebar, type SidebarMode } from "./ui-store";
import {
  enqueue,
  readQueue,
  syncQueue,
  setQueueWorkspace,
  type PendingCapture,
} from "./offline";

const nav = [
  ["Overview", LayoutDashboard],
  ["Events & zones", MapPin],
  ["Material batches", Boxes],
  ["Dispatch", Truck],
  ["Partner receipts", ClipboardList],
  ["Passports", ShieldCheck],
  ["Reports & impact", FileText],
] as const;
const materials = [
  "Cardboard",
  "Paper",
  "PET bottles",
  "Aluminum",
  "Reusable fixtures",
  "Signage",
  "Unknown",
];
const format = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(n);
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <span />
      {status}
    </span>
  );
}
function Mark() {
  return (
    <span className="brand-mark">
      <Route size={24} strokeWidth={2.6} />
    </span>
  );
}

export default function Operations() {
  return (
    <AccountProvider>
      <WorkspaceBoundary />
    </AccountProvider>
  );
}
function WorkspaceBoundary() {
  const { account, ready } = useAccount();
  return ready ? (
    <Workspace key={account.user?.id || "sample"} />
  ) : (
    <div className="map-placeholder">Opening your workspace...</div>
  );
}
function Workspace() {
  const {
    account,
    ready: accountReady,
    signIn,
    refresh: refreshAccount,
  } = useAccount();
  const [appearance, setAppearance] = useState(false);
  const router = useRouter();
  const [view, setView] = useState("Overview");
  const [state, setState] = useState<State | null>(null);
  const [event, setEvent] = useState(account.user ? "" : "riverlight");
  const [zone, setZone] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<
    "capture" | "event" | "zone" | "editEvent" | "deleteEvent" | null
  >(null);
  const [targetEvent, setTargetEvent] = useState<Event | null>(null);
  const [eventFormCoords, setEventFormCoords] = useState<{
    lat: string;
    lon: string;
  }>({ lat: "", lon: "" });
  const openCreateEvent = () => {
    if (!account.user) {
      signIn();
      return;
    }
    setEventFormCoords({ lat: "", lon: "" });
    setModal("event");
  };
  const openEditEvent = (ev: Event) => {
    if (!account.user) {
      signIn();
      return;
    }
    setTargetEvent(ev);
    setEventFormCoords({
      lat: ev.latitude != null ? String(ev.latitude) : "",
      lon: ev.longitude != null ? String(ev.longitude) : "",
    });
    setModal("editEvent");
  };
  const confirmDeleteEvent = (ev: Event) => {
    if (!account.user) {
      signIn();
      return;
    }
    setTargetEvent(ev);
    setModal("deleteEvent");
  };
  const [selected, setSelected] = useState<Batch | null>(null);
  const [queue, setQueue] = useState<PendingCapture[]>([]);
  const [online, setOnline] = useState(true);
  const { mode: sidebarMode, setMode: setSidebarMode } = useSidebar();
  useEffect(() => {
    void useSidebar.persist.rehydrate();
  }, []);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const { role, setRole } = useUI();
  useEffect(() => {
    setRole(account.user ? account.role || "admin" : "coordinator");
    setQueueWorkspace(account.orgId || "sample");
  }, [account.user, account.orgId, account.role, setRole]);
  const cacheKey = "secondroute.state." + (account.user?.id || "sample");
  const load = useCallback(async () => {
    if (!accountReady) return;
    try {
      const data = await requestJSON<State>(
        "/api/state" + (event ? "?event=" + encodeURIComponent(event) : ""),
        { headers: { "x-demo-role": role }, cache: "no-store" },
      );
      if (!event && data.events?.length) {
        setEvent(data.events[0].id);
        return;
      }
      if (!!account.user !== (data.mode === "workspace")) {
        await refreshAccount();
        return;
      }
      setState(data);
      setOnline(navigator.onLine);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {}
      setError("");
    } catch (loadError) {
      setOnline(false);
      let cached: string | null = null;
      try {
        cached = localStorage.getItem(cacheKey);
      } catch {}
      if (cached) {
        try {
          setState(JSON.parse(cached));
        } catch {}
      }
      setError(
        (loadError instanceof Error ? loadError.message : connectionMessage()) +
          (cached
            ? " Showing previously synchronized records. New captures stay queued."
            : ""),
      );
    }
  }, [event, role, accountReady, account.user, cacheKey, refreshAccount]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      void load();
      if (readQueue().length) void syncQueue();
    }, 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setQueue(readQueue());
      if (navigator.onLine) void syncQueue();
    };
    const initial = setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("queuechange", update);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
    return () => {
      clearTimeout(initial);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("queuechange", update);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const action = async (payload: Record<string, unknown>) => {
    if (!account.user) {
      signIn();
      return null;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-role": role },
        body: JSON.stringify({
          ...payload,
          state: undefined,
          error: undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Action failed");
      await load();
      setNotice("Saved to the recovery record");
      return data;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const batches = (state?.batches || []).filter(
    (b) =>
      (!zone || b.zone_id === zone) &&
      (!status || b.status === status) &&
      (!search ||
        `${b.id} ${b.material} ${b.notes}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const currentEvent =
    state?.events.find((x) => x.id === event) || state?.events[0];
  const zones = state?.zones || [];
  const partners = state?.partners || [];
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name || id;
  const partnerName = (id: string | null) =>
    partners.find((p) => p.id === id)?.name || "Destination pending";
  const visibleCaptures = (state?.captures || []).filter(
    (c) =>
      (!zone || c.zone_id === zone) &&
      (!status || batches.some((b) => b.id === c.batch_id)) &&
      (!search || batches.some((b) => b.id === c.batch_id)),
  );
  const captured = visibleCaptures.reduce((s, c) => s + c.weight, 0),
    recovered = batches
      .filter((b) => b.status === "Verified")
      .reduce((s, b) => s + b.accepted, 0),
    awaiting = batches
      .filter((b) => ["Ready", "Assigned"].includes(b.status))
      .reduce((s, b) => s + b.weight, 0),
    rejected = batches.reduce((s, b) => s + b.rejected, 0);
  const ready = batches.filter((b) => b.status === "Ready");
  const [customCoords, setCustomCoords] = useState<{
    lat?: string;
    lon?: string;
  } | null>(null);
  const [prevEventKey, setPrevEventKey] = useState<string>("");

  const currentEventKey = currentEvent
    ? `${currentEvent.id}:${currentEvent.latitude}:${currentEvent.longitude}`
    : "";

  if (prevEventKey !== currentEventKey) {
    setPrevEventKey(currentEventKey);
    setCustomCoords(null);
  }

  const mapLat =
    customCoords?.lat ??
    (currentEvent?.latitude != null ? String(currentEvent.latitude) : "");
  const mapLon =
    customCoords?.lon ??
    (currentEvent?.longitude != null ? String(currentEvent.longitude) : "");

  const handleLocationSelect = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      setCustomCoords({
        lat: coords.latitude.toFixed(6),
        lon: coords.longitude.toFixed(6),
      });
    },
    [],
  );

  const handleSaveLocation = async (coords: {
    latitude: number;
    longitude: number;
    zoneId?: string;
  }) => {
    if (coords.zoneId) {
      return await action({
        action: "setLocation",
        zone_id: coords.zoneId,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    }
    if (currentEvent) {
      return await action({
        action: "setLocation",
        event_id: currentEvent.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    }
  };

  const go = (name: string) => {
    setView(name);
    setSearch("");
    setStatus("");
  };
  async function exportReport(kind: string) {
    try {
      const response = await fetch(
        `/api/export?format=${kind}&event=${encodeURIComponent(event)}&zone=${encodeURIComponent(zone)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`,
        { headers: { "x-demo-role": role } },
      );
      if (!response.ok) throw Error("Report export failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `secondroute-report.${kind}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className="app-shell" data-sidebar-mode={sidebarMode}>
      <aside
        id="workspace-sidebar"
        className="sidebar"
        aria-label="Workspace menu"
        tabIndex={0}
      >
        <Link className="brand" href="/" aria-label="SecondRoute home">
          <Mark />
          <span>
            SecondRoute<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">R</span>
          <div>
            <strong>{account.workspace || "SecondRoute"}</strong>
            <small>
              {account.user
                ? "Your recovery workspace"
                : "Explore sample records"}
            </small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              aria-label={label}
              title={label}
              aria-current={view === label ? "page" : undefined}
              onClick={() => go(label)}
              className={view === label ? "active" : ""}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Material batches" && (
                <em>{state?.batches.length || 0}</em>
              )}
              {label === "Dispatch" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="route-note">
            <Leaf size={21} />
            <strong>
              A second route.
              <br />A better destination.
            </strong>
            <p>
              Every recovery starts with
              <br />a record you can follow.
            </p>
          </div>
          <button
            className={view === "Settings" ? "active" : ""}
            onClick={() => go("Settings")}
          >
            <Settings2 size={19} />
            Settings & integrations
          </button>
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            Help & guide
            <ArrowUpRight size={15} />
          </button>
          <ProfileButton
            sidebar
            onSettings={() => go("Settings")}
            onAppearance={() => setAppearance(true)}
          />
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="sidebar-toggle icon-button"
              aria-label={
                sidebarMode === "open" ? "Close sidebar" : "Open sidebar"
              }
              aria-controls="workspace-sidebar"
              aria-expanded={sidebarMode === "open"}
              onClick={() =>
                setSidebarMode(sidebarMode === "open" ? "closed" : "open")
              }
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="top-actions">
            <div
              className="sidebar-modes"
              role="group"
              aria-label="Sidebar behavior"
            >
              {(["open", "closed", "hover"] as SidebarMode[]).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={sidebarMode === mode}
                  title={
                    mode === "hover"
                      ? "Expand on pointer hover or keyboard focus"
                      : `Keep sidebar ${mode}`
                  }
                  onClick={() => setSidebarMode(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            {account.user ? (
              <span className="workspace-pill">
                <span />
                YOUR WORKSPACE
              </span>
            ) : (
              <button className="primary account-cta" onClick={signIn}>
                Create account
              </button>
            )}
            <Notifications
              custody={state?.custody || []}
              onBatch={(id) => {
                const b = state?.batches.find((b) => b.id === id);
                if (b) setSelected(b);
              }}
            />
            <ProfileButton
              onSettings={() => go("Settings")}
              onAppearance={() => setAppearance(true)}
            />
          </div>
        </header>
        <div className="content">
          <ThemeEffect />
          {appearance && <Appearance onClose={() => setAppearance(false)} />}
          {!account.user && (
            <div className="sample-banner">
              <span>
                Explore sample recovery records. Create an account to manage
                your own materials.
              </span>
              <button onClick={signIn}>
                Get started <ArrowRight size={15} />
              </button>
            </div>
          )}
          {account.user && state?.events.length === 0 && (
            <div className="info-strip">
              <Leaf />
              <div>
                <strong>Your first second route starts here.</strong>
                <p>
                  Create an event, add recovery zones and partners, then capture
                  your first material.
                </p>
                <button className="primary" onClick={openCreateEvent}>
                  Create your first event
                </button>
              </div>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">MATERIAL RECOVERY OPERATIONS</div>
              <h1>
                {view === "Overview"
                  ? "Good things deserve another route."
                  : view}
              </h1>
              <p>
                {view === "Overview"
                  ? "From the last encore to the next destination. Keep every material moving."
                  : view === "Material batches"
                    ? "Follow each material from field capture to confirmed recovery."
                    : view === "Dispatch"
                      ? "Match ready materials with a compatible recovery partner."
                      : view === "Partner receipts"
                        ? "Record what arrived, what was accepted, and what needs review."
                        : view === "Passports"
                          ? "Tamper-evident records. Traceable destinations."
                          : view === "Reports & impact"
                            ? "Measured recovery, clearly separated from estimates."
                            : view === "Settings"
                              ? "Your workspace, operating mode, and service connections."
                              : "Organize recovery around the places where materials are found."}
              </p>
            </div>
            <button
              className="primary"
              disabled={!!account.user && !zones.length}
              title={
                account.user && !zones.length
                  ? "Create an event and add a recovery zone first"
                  : undefined
              }
              onClick={() => (account.user ? setModal("capture") : signIn())}
            >
              <Plus size={18} />
              Capture material
            </button>
          </div>
          <div className="event-bar">
            <span className="event-icon">
              <Leaf size={19} />
            </span>
            <select
              aria-label="Filter by event"
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setZone("");
              }}
            >
              <option value="" disabled>
                {state?.events.length ? "Select an event" : "No events yet"}
              </option>
              {state?.events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <span className="event-live">
              <span />
              {currentEvent?.status || "Create your first event"}
            </span>
            <div className="event-meta">
              <MapPin size={14} />
              {currentEvent?.location || "Location not set"}
              <span className="divider" />
              <span>
                {currentEvent?.date
                  ? new Date(currentEvent.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Date not set"}
              </span>
            </div>
            {account.user &&
              currentEvent &&
              currentEvent.id !== "riverlight" &&
              currentEvent.id !== "design-week" && (
                <div className="event-bar-actions">
                  <button
                    type="button"
                    className="event-pill-btn"
                    onClick={() => openEditEvent(currentEvent)}
                    title="Edit current event"
                  >
                    <Pencil size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="event-pill-btn danger"
                    onClick={() => confirmDeleteEvent(currentEvent)}
                    title="Delete current event"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            <span className={`sync ${online ? "" : "offline"}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
              {online
                ? queue.length
                  ? `${queue.length} pending sync`
                  : "Workspace connected"
                : "Offline capture available"}
            </span>
          </div>
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button
                onClick={() => {
                  setError("");
                  void load();
                }}
              >
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="toast">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {queue.length > 0 && (
            <div className="alert">
              <Clock3 size={17} />
              {queue.length} capture(s) stored on this device.{" "}
              {queue.map((q) => q.state).join(", ")}
              <button onClick={() => void syncQueue().then(load)}>
                Retry synchronization
              </button>
            </div>
          )}
          {!state ? (
            <div className="loading">
              <RefreshCw size={24} />
              Loading persisted recovery records...
            </div>
          ) : (
            <>
              {["Overview", "Reports & impact"].includes(view) && (
                <>
                  <div className="section-row">
                    <h2>
                      {view === "Overview"
                        ? "The recovery picture"
                        : "Recovery report"}
                    </h2>
                    <div className="inline-controls">
                      <select
                        aria-label="Filter by zone"
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                      >
                        <option value="">All zones</option>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="text-button"
                        onClick={() => void exportReport("csv")}
                      >
                        <ArrowDownToLine size={15} />
                        Export report
                      </button>
                    </div>
                  </div>
                  <div className="metrics">
                    <Metric
                      label="Material captured"
                      value={captured}
                      icon={<Boxes size={18} />}
                      note={`${batches.length} material batches recorded`}
                    />
                    <Metric
                      label="Awaiting pickup"
                      value={awaiting}
                      icon={<Truck size={18} />}
                      note={`${batches.filter((b) => ["Ready", "Assigned"].includes(b.status)).length} batches ready to move`}
                      orange
                    />
                    <Metric
                      label="Confirmed recovery"
                      value={recovered}
                      icon={<Leaf size={18} />}
                      note="Recipient accepted + reviewed"
                      green
                    />
                    <Metric
                      label="Rejected material"
                      value={rejected}
                      icon={<FileCheck2 size={18} />}
                      note="Excluded from recovered totals"
                    />
                  </div>
                </>
              )}
              {view === "Overview" && (
                <>
                  <div className="pipeline-strip">
                    <span>
                      Collected claims{" "}
                      <strong>
                        {format(
                          batches
                            .filter((b) =>
                              [
                                "Collected",
                                "Received",
                                "Verified",
                                "Disputed",
                              ].includes(b.status),
                            )
                            .reduce((s, b) => s + b.weight, 0),
                        )}{" "}
                        kg
                      </strong>
                    </span>
                    <span>
                      Receipt awaiting review{" "}
                      <strong>
                        {format(
                          batches
                            .filter((b) =>
                              ["Received", "Disputed"].includes(b.status),
                            )
                            .reduce((s, b) => s + b.accepted, 0),
                        )}{" "}
                        kg
                      </strong>
                    </span>
                    <span>
                      Disputed batches{" "}
                      <strong>
                        {batches.filter((b) => b.status === "Disputed").length}
                      </strong>
                    </span>
                    <span>
                      Active tasks{" "}
                      <strong>
                        {
                          batches.filter((b) =>
                            [
                              "Assigned",
                              "Collected",
                              "Received",
                              "Disputed",
                            ].includes(b.status),
                          ).length
                        }
                      </strong>
                    </span>
                  </div>
                  <div className="overview-grid">
                    <section className="panel map-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            Recovery on the ground <span className="live-dot" />
                          </h2>
                          <p>A venue view of materials and their next steps</p>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Open zones"
                          onClick={() => go("Events & zones")}
                        >
                          <ArrowUpRight size={19} />
                        </button>
                      </div>
                      <VenueMap
                        event={currentEvent}
                        captures={visibleCaptures}
                        zones={zones}
                        batches={batches}
                        onZone={setZone}
                        selectedZone={zone}
                        onSaveLocation={handleSaveLocation}
                        onLocationSelect={handleLocationSelect}
                      />
                      <div className="map-footer">
                        <span>
                          Select a zone to focus its recorded location.
                        </span>
                        <span className="map-disclaimer">
                          Street map by OpenStreetMap
                        </span>
                      </div>
                    </section>
                    <section className="panel priority-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            Next up{" "}
                            <span className="count">{ready.length}</span>
                          </h2>
                          <p>Ready materials. Right destinations.</p>
                        </div>
                        <Truck size={20} />
                      </div>
                      <div className="priority-list">
                        {ready.slice(0, 3).map((b, i) => (
                          <button
                            className="priority-item"
                            key={b.id}
                            onClick={() => setSelected(b)}
                          >
                            <span className={`material-icon material-${i}`}>
                              <Boxes size={22} />
                            </span>
                            <span className="priority-info">
                              <strong>{b.material}</strong>
                              <small>
                                <MapPin size={12} />
                                {zoneName(b.zone_id)}
                              </small>
                              <span className="priority-weight">
                                {format(b.weight)} kg{" "}
                                <span>· Ready for dispatch</span>
                              </span>
                            </span>
                            <ChevronRight size={17} />
                          </button>
                        ))}
                        {!ready.length && (
                          <div className="empty">
                            All ready batches have a destination.
                          </div>
                        )}
                      </div>
                      <div className="priority-callout">
                        <span className="orange-dot" />
                        <span>
                          Assignment is a next step.
                          <br />
                          <strong>Receipt confirms the destination.</strong>
                        </span>
                      </div>
                      <button
                        className="full-link"
                        onClick={() => go("Dispatch")}
                      >
                        Open dispatch board
                        <ArrowRight size={16} />
                      </button>
                    </section>
                  </div>
                  <BatchTable
                    batches={batches.slice(0, 5)}
                    zones={zones}
                    partnerName={partnerName}
                    onSelect={setSelected}
                    title="Materials in motion"
                    onAll={() => go("Material batches")}
                  />
                  <div className="bottom-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Every material has a story</h2>
                          <p>
                            Captured and recipient-confirmed quantities by
                            stream
                          </p>
                        </div>
                        <span className="mini-label">kg</span>
                      </div>
                      <div className="chart">
                        <MaterialChart
                          batches={batches}
                          captures={visibleCaptures}
                        />
                      </div>
                    </section>
                    <section className="panel" id="activity">
                      <div className="panel-heading">
                        <div>
                          <h2>Latest handoffs</h2>
                          <p>The record behind the recovery</p>
                        </div>
                        <span className="activity-symbol">
                          <RefreshCw size={16} />
                        </span>
                      </div>
                      <div className="activity-list">
                        {state.custody.slice(0, 4).map((c) => (
                          <div className="activity-item" key={c.id}>
                            <span className="activity-check">
                              <Check size={13} />
                            </span>
                            <div>
                              <strong>
                                {c.action
                                  .replaceAll("_", " ")
                                  .replace(
                                    /Seeded demonstration record/gi,
                                    "Sample record",
                                  )}
                              </strong>
                              <small>
                                {c.batch_id.slice(0, 12)} · {c.role}
                              </small>
                            </div>
                            <time>
                              {new Date(c.created_at).toLocaleTimeString(
                                "en-GB",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </time>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </>
              )}
              {view === "Material batches" && (
                <>
                  {visibleCaptures.some((c) => !c.batch_id) && (
                    <section className="panel review-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Classification review</h2>
                          <p>
                            Unknown or contaminated records stay out of dispatch
                            until a coordinator confirms their stream.
                          </p>
                        </div>
                        <CircleHelp size={20} />
                      </div>
                      {visibleCaptures
                        .filter((c) => !c.batch_id)
                        .map((c) => (
                          <form
                            className="review-row"
                            key={c.id}
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const data = new FormData(e.currentTarget);
                              await action({
                                action: "reviewCapture",
                                captureId: c.id,
                                material: data.get("material"),
                                notes: data.get("notes"),
                              });
                            }}
                          >
                            <div>
                              <strong>
                                {c.material} · {format(c.weight)} kg
                              </strong>
                              <small>
                                {zoneName(c.zone_id)} · {c.notes}
                              </small>
                            </div>
                            <label>
                              Confirmed stream
                              <select name="material" required>
                                {materials
                                  .filter((m) => m !== "Unknown")
                                  .map((m) => (
                                    <option key={m}>{m}</option>
                                  ))}
                              </select>
                            </label>
                            <label>
                              Review reason
                              <input
                                name="notes"
                                required
                                placeholder="Condition and compatibility checked"
                              />
                            </label>
                            <button
                              className="primary"
                              disabled={
                                busy || !["admin", "coordinator"].includes(role)
                              }
                            >
                              Confirm stream
                            </button>
                          </form>
                        ))}
                    </section>
                  )}
                  <Filters
                    search={search}
                    setSearch={setSearch}
                    status={status}
                    setStatus={setStatus}
                    zone={zone}
                    setZone={setZone}
                    zones={zones}
                  />
                  <BatchTable
                    batches={batches}
                    zones={zones}
                    partnerName={partnerName}
                    onSelect={setSelected}
                    title="All material batches"
                  />
                </>
              )}
              {view === "Dispatch" && (
                <>
                  <div className="info-strip">
                    <Route size={20} />
                    <div>
                      <strong>Compatibility first. Capacity second.</strong>
                      <p>
                        Partners must accept the material and have remaining
                        capacity. Distances are straight-line estimates, not
                        optimized road routes.
                      </p>
                    </div>
                  </div>
                  <div className="kanban">
                    {["Ready", "Assigned", "Collected"].map((s) => (
                      <section key={s} className="kanban-column">
                        <div className="section-row">
                          <h2>{s}</h2>
                          <span className="count">
                            {batches.filter((b) => b.status === s).length}
                          </span>
                        </div>
                        {batches
                          .filter((b) => b.status === s)
                          .map((b) => (
                            <button
                              className="batch-card"
                              onClick={() => setSelected(b)}
                              key={b.id}
                            >
                              <div className="section-row">
                                <span className="batch-id">
                                  {b.id.slice(0, 12)}
                                </span>
                                <ArrowUpRight size={17} />
                              </div>
                              <h3>{b.material}</h3>
                              <p>{zoneName(b.zone_id)}</p>
                              <strong>
                                {format(b.weight)} <small>kg</small>
                              </strong>
                              <hr />
                              <small>{partnerName(b.partner_id)}</small>
                            </button>
                          ))}
                        {!batches.some((b) => b.status === s) && (
                          <div className="empty">
                            No {s.toLowerCase()} batches
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                  <section className="panel partner-directory">
                    <div className="panel-heading">
                      <div>
                        <h2>Recovery partners</h2>
                        <p>Recovery destinations and accepted materials</p>
                      </div>
                      <Users size={19} />
                    </div>
                    {partners.map((p) => (
                      <div className="partner-row" key={p.id}>
                        <span className="partner-avatar">
                          <Route size={20} />
                        </span>
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.materials.join(" · ")}</small>
                        </div>
                        <span>{format(p.capacity)} kg capacity</span>
                        <span>
                          {p.distance > 0
                            ? `${p.distance} km straight-line`
                            : "Distance not recorded"}
                        </span>
                        <Badge
                          status={p.available ? "Available" : "Unavailable"}
                        />
                      </div>
                    ))}
                  </section>
                </>
              )}
              {view === "Partner receipts" && (
                <>
                  <div className="info-strip">
                    <ShieldCheck size={21} />
                    <div>
                      <strong>What arrived matters.</strong>
                      <p>
                        Enter measured accepted and rejected weights. An
                        evidence reference and a discrepancy reason are required
                        before review.
                      </p>
                    </div>
                  </div>
                  <BatchTable
                    batches={batches.filter((b) =>
                      [
                        "Collected",
                        "Received",
                        "Disputed",
                        "Verified",
                      ].includes(b.status),
                    )}
                    zones={zones}
                    partnerName={partnerName}
                    onSelect={setSelected}
                    title="Receipts & review"
                  />
                </>
              )}
              {view === "Passports" && (
                <>
                  <div className="info-strip">
                    <ShieldCheck size={22} />
                    <div>
                      <strong>
                        A checkable record of a participant attestation.
                      </strong>
                      <p>
                        Ed25519 signatures detect modification. They do not
                        establish physical truth or validate environmental
                        estimates.
                      </p>
                    </div>
                  </div>
                  <div className="passport-grid">
                    {batches
                      .filter((b) => b.status === "Verified")
                      .map((b) => (
                        <section className="panel passport-card" key={b.id}>
                          <div className="section-row">
                            <Mark />
                            <Badge status="Verified" />
                          </div>
                          <span className="eyebrow">MATERIAL PASSPORT</span>
                          <h2>{b.material}</h2>
                          <p>
                            {zoneName(b.zone_id)} → {partnerName(b.partner_id)}
                          </p>
                          <div className="passport-weight">
                            {format(b.accepted)} <span>kg accepted</span>
                          </div>
                          <small>
                            {format(b.rejected)} kg rejected · Revision{" "}
                            {b.revision}
                          </small>
                          <button
                            className="primary"
                            onClick={async () => {
                              const result = await action({
                                action: "passport",
                                batchId: b.id,
                              });
                              if (result) router.push(`/verify/${b.id}`);
                            }}
                          >
                            Issue & verify passport
                            <ArrowUpRight size={17} />
                          </button>
                        </section>
                      ))}
                    {!batches.some((b) => b.status === "Verified") && (
                      <div className="empty">
                        Verify a recipient receipt to issue its passport.
                      </div>
                    )}
                  </div>
                </>
              )}
              {view === "Reports & impact" && (
                <>
                  <section className="panel report-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Recovery by material</h2>
                        <p>
                          Only accepted, reviewed quantities count as confirmed
                          recovery.
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => void exportReport("pdf")}
                      >
                        <ArrowDownToLine size={16} />
                        Download PDF
                      </button>
                    </div>
                    <div className="chart large">
                      <MaterialChart
                        batches={batches}
                        captures={visibleCaptures}
                      />
                    </div>
                  </section>
                  <div className="info-strip">
                    <Leaf size={22} />
                    <div>
                      <strong>Environmental estimates: unavailable</strong>
                      <p>
                        No geography and pathway compatible impact factors have
                        been configured. This report contains material
                        quantities only. Transport emissions are not calculated.
                      </p>
                    </div>
                  </div>
                  <BatchTable
                    batches={batches}
                    zones={zones}
                    partnerName={partnerName}
                    onSelect={setSelected}
                    title="Source records"
                  />
                </>
              )}
              {view === "Events & zones" && (
                <>
                  <div className="section-row">
                    <h2>Events</h2>
                    <button className="secondary" onClick={openCreateEvent}>
                      <Plus size={16} />
                      New event
                    </button>
                  </div>
                  <div className="event-grid">
                    {state.events.map((e) => {
                      const isSample =
                        e.id === "riverlight" || e.id === "design-week";
                      const canManage = account.user && !isSample;
                      return (
                        <div
                          className={`panel event-card ${e.id === currentEvent?.id ? "active-card" : ""}`}
                          key={e.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setEvent(e.id);
                            setZone("");
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              setEvent(e.id);
                              setZone("");
                            }
                          }}
                        >
                          <div className="event-card-top">
                            <span className="eyebrow">
                              {canManage ? "YOUR EVENT" : "SAMPLE EVENT"}
                            </span>
                            {canManage && (
                              <div
                                className="event-card-actions"
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="event-action-btn"
                                  aria-label={`Edit ${e.name}`}
                                  title="Edit event"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    openEditEvent(e);
                                  }}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="event-action-btn danger"
                                  aria-label={`Delete ${e.name}`}
                                  title="Delete event"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    confirmDeleteEvent(e);
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                          <h2>{e.name}</h2>
                          <p>
                            <MapPin size={15} />
                            {e.location}
                          </p>
                          <small>{new Date(e.date).toLocaleDateString()}</small>
                          <Badge status={e.status} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="section-row">
                    <h2>Recovery zones</h2>
                    <button
                      className="secondary"
                      onClick={() =>
                        account.user ? setModal("zone") : signIn()
                      }
                    >
                      <Plus size={16} />
                      Add zone
                    </button>
                  </div>
                  <section className="panel">
                    <VenueMap
                      event={currentEvent}
                      captures={visibleCaptures}
                      zones={zones}
                      batches={batches}
                      onZone={setZone}
                      selectedZone={zone}
                      onSaveLocation={handleSaveLocation}
                      onLocationSelect={handleLocationSelect}
                    />
                  </section>
                  {account.user && currentEvent && (
                    <form
                      className="panel location-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        await action({
                          action: "setLocation",
                          event_id: currentEvent.id,
                          latitude: f.get("latitude"),
                          longitude: f.get("longitude"),
                        });
                      }}
                    >
                      <h3>Event map location</h3>
                      <div className="form-row">
                        <label>
                          Latitude
                          <input
                            key={currentEvent.id + "lat"}
                            name="latitude"
                            type="number"
                            min="-90"
                            max="90"
                            step="any"
                            value={mapLat}
                            onChange={(e) =>
                              setCustomCoords((prev) => ({
                                ...prev,
                                lat: e.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label>
                          Longitude
                          <input
                            key={currentEvent.id + "lon"}
                            name="longitude"
                            type="number"
                            min="-180"
                            max="180"
                            step="any"
                            value={mapLon}
                            onChange={(e) =>
                              setCustomCoords((prev) => ({
                                ...prev,
                                lon: e.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <button className="secondary" disabled={busy}>
                          Save map location
                        </button>
                      </div>
                      <p className="form-hint">
                        Click or drop a pin directly on the map above to set these coordinates automatically.
                      </p>
                    </form>
                  )}
                  <div className="zone-grid">
                    {zones.map((z) => (
                      <button
                        className={`panel zone-card ${zone === z.id ? "chosen" : ""}`}
                        key={z.id}
                        onClick={() => setZone(zone === z.id ? "" : z.id)}
                      >
                        <MapPin size={21} />
                        <strong>{z.name}</strong>
                        <small>
                          {batches.filter((b) => b.zone_id === z.id).length}{" "}
                          visible batches
                        </small>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {view === "Settings" && (
                <section className="panel settings-panel">
                  <AccountSettings onAppearance={() => setAppearance(true)} />
                  {account.user && (
                    <form
                      className="partner-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const data = new FormData(form);
                        const result = await action({
                          action: "createPartner",
                          name: data.get("name"),
                          capacity: data.get("capacity"),
                          materials: data.getAll("materials"),
                        });
                        if (result) form.reset();
                      }}
                    >
                      <h3>Add a recovery partner</h3>
                      <label>
                        Partner name
                        <input name="name" maxLength={100} required />
                      </label>
                      <label>
                        Capacity in kilograms
                        <input
                          name="capacity"
                          type="number"
                          min="0.1"
                          step="0.1"
                          required
                        />
                      </label>
                      <fieldset>
                        <legend>Accepted materials</legend>
                        {materials
                          .filter((m) => m !== "Unknown")
                          .map((m) => (
                            <label className="checkbox" key={m}>
                              <input
                                type="checkbox"
                                name="materials"
                                value={m}
                              />
                              {m}
                            </label>
                          ))}
                      </fieldset>
                      <button className="primary" disabled={busy}>
                        Add partner
                      </button>
                    </form>
                  )}
                </section>
              )}
              <footer className="page-footer">
                <span>
                  <Mark />
                  SecondRoute{" "}
                  <span>Giving discarded materials another destination.</span>
                </span>
                <small>Quantities in kilograms</small>
              </footer>
            </>
          )}
        </div>
      </main>
      {modal === "capture" && (
        <CaptureDialog
          initialEventId={currentEvent?.id || ""}
          state={state}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void load();
            setNotice("Capture saved. Your material has a next step.");
          }}
        />
      )}
      {modal === "event" && (
        <Dialog title="Create an event" onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const result = await action({
                action: "createEvent",
                name: f.get("name"),
                location: f.get("location"),
                date: f.get("date"),
                status: f.get("status") || "Planning",
                latitude: eventFormCoords.lat,
                longitude: eventFormCoords.lon,
              });
              if (result) {
                setModal(null);
                if (result.id) setEvent(String(result.id));
                setNotice("Event created successfully.");
                void load();
              }
            }}
          >
            <label>
              Name
              <input name="name" placeholder="e.g. EcoHarvest Festival 2026" required />
            </label>
            <label>
              Location
              <input name="location" placeholder="e.g. South Pavilion Grounds" required />
            </label>
            <div className="form-row">
              <label>
                Date
                <input
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue="Planning">
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>
            </div>
            <LocationPicker
              latitude={eventFormCoords.lat}
              longitude={eventFormCoords.lon}
              onChange={(lat, lon) => setEventFormCoords({ lat, lon })}
            />
            <button className="primary" disabled={busy}>
              Save event
            </button>
            {error && (
              <p className="error-copy" role="alert">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
      {modal === "editEvent" && targetEvent && (
        <Dialog
          title={`Edit event: ${targetEvent.name}`}
          onClose={() => {
            setModal(null);
            setTargetEvent(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const result = await action({
                action: "updateEvent",
                id: targetEvent.id,
                name: f.get("name"),
                location: f.get("location"),
                date: f.get("date"),
                status: f.get("status"),
                latitude: eventFormCoords.lat,
                longitude: eventFormCoords.lon,
              });
              if (result) {
                setModal(null);
                setTargetEvent(null);
                setNotice("Event updated successfully.");
                void load();
              }
            }}
          >
            <label>
              Name
              <input name="name" defaultValue={targetEvent.name} required />
            </label>
            <label>
              Location
              <input
                name="location"
                defaultValue={targetEvent.location}
                required
              />
            </label>
            <div className="form-row">
              <label>
                Date
                <input
                  name="date"
                  type="date"
                  defaultValue={
                    targetEvent.date ? targetEvent.date.slice(0, 10) : ""
                  }
                  required
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={targetEvent.status || "Active"}
                >
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </label>
            </div>
            <LocationPicker
              latitude={eventFormCoords.lat}
              longitude={eventFormCoords.lon}
              onChange={(lat, lon) => setEventFormCoords({ lat, lon })}
              defaultCenter={
                targetEvent.latitude != null && targetEvent.longitude != null
                  ? { lat: targetEvent.latitude, lon: targetEvent.longitude }
                  : undefined
              }
            />
            <div className="dialog-button-row">
              <button className="primary" disabled={busy}>
                Save changes
              </button>
              <button
                type="button"
                className="secondary danger-text"
                onClick={() => setModal("deleteEvent")}
              >
                <Trash2 size={15} />
                Delete event
              </button>
            </div>
            {error && (
              <p className="error-copy" role="alert">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
      {modal === "deleteEvent" && targetEvent && (
        <Dialog
          title="Delete event"
          onClose={() => {
            setModal(null);
            setTargetEvent(null);
          }}
        >
          <div className="delete-dialog-content">
            <p>
              Are you sure you want to delete <strong>{targetEvent.name}</strong>?
            </p>
            <p className="form-hint">
              This will permanently remove the event and any empty zones associated with it. This action cannot be undone.
            </p>
            {error && (
              <p className="error-copy" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-button-row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setModal(null);
                  setTargetEvent(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary danger-btn"
                disabled={busy}
                onClick={async () => {
                  const result = await action({
                    action: "deleteEvent",
                    id: targetEvent.id,
                  });
                  if (result) {
                    const remaining =
                      state?.events.filter((ev) => ev.id !== targetEvent.id) ||
                      [];
                    if (event === targetEvent.id) {
                      setEvent(remaining[0]?.id || "");
                      setZone("");
                    }
                    setModal(null);
                    setTargetEvent(null);
                    setNotice(`Event "${targetEvent.name}" was deleted.`);
                    void load();
                  }
                }}
              >
                <Trash2 size={15} />
                Delete event
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {modal === "zone" && (
        <Dialog
          title="Add a recovery zone"
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const result = await action({
                action: "createZone",
                name: f.get("name"),
                eventId: event || currentEvent?.id,
                latitude: f.get("latitude"),
                longitude: f.get("longitude"),
              });
              if (result) {
                setModal(null);
              }
            }}
          >
            <label>
              Name
              <input name="name" required />
            </label>
            <p className="form-hint">
              Coordinates place this zone on OpenStreetMap. Leave both blank
              if the location is not available yet.
            </p>
            <div className="form-row">
              <label>
                Latitude
                <input
                  name="latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  defaultValue={mapLat || ""}
                  placeholder="12.9716"
                />
              </label>
              <label>
                Longitude
                <input
                  name="longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  defaultValue={mapLon || ""}
                  placeholder="77.5946"
                />
              </label>
            </div>
            <button className="primary" disabled={busy}>
              Save zone
            </button>
            {error && (
              <p className="error-copy" role="alert">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
      {selected && (
        <BatchDialog
          batch={state?.batches.find((b) => b.id === selected.id) || selected}
          state={state!}
          action={action}
          busy={busy}
          role={role}
          operationError={error}
          onClose={() => setSelected(null)}
        />
      )}
      {help && (
        <Dialog
          title="Follow a material's second route"
          onClose={() => setHelp(false)}
        >
          <p>
            Explore sample records without an account. Sign in to manage your
            own events, materials and partners.
          </p>
          <ol className="workflow-steps">
            <li>Capture Cardboard with a weight and zone.</li>
            <li>Open the batch and assign a compatible partner.</li>
            <li>Confirm collection after pickup.</li>
            <li>
              Record the recipient&apos;s accepted and rejected quantities with
              evidence.
            </li>
            <li>
              Review the discrepancy, verify the receipt, and open the signed
              passport.
            </li>
            <li>Export the report and compare accepted quantities.</li>
          </ol>
          <p>
            To test offline capture, load this page first, disconnect your
            network, save a capture, then reconnect. Pending records survive a
            page restart.
          </p>
          <button
            className="primary"
            onClick={() => {
              setHelp(false);
              setModal("capture");
            }}
          >
            Start a capture
            <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  note,
  orange,
  green,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  note: string;
  orange?: boolean;
  green?: boolean;
}) {
  return (
    <section className={`metric ${green ? "green-metric" : ""}`}>
      <div className="metric-label">
        {label}
        <span className={orange ? "orange-text" : ""}>{icon}</span>
      </div>
      <div className="metric-value">
        {format(value)}
        <span>kg</span>
        {green && (
          <span className="recovery-stamp">
            <ArrowUpRight size={20} />
          </span>
        )}
      </div>
      <div className="metric-note">
        {green ? (
          <ShieldCheck size={12} />
        ) : (
          <span className={`mini-dot ${orange ? "orange" : ""}`} />
        )}{" "}
        {note}
      </div>
    </section>
  );
}
function MaterialChart({
  batches,
  captures,
}: {
  batches: Batch[];
  captures?: State["captures"];
}) {
  const source = captures || batches;
  const data = materials
    .filter((m) => source.some((b) => b.material === m))
    .map((m) => ({
      name: m.replace(" plastic", "").replace(" fixtures", ""),
      Captured: source
        .filter((b) => b.material === m)
        .reduce((s, b) => s + b.weight, 0),
      Confirmed: batches
        .filter((b) => b.material === m && b.status === "Verified")
        .reduce((s, b) => s + b.accepted, 0),
    }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        barGap={4}
        margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#e9ebe5"
        />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "#777e73" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "#889080" }}
        />
        <Tooltip cursor={{ fill: "#f3f3ed" }} />
        <Bar
          dataKey="Captured"
          fill="#dce2d5"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="Confirmed"
          fill="#3d654b"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
function BatchTable({
  batches,
  zones,
  partnerName,
  onSelect,
  title,
  onAll,
}: {
  batches: Batch[];
  zones: State["zones"];
  partnerName: (id: string | null) => string;
  onSelect: (b: Batch) => void;
  title: string;
  onAll?: () => void;
}) {
  return (
    <section className="panel batch-table">
      <div className="panel-heading">
        <div>
          <h2>
            {title}
            <span className="count">{batches.length}</span>
          </h2>
          <p>Every batch, one step closer to its next use</p>
        </div>
        {onAll && (
          <button className="text-button" onClick={onAll}>
            View all batches
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Material / Batch</th>
              <th>Source zone</th>
              <th>Recorded weight</th>
              <th>Next destination</th>
              <th>Status</th>
              <th aria-label="Open detail" />
            </tr>
          </thead>
          <tbody>
            {batches.map((b, i) => (
              <tr key={b.id} onClick={() => onSelect(b)}>
                <td>
                  <button className="material-cell" onClick={() => onSelect(b)}>
                    <span className={`table-material material-${i % 4}`}>
                      <Boxes size={18} />
                    </span>
                    <span>
                      <strong>{b.material}</strong>
                      <small>{b.id.slice(0, 12)}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="zone-cell">
                    <MapPin size={13} />
                    {zones.find((z) => z.id === b.zone_id)?.name || b.zone_id}
                  </span>
                </td>
                <td>
                  <strong className="weight-cell">
                    {format(b.weight)} <small>kg</small>
                  </strong>
                </td>
                <td>
                  <span className="destination">
                    {partnerName(b.partner_id)}
                  </span>
                </td>
                <td>
                  <Badge status={b.status} />
                </td>
                <td>
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!batches.length && (
          <div className="empty">
            No matching batches. Capture a material or update your filters.
          </div>
        )}
      </div>
    </section>
  );
}
function Filters({
  search,
  setSearch,
  status,
  setStatus,
  zone,
  setZone,
  zones,
}: {
  search: string;
  setSearch: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  zone: string;
  setZone: (s: string) => void;
  zones: State["zones"];
}) {
  return (
    <div className="filters">
      <label className="search-field">
        <Search size={17} />
        <input
          placeholder="Search material, batch or note"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <select
        aria-label="Filter status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">All statuses</option>
        {[
          "Ready",
          "Assigned",
          "Collected",
          "Received",
          "Verified",
          "Disputed",
          "Failed",
          "Cancelled",
        ].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <select
        aria-label="Filter zone"
        value={zone}
        onChange={(e) => setZone(e.target.value)}
      >
        <option value="">All zones</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
    </div>
  );
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
function CaptureDialog({
  initialEventId,
  state,
  onClose,
  onDone,
}: {
  initialEventId: string;
  state: State | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { account } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [evidence, setEvidence] = useState("");
  const [eventId, setEventId] = useState(initialEventId);
  const [captureZones, setCaptureZones] = useState(state?.zones || []);
  const cachedZoneEvent = state?.zones[0]?.event_id;
  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    void fetch("/api/state?event=" + encodeURIComponent(eventId), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Unable to load zones");
        setCaptureZones(data.zones);
      })
      .catch(() => {
        if (!controller.signal.aborted && cachedZoneEvent !== eventId)
          setError("Connect to load recovery zones for this event.");
      });
    return () => controller.abort();
  }, [eventId, cachedZoneEvent]);
  const [material, setMaterial] = useState("Cardboard");
  const key = useRef("");
  useEffect(() => {
    key.current = crypto.randomUUID();
  }, []);
  return (
    <Dialog title="Give this material a next step" onClose={onClose}>
      <div className="capture-intro">
        <span className="eyebrow">FIELD CAPTURE</span>
        <p>
          Record what you found. Recovery is confirmed when a partner receives
          it.
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(e.currentTarget);
          const payload: PendingCapture = {
            action: "capture",
            workspace_id: account.orgId,
            idempotencyKey: key.current,
            eventId,
            zoneId: String(form.get("zoneId")),
            material,
            weight: Number(form.get("weight")),
            quantity: Number(form.get("quantity")),
            provenance: String(form.get("provenance")),
            notes: String(form.get("notes")),
            evidence: evidence || undefined,
            state: "pending",
          };
          try {
            if (!navigator.onLine) {
              enqueue(payload);
              onDone();
              return;
            }
            let response: Response;
            try {
              response = await fetch("/api/action", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-demo-role": useUI.getState().role,
                },
                body: JSON.stringify({
                  ...payload,
                  state: undefined,
                  error: undefined,
                }),
              });
            } catch {
              enqueue(payload);
              onDone();
              return;
            }
            const data = await response.json();
            if (!response.ok)
              throw Error(data.error || "Unable to save capture");
            onDone();
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="upload-box">
          {preview ? (
            <Image
              src={preview}
              alt="Material evidence preview"
              width={440}
              height={180}
              unoptimized
            />
          ) : (
            <>
              <Camera size={26} />
              <strong>Add photo evidence</strong>
              <span>Camera or gallery · JPEG, PNG · up to 5 MB</span>
            </>
          )}
          <input
            aria-label="Upload material evidence"
            type="file"
            accept="image/jpeg,image/png"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                setError("Image must be under 5 MB");
                return;
              }
              setPreview(URL.createObjectURL(file));
              if (!navigator.onLine) {
                setError(
                  "Photo upload needs a connection. Your manual capture can still be saved offline.",
                );
                return;
              }
              try {
                const form = new FormData();
                form.append("file", file);
                const res = await fetch("/api/upload", {
                  method: "POST",
                  headers: { "x-demo-role": useUI.getState().role },
                  body: form,
                });
                const data = await res.json();
                if (!res.ok) throw Error(data.error || "Upload failed");
                setEvidence(data.id || data.url || data.evidence);
              } catch (e) {
                setError(String(e));
              }
            }}
          />
        </label>
        <div className="manual-note">
          <CircleHelp size={16} />
          Manual classification. No image model is installed.
        </div>
        <label>
          Confirmed material
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          >
            {materials.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        {material === "Unknown" && (
          <p className="warning-copy">
            Unknown materials require review and cannot be dispatched.
          </p>
        )}
        <div className="form-grid">
          <label>
            Event
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              {state?.events.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source zone
            <select name="zoneId" required>
              {captureZones
                .filter((z) => z.event_id === eventId)
                .map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Weight (kg)
            <input
              name="weight"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="e.g. 24.5"
            />
          </label>
          <label>
            Item count
            <input
              name="quantity"
              type="number"
              min="1"
              step="1"
              defaultValue="1"
              required
            />
          </label>
        </div>
        <label>
          Weight provenance
          <select name="provenance">
            <option value="estimated">Estimated in field</option>
            <option value="measured">Measured with scale</option>
          </select>
        </label>
        <label>
          Field notes
          <textarea
            name="notes"
            placeholder="Condition, contamination, access instructions..."
            rows={2}
          />
        </label>
        <p className="form-hint">
          <Boxes size={15} />
          Automatically grouped with an open batch of the same material and
          zone. Sealed batches stay unchanged.
        </p>
        {error && (
          <p className="error-copy" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy
            ? "Saving capture..."
            : navigator.onLine
              ? "Confirm & save capture"
              : "Save capture offline"}
          <ArrowRight size={17} />
        </button>
      </form>
    </Dialog>
  );
}
function BatchDialog({
  batch: b,
  state,
  action,
  busy,
  role,
  operationError,
  onClose,
}: {
  batch: Batch;
  state: State;
  action: (p: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  role: string;
  operationError: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [partner, setPartner] = useState("");
  const [receiptFile, setReceiptFile] = useState("");
  const run = async (p: Record<string, unknown>) => {
    setError("");
    const result = await action({ ...p, batchId: b.id });
    if (!result)
      setError("The operation was rejected. Check the reason below.");
    return result;
  };
  return (
    <Dialog title={`${b.material} batch`} onClose={onClose}>
      <div className="detail-top">
        <span className="batch-id">{b.id}</span>
        <Badge status={b.status} />
      </div>
      <div className="detail-weight">
        {format(b.weight)} <small>kg recorded</small>
      </div>
      <p className="muted">
        {state.zones.find((z) => z.id === b.zone_id)?.name} ·{" "}
        {state.partners.find((p) => p.id === b.partner_id)?.name ||
          "Destination pending"}
      </p>
      {b.notes && (
        <p>
          <RecordNote text={b.notes} />
        </p>
      )}
      <div className="lifecycle">
        {["Ready", "Assigned", "Collected", "Received", "Verified"].map(
          (s, i) => (
            <span
              className={
                i <=
                [
                  "Ready",
                  "Assigned",
                  "Collected",
                  "Received",
                  "Verified",
                ].indexOf(b.status)
                  ? "done"
                  : ""
              }
              key={s}
            >
              <Check size={12} />
              {s}
            </span>
          ),
        )}
      </div>
      {b.rejected > 0 && (
        <div className="alert">
          <strong>{format(b.rejected)} kg rejected.</strong> Excluded from
          recovery. Review the receipt discrepancy.
        </div>
      )}
      {["Ready", "Failed"].includes(b.status) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await run({ action: "assign", partnerId: partner });
          }}
        >
          <h3>Assign a destination</h3>
          <p className="form-hint">
            Eligible partners accept this stream and have available capacity.
            Nearest straight-line distance is a routing heuristic.
          </p>
          <label>
            Recovery partner
            <select
              required
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
            >
              <option value="">Select compatible partner</option>
              {state.partners.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={
                    !p.available ||
                    !p.materials.includes(b.material) ||
                    p.capacity < b.weight
                  }
                >
                  {p.name} · {p.capacity} kg ·{" "}
                  {p.distance > 0
                    ? `${p.distance} km`
                    : "Distance not recorded"}
                  {!p.materials.includes(b.material) ? " · incompatible" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || !["admin", "coordinator"].includes(role)}
          >
            Assign pickup
            <Truck size={17} />
          </button>
        </form>
      )}
      {b.status === "Assigned" && (
        <div className="detail-action">
          <h3>Confirm the physical collection</h3>
          <p>Confirm only when this material has left the source zone.</p>
          <button
            className="primary"
            disabled={
              busy || !["admin", "worker", "coordinator"].includes(role)
            }
            onClick={() => void run({ action: "collect" })}
          >
            Confirm collection
            <Check size={16} />
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run({
                action: "fail",
                notes: "Pickup could not be completed",
              })
            }
          >
            Report failed pickup
          </button>
        </div>
      )}
      {b.status === "Failed" && (
        <p className="form-hint">
          This failed pickup can be reassigned from the dispatch board.
        </p>
      )}
      {b.status === "Collected" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            await run({
              action: "receive",
              accepted: Number(form.get("accepted")),
              rejected: Number(form.get("rejected")),
              evidence: receiptFile,
              notes: form.get("notes"),
              reason: form.get("notes"),
            });
          }}
        >
          <h3>Record recipient receipt</h3>
          <div className="form-grid">
            <label>
              Accepted (kg)
              <input
                name="accepted"
                type="number"
                min="0"
                max={b.weight}
                step="0.01"
                required
              />
            </label>
            <label>
              Rejected (kg)
              <input
                name="rejected"
                type="number"
                min="0"
                max={b.weight}
                step="0.01"
                required
                defaultValue="0"
              />
            </label>
          </div>
          <label>
            Receipt evidence (required)
            <input
              type="file"
              required={!receiptFile}
              accept="image/jpeg,image/png,application/pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append("file", file);
                const res = await fetch("/api/upload", {
                  method: "POST",
                  headers: { "x-demo-role": role },
                  body: form,
                });
                const data = await res.json();
                if (res.ok) setReceiptFile(data.id || data.url);
                else setError(data.error);
              }}
            />
          </label>
          <label>
            Discrepancy / rejection reason
            <textarea
              name="notes"
              required
              placeholder="Describe measured difference or rejected material"
            />
          </label>
          <button
            className="primary"
            disabled={
              busy || !["partner", "admin"].includes(role) || !receiptFile
            }
          >
            Save measured receipt
            <Check size={16} />
          </button>
        </form>
      )}
      {["Received", "Disputed"].includes(b.status) && (
        <div className="receipt-review">
          <h3>Receipt ready for review</h3>
          <div className="receipt-numbers">
            <span>
              <strong>{format(b.accepted)} kg</strong>accepted
            </span>
            <span>
              <strong>{format(b.rejected)} kg</strong>rejected
            </span>
          </div>
          <p>
            Evidence:{" "}
            {b.evidence?.startsWith("demo-") ? (
              "Sample receipt record"
            ) : (
              <a
                className="text-button"
                href={`/api/media/${b.evidence}`}
                target="_blank"
                rel="noreferrer"
              >
                Open uploaded receipt evidence
                <ArrowUpRight size={14} />
              </a>
            )}
          </p>
          <p>
            Confirm that receipt evidence is adequate and the accepted amount
            can be reported as recipient-confirmed recovery.
          </p>
          <button
            className="primary"
            disabled={busy || !["coordinator", "admin"].includes(role)}
            onClick={() =>
              void run(
                b.status === "Disputed"
                  ? {
                      action: "resolveDispute",
                      notes:
                        "Coordinator reviewed receipt evidence and discrepancy.",
                    }
                  : { action: "verify", reviewed: true },
              )
            }
          >
            {b.status === "Disputed"
              ? "Resolve receipt dispute"
              : "Verify accepted quantity"}
            <ShieldCheck size={17} />
          </button>
        </div>
      )}
      {b.status === "Verified" && (
        <div className="receipt-review">
          <h3>Recipient-confirmed recovery</h3>
          <div className="receipt-numbers">
            <span>
              <strong>{format(b.accepted)} kg</strong>accepted + reviewed
            </span>
            <span>
              <strong>{format(b.rejected)} kg</strong>excluded
            </span>
          </div>
          <button
            className="primary"
            disabled={busy || !["admin", "coordinator"].includes(role)}
            onClick={async () => {
              const result = await run({ action: "passport" });
              if (result) router.push(`/verify/${b.id}`);
            }}
          >
            Issue signed passport
            <ArrowUpRight size={17} />
          </button>
        </div>
      )}
      {!["Verified", "Cancelled", "Received", "Disputed"].includes(
        b.status,
      ) && (
        <button
          className="text-button cancel-batch"
          disabled={busy || !["admin", "coordinator"].includes(role)}
          onClick={() =>
            void run({ action: "cancel", notes: "Cancelled by coordinator" })
          }
        >
          Cancel batch
        </button>
      )}
      {(error || operationError) && (
        <p className="error-copy" role="alert">
          {operationError || error}
        </p>
      )}
      <h3 className="custody-title">Custody timeline</h3>
      <div className="custody-list">
        {state.custody
          .filter((c) => c.batch_id === b.id)
          .map((c) => (
            <div key={c.id}>
              <span className="activity-check">
                <Check size={12} />
              </span>
              <div>
                <strong>
                  {c.action
                    .replaceAll("_", " ")
                    .replace(/Seeded demonstration record/gi, "Sample record")}
                </strong>
                <small>
                  {c.role} · {new Date(c.created_at).toLocaleString()}
                </small>
                {Object.keys(c.details || {}).length > 0 && (
                  <small>
                    {Object.entries(c.details)
                      .filter(
                        ([k, v]) =>
                          !k.endsWith("_id") &&
                          typeof v !== "object" &&
                          k !== "fictional" &&
                          k !== "sample",
                      )
                      .map(
                        ([k, v]) =>
                          `${k.replaceAll("_", " ")}: ${String(v).startsWith("http") ? "Linked record" : String(v)}`,
                      )
                      .join(" · ")}
                  </small>
                )}
              </div>
            </div>
          ))}
      </div>
      <p className="form-hint">
        Your workspace role: {role}. Each handoff is recorded in the custody
        history.
      </p>
    </Dialog>
  );
}
