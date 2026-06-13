"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Bot,
  Database,
  Gauge,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Network,
  Route,
  Shield,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Overview } from "@/lib/overview";

type NodeKind =
  | "edge"
  | "routing"
  | "identity"
  | "workload"
  | "data"
  | "operations";

type NodeStatus = "online" | "degraded" | "offline" | "internal";
type LaneId = "edge" | "control" | "runtime" | "foundation";
type LinkViewMode = "focused" | "all";

type ArchitectureNode = {
  id: string;
  label: string;
  description: string;
  kind: NodeKind;
  lane: LaneId;
  x: number;
  y: number;
  hostTemplates?: string[];
  serviceIds?: string[];
  routes?: string[];
};

type ArchitectureLink = {
  id: string;
  from: string;
  to: string;
  label: string;
  protocol: string;
};

const LANE_ORDER: LaneId[] = ["edge", "control", "runtime", "foundation"];

const NODES: ArchitectureNode[] = [
  {
    id: "internet",
    label: "Public Internet",
    description: "Client traffic enters over public DNS and HTTPS.",
    kind: "edge",
    lane: "edge",
    x: 18,
    y: 12,
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    description: "DNS, edge controls, and optional tunnel ingress for remote access.",
    kind: "edge",
    lane: "edge",
    x: 50,
    y: 12,
  },
  {
    id: "traefik",
    label: "Traefik v3",
    description:
      "Primary reverse proxy: TLS automation, entrypoint routing, and middleware chaining.",
    kind: "routing",
    lane: "control",
    x: 20,
    y: 30,
    serviceIds: ["traefik"],
    hostTemplates: ["traefik.${domain}"],
    routes: ["web → websecure redirect", "ACME DNS-01 challenge", "secure-headers middleware", "ForwardAuth middleware chain"],
  },
  {
    id: "authelia",
    label: "Authelia",
    description:
      "Forward-auth policy engine and OIDC provider. Every protected request passes through here.",
    kind: "identity",
    lane: "control",
    x: 50,
    y: 30,
    serviceIds: ["auth"],
    hostTemplates: ["auth.${domain}"],
    routes: ["/authelia/* portal on each app host", "ForwardAuth decision endpoint", "OIDC authorization & token", "Per-host session cookies"],
  },
  {
    id: "lldap",
    label: "LLDAP",
    description: "Lightweight directory backing user accounts and group membership for Authelia.",
    kind: "identity",
    lane: "control",
    x: 80,
    y: 30,
    serviceIds: ["directory"],
    hostTemplates: ["lldap.${domain}"],
  },
  {
    id: "homepage",
    label: "Homepage",
    description:
      "This page — live service probes and architecture telemetry on the root domain.",
    kind: "workload",
    lane: "runtime",
    x: 10,
    y: 56,
    hostTemplates: ["${domain}"],
  },
  {
    id: "nextcloud",
    label: "Nextcloud",
    description: "Personal cloud files and sync, backed by Postgres and Redis.",
    kind: "workload",
    lane: "runtime",
    x: 30,
    y: 56,
    serviceIds: ["nextcloud"],
    hostTemplates: ["nextcloud.${domain}"],
  },
  {
    id: "immich",
    label: "Immich",
    description: "Photo library with ML workers, GPU-accelerated transcoding, and vector search.",
    kind: "workload",
    lane: "runtime",
    x: 50,
    y: 56,
    serviceIds: ["immich"],
    hostTemplates: ["immich.${domain}"],
  },
  {
    id: "media",
    label: "Media Fabric",
    description:
      "Jellyfin streaming, Jellyseerr requests, and the full *arr automation stack with VPN-isolated download ingestion.",
    kind: "workload",
    lane: "runtime",
    x: 70,
    y: 56,
    serviceIds: ["jellyfin", "jellyseerr", "qbit", "prowlarr", "sonarr", "radarr"],
    hostTemplates: [
      "jellyfin.${domain}",
      "jellyseer.${domain}",
      "qbit.${domain}",
      "prowlarr.${domain}",
      "sonarr.${domain}",
      "radarr.${domain}",
    ],
  },
  {
    id: "audiobookshelf",
    label: "Audiobookshelf",
    description: "Audiobook and podcast library with OIDC login via Authelia.",
    kind: "workload",
    lane: "runtime",
    x: 90,
    y: 56,
    serviceIds: ["audiobookshelf"],
    hostTemplates: ["audiobookshelf.${domain}"],
  },
  {
    id: "ollama",
    label: "Ollama + Gateway",
    description:
      "GPU-backed LLM inference node with an OpenAI-compatible gateway — any client that speaks the OpenAI API works here.",
    kind: "workload",
    lane: "runtime",
    x: 30,
    y: 74,
    serviceIds: ["ollama"],
    hostTemplates: ["ollama.${domain}"],
    routes: ["Host(ollama) → core inference UI", "Host(ollama) && PathPrefix(/v1) → OpenAI gateway", "Bearer-gated API token", "ForwardAuth for dashboard"],
  },
  {
    id: "observability",
    label: "Prometheus / Grafana",
    description:
      "Metrics pipeline scraping Traefik, node-exporter, cAdvisor, and the DCGM GPU exporter. Grafana login is backed by OIDC.",
    kind: "operations",
    lane: "runtime",
    x: 60,
    y: 74,
    serviceIds: ["grafana"],
    hostTemplates: ["grafana.${domain}"],
    routes: ["Prometheus scrapes: traefik, node, cadvisor, dcgm", "Grafana OIDC login via Authelia", "30s scrape interval"],
  },
  {
    id: "jenkins",
    label: "Jenkins + DinD",
    description: "CI controller with an isolated Docker-in-Docker executor network for building and publishing container images.",
    kind: "operations",
    lane: "runtime",
    x: 90,
    y: 74,
    serviceIds: ["jenkins"],
    hostTemplates: ["jenkins.${domain}"],
  },
  {
    id: "storage",
    label: "Persistent Storage",
    description:
      "Unified /storage root: service state, media libraries, model weights, and database volumes. State survives container rebuilds.",
    kind: "data",
    lane: "foundation",
    x: 38,
    y: 90,
  },
  {
    id: "gpu",
    label: "NVIDIA GPU",
    description:
      "Shared GPU serving Immich ML/transcoding, Ollama LLM inference, and the DCGM metrics exporter.",
    kind: "data",
    lane: "foundation",
    x: 68,
    y: 90,
  },
];

const LINKS: ArchitectureLink[] = [
  { id: "l1",  from: "internet",      to: "cloudflare",   label: "DNS + HTTPS",           protocol: "edge"  },
  { id: "l2",  from: "cloudflare",    to: "traefik",      label: "443 ingress",            protocol: "edge"  },
  { id: "l3",  from: "traefik",       to: "homepage",     label: "Host(neovara.uk)",       protocol: "route" },
  { id: "l4",  from: "traefik",       to: "authelia",     label: "ForwardAuth",            protocol: "auth"  },
  { id: "l5",  from: "authelia",      to: "lldap",        label: "LDAP groups",            protocol: "auth"  },
  { id: "l6",  from: "traefik",       to: "nextcloud",    label: "Host(nextcloud)",        protocol: "route" },
  { id: "l7",  from: "traefik",       to: "immich",       label: "Host(immich)",           protocol: "route" },
  { id: "l8",  from: "traefik",       to: "media",        label: "Host(media apps)",       protocol: "route" },
  { id: "l9",  from: "traefik",       to: "audiobookshelf", label: "Host(audiobookshelf)", protocol: "route" },
  { id: "l10", from: "traefik",       to: "ollama",       label: "Host(ollama) + /v1",     protocol: "route" },
  { id: "l11", from: "traefik",       to: "jenkins",      label: "Host(jenkins)",          protocol: "route" },
  { id: "l12", from: "traefik",       to: "observability", label: "Host(grafana)",         protocol: "route" },
  { id: "l13", from: "nextcloud",     to: "storage",      label: "files + db",             protocol: "data"  },
  { id: "l14", from: "immich",        to: "storage",      label: "uploads + postgres",     protocol: "data"  },
  { id: "l15", from: "media",         to: "storage",      label: "media library",          protocol: "data"  },
  { id: "l16", from: "audiobookshelf", to: "storage",     label: "audio metadata",         protocol: "data"  },
  { id: "l17", from: "ollama",        to: "storage",      label: "model cache",            protocol: "data"  },
  { id: "l18", from: "observability", to: "traefik",      label: "metrics scrape",         protocol: "ops"   },
  { id: "l19", from: "immich",        to: "gpu",          label: "nvenc + ml",             protocol: "ops"   },
  { id: "l20", from: "ollama",        to: "gpu",          label: "llm inference",          protocol: "ops"   },
  { id: "l21", from: "authelia",      to: "nextcloud",    label: "/authelia policy",       protocol: "auth"  },
  { id: "l22", from: "authelia",      to: "immich",       label: "/authelia policy",       protocol: "auth"  },
  { id: "l23", from: "authelia",      to: "audiobookshelf", label: "/authelia policy",     protocol: "auth"  },
  { id: "l24", from: "authelia",      to: "ollama",       label: "one-factor + basic",     protocol: "auth"  },
  { id: "l25", from: "authelia",      to: "observability", label: "OIDC auth",             protocol: "auth"  },
];

const KIND_META: Record<NodeKind, { label: string; icon: typeof Globe }> = {
  edge:       { label: "Edge",       icon: Globe    },
  routing:    { label: "Routing",    icon: Route    },
  identity:   { label: "Identity",   icon: Shield   },
  workload:   { label: "Workload",   icon: Layers   },
  data:       { label: "Data",       icon: Database },
  operations: { label: "Operations", icon: Gauge    },
};

const LANE_META: Record<
  LaneId,
  { label: string; description: string; top: number; height: number }
> = {
  edge:       { label: "Edge",       description: "Public ingress",          top: 4,  height: 14 },
  control:    { label: "Control",    description: "Routing & identity",       top: 22, height: 18 },
  runtime:    { label: "Runtime",    description: "Apps & operations",        top: 44, height: 38 },
  foundation: { label: "Foundation", description: "State & compute",         top: 84, height: 12 },
};

const STATUS_META: Record<
  NodeStatus,
  { label: string; className: string; pingClass: string }
> = {
  online:   { label: "Online",   className: "text-emerald-200 border-emerald-500/30 bg-emerald-500/12",   pingClass: "bg-emerald-400"    },
  degraded: { label: "Degraded", className: "text-amber-200  border-amber-500/30  bg-amber-500/12",    pingClass: "bg-amber-400"      },
  offline:  { label: "Offline",  className: "text-rose-200   border-rose-500/30   bg-rose-500/12",     pingClass: "bg-rose-400"       },
  internal: { label: "Internal", className: "text-violet-200/55 border-violet-500/15 bg-violet-500/6", pingClass: "bg-violet-400/55"  },
};

function expandHostTemplate(template: string, domain: string) {
  return template
    .replaceAll("${domain}", domain)
    .replaceAll("${HOMELAB_DOMAIN}", domain)
    .trim();
}

function getNodeStatus(node: ArchitectureNode, serviceState: Map<string, boolean>): NodeStatus {
  if (!node.serviceIds || node.serviceIds.length === 0) return "internal";
  const values = node.serviceIds
    .map((id) => serviceState.get(id))
    .filter((v): v is boolean => typeof v === "boolean");
  if (values.length === 0) return "internal";
  if (values.every(Boolean)) return "online";
  if (values.some(Boolean)) return "degraded";
  return "offline";
}

function buildRoutePath(from: ArchitectureNode, to: ArchitectureNode) {
  if (Math.abs(from.y - to.y) < 1) return `M ${from.x} ${from.y} H ${to.x}`;
  const midY = from.y + (to.y - from.y) / 2;
  return `M ${from.x} ${from.y} V ${midY} H ${to.x} V ${to.y}`;
}

// protocol → link color
const PROTOCOL_STROKE: Record<string, string> = {
  edge:  "rgba(6,182,212,0.55)",
  auth:  "rgba(167,139,250,0.55)",
  route: "rgba(99,102,241,0.45)",
  data:  "rgba(52,211,153,0.40)",
  ops:   "rgba(251,191,36,0.40)",
};

const PROTOCOL_STROKE_DIM: Record<string, string> = {
  edge:  "rgba(6,182,212,0.12)",
  auth:  "rgba(167,139,250,0.10)",
  route: "rgba(99,102,241,0.10)",
  data:  "rgba(52,211,153,0.09)",
  ops:   "rgba(251,191,36,0.09)",
};

export function ArchitectureMap({ overview }: { overview: Overview }) {
  const [activeNodeId, setActiveNodeId] = useState<string>("traefik");
  const [linkViewMode, setLinkViewMode] = useState<LinkViewMode>("focused");

  const domain = overview.meta.domain || "neovara.uk";

  const serviceState = useMemo(() => {
    const state = new Map<string, boolean>();
    for (const service of overview.services) state.set(service.id, service.active);
    return state;
  }, [overview.services]);

  const serviceHosts = useMemo(() => {
    const hosts = new Map<string, string>();
    for (const service of overview.services) hosts.set(service.id, service.host);
    return hosts;
  }, [overview.services]);

  const nodeById = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);
  const activeNode = nodeById.get(activeNodeId) ?? NODES[0];

  const relatedLinks = useMemo(
    () => LINKS.filter((l) => l.from === activeNode.id || l.to === activeNode.id),
    [activeNode.id],
  );

  const relatedNodeIds = useMemo(() => {
    const ids = new Set<string>([activeNode.id]);
    for (const link of relatedLinks) { ids.add(link.from); ids.add(link.to); }
    return ids;
  }, [activeNode.id, relatedLinks]);

  const highlightedLinkIds = useMemo(
    () => new Set(relatedLinks.map((l) => l.id)),
    [relatedLinks],
  );

  const connectedNodes = useMemo(() => {
    const seen = new Set<string>();
    const nodes: ArchitectureNode[] = [];
    for (const link of relatedLinks) {
      for (const nodeId of [link.from, link.to]) {
        if (nodeId === activeNode.id || seen.has(nodeId)) continue;
        const node = nodeById.get(nodeId);
        if (node) { seen.add(nodeId); nodes.push(node); }
      }
    }
    return nodes;
  }, [activeNode.id, nodeById, relatedLinks]);

  const selectedHosts = useMemo(() => {
    const hosts = new Set<string>();
    for (const id of activeNode.serviceIds ?? []) {
      const h = serviceHosts.get(id);
      if (h) hosts.add(h);
    }
    for (const t of activeNode.hostTemplates ?? []) hosts.add(expandHostTemplate(t, domain));
    return Array.from(hosts).sort((a, b) => a.localeCompare(b));
  }, [activeNode.hostTemplates, activeNode.serviceIds, domain, serviceHosts]);

  const selectedStatus = getNodeStatus(activeNode, serviceState);
  const visibleLinks = linkViewMode === "all" ? LINKS : relatedLinks;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,370px)]">
      {/* ── topology canvas ── */}
      <section className="glass-card rounded-[2rem] p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b border-violet-500/10 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-violet-300/50">
              Service Topology
            </p>
            <h3 className="mt-2 text-xl font-light tracking-tight text-white md:text-2xl">
              Click any component to see how it connects.
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/45">
              Focus on a node to isolate its dependencies. Toggle the full graph to see every connection at once.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 p-1">
            {(["focused", "all"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setLinkViewMode(mode)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] transition-all",
                  linkViewMode === mode
                    ? "bg-violet-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                    : "text-violet-300/55 hover:text-violet-200/80",
                )}
              >
                {mode === "focused" ? "Focus" : "Full Graph"}
              </button>
            ))}
          </div>
        </div>

        {/* map stage */}
        <div className="mt-5 rounded-[1.75rem] border border-violet-500/12 bg-[#010108] p-2.5 md:p-3.5">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-violet-500/10 bg-[#020209]">
            {/* grid + radial */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(124_58_237/4%)_1px,transparent_1px),linear-gradient(90deg,rgb(124_58_237/4%)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(124,58,237,0.1),transparent_70%)]" />

            <div className="relative aspect-[16/11] min-h-[520px] w-full md:min-h-[600px]">
              {/* lane backgrounds */}
              {LANE_ORDER.map((lane) => {
                const meta = LANE_META[lane];
                const laneCount = NODES.filter((n) => n.lane === lane).length;
                return (
                  <div
                    key={lane}
                    className="pointer-events-none absolute left-2.5 right-2.5 rounded-[1.3rem] border border-violet-500/[0.06] bg-violet-500/[0.015]"
                    style={{ top: `${meta.top}%`, height: `${meta.height}%` }}
                  >
                    <div className="absolute left-3 top-3 flex items-center gap-2 text-[9px] uppercase tracking-[0.24em] text-violet-300/32">
                      <span>{meta.label}</span>
                      <span className="text-violet-300/18">/</span>
                      <span className="text-violet-300/20">{meta.description}</span>
                      <span className="rounded-full border border-violet-500/12 px-1.5 py-0.5 text-[8px] text-violet-300/22">
                        {laneCount}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* svg links */}
              <svg
                viewBox="0 0 100 100"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden
              >
                {visibleLinks.map((link) => {
                  const from = nodeById.get(link.from);
                  const to = nodeById.get(link.to);
                  if (!from || !to) return null;

                  const isHighlighted = highlightedLinkIds.has(link.id);
                  const path = buildRoutePath(from, to);
                  const color = isHighlighted
                    ? (PROTOCOL_STROKE[link.protocol] ?? "rgba(167,139,250,0.55)")
                    : (PROTOCOL_STROKE_DIM[link.protocol] ?? "rgba(255,255,255,0.06)");

                  return (
                    <g key={link.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={isHighlighted ? 1.05 : 0.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn(isHighlighted && "route-flow")}
                      />
                      {isHighlighted && (
                        <circle r="0.7" fill="#a78bfa" opacity="0.9">
                          <animateMotion dur="2.8s" repeatCount="indefinite" path={path} />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* nodes */}
              {NODES.map((node, index) => {
                const meta = KIND_META[node.kind];
                const Icon = meta.icon;
                const nodeStatus = getNodeStatus(node, serviceState);
                const isActive = node.id === activeNode.id;
                const isConnected = relatedNodeIds.has(node.id);
                const fade = linkViewMode === "focused" && !isConnected;

                return (
                  <motion.button
                    key={node.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: fade ? 0.35 : 1, y: 0, scale: isActive ? 1.04 : 1 }}
                    transition={{ duration: 0.25, delay: index * 0.018 }}
                    onMouseEnter={() => setActiveNodeId(node.id)}
                    onFocus={() => setActiveNodeId(node.id)}
                    onClick={() => setActiveNodeId(node.id)}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
                      isActive && "map-node-active",
                    )}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <div
                      className={cn(
                        "w-[clamp(4.2rem,17vw,6.8rem)] rounded-[1.1rem] border bg-[#030310]/95 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)] transition-all md:w-[clamp(5rem,11vw,7.8rem)]",
                        isActive
                          ? "border-violet-400/60 bg-[#070720]/95"
                          : isConnected
                            ? "border-violet-500/22"
                            : "border-violet-500/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className={cn(
                          "rounded-[0.75rem] border p-1.5 transition-colors",
                          isActive ? "border-violet-500/30 bg-violet-500/15" : "border-white/8 bg-white/[0.04]",
                        )}>
                          <Icon className={cn("h-3.5 w-3.5", isActive ? "text-violet-300" : "text-white/80")} />
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 h-2 w-2 rounded-full border-2 border-[#030310]",
                            STATUS_META[nodeStatus].pingClass,
                          )}
                        />
                      </div>
                      <p className="mt-2.5 text-[9px] uppercase tracking-[0.22em] text-violet-300/38">
                        {meta.label}
                      </p>
                      <p className={cn(
                        "mt-0.5 text-[10.5px] font-medium leading-tight md:text-[11.5px]",
                        isActive ? "text-white" : "text-white/88",
                      )}>
                        {node.label}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* legend */}
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
          {[
            { icon: Network,   label: "Proxy path",    color: "text-indigo-300/55"  },
            { icon: KeyRound,  label: "Auth boundary",  color: "text-violet-300/55"  },
            { icon: HardDrive, label: "Shared state",   color: "text-emerald-300/55" },
            { icon: Bot,       label: "GPU workloads",  color: "text-cyan-300/55"    },
          ].map(({ icon: Icon, label, color }) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1">
              <Icon className={cn("h-3 w-3", color)} />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── detail panel ── */}
      <motion.aside
        key={activeNodeId}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28 }}
        className="glass-card rounded-[2rem] p-5 md:p-6 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-violet-500/10 pb-4">
          <div>
            <p className="text-[9px] uppercase tracking-[0.28em] text-violet-300/45">
              Selected Component
            </p>
            <h3 className="mt-2 text-xl font-light tracking-tight text-white">
              {activeNode.label}
            </h3>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]",
              STATUS_META[selectedStatus].className,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[selectedStatus].pingClass)} />
            {STATUS_META[selectedStatus].label}
          </span>
        </div>

        {/* stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Type",      value: KIND_META[activeNode.kind].label },
            { label: "Flows",     value: String(relatedLinks.length)      },
            { label: "Endpoints", value: String(selectedHosts.length)     },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-[1rem] border border-violet-500/10 bg-violet-500/[0.04] p-3">
              <p className="text-[9px] uppercase tracking-[0.22em] text-violet-300/40">{label}</p>
              <p className="mt-1.5 text-sm text-white/90">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-sm leading-7 text-white/55">{activeNode.description}</p>

        {/* connected */}
        <div className="rounded-[1.25rem] border border-violet-500/10 bg-violet-500/[0.03] p-4">
          <p className="text-[9px] uppercase tracking-[0.22em] text-violet-300/40">Connected Components</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {connectedNodes.length ? (
              connectedNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNodeId(node.id)}
                  className="rounded-full border border-violet-500/15 bg-black/50 px-3 py-1.5 text-[11px] text-violet-200/65 transition-colors hover:border-violet-500/30 hover:text-violet-100"
                >
                  {node.label}
                </button>
              ))
            ) : (
              <span className="text-xs text-violet-200/35">No direct dependencies</span>
            )}
          </div>
        </div>

        {/* endpoints */}
        <div className="rounded-[1.25rem] border border-violet-500/10 bg-violet-500/[0.03] p-4">
          <p className="text-[9px] uppercase tracking-[0.22em] text-violet-300/40">Endpoints</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedHosts.length ? (
              selectedHosts.map((host) => (
                <a
                  key={host}
                  href={`https://${host}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-violet-500/12 bg-black/60 px-3 py-1.5 font-mono text-[10.5px] text-violet-200/65 transition-colors hover:border-violet-500/28 hover:text-violet-100"
                >
                  {host}
                </a>
              ))
            ) : (
              <span className="text-xs text-violet-200/35">No public endpoint</span>
            )}
          </div>
        </div>

        {/* routing notes */}
        {activeNode.routes && activeNode.routes.length > 0 && (
          <div className="rounded-[1.25rem] border border-violet-500/10 bg-violet-500/[0.03] p-4">
            <p className="text-[9px] uppercase tracking-[0.22em] text-violet-300/40">Routing Notes</p>
            <ul className="mt-3 space-y-2">
              {activeNode.routes.slice(0, 4).map((route) => (
                <li key={route} className="flex items-start gap-2 text-xs leading-6 text-white/55">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/45" />
                  <span>{route}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* direct flows */}
        <div className="rounded-[1.25rem] border border-violet-500/10 bg-violet-500/[0.03] p-4">
          <p className="text-[9px] uppercase tracking-[0.22em] text-violet-300/40">Direct Flows</p>
          <div className="mt-3 space-y-2">
            {relatedLinks.length ? (
              relatedLinks.map((link) => {
                const from = nodeById.get(link.from)?.label ?? link.from;
                const to   = nodeById.get(link.to)?.label   ?? link.to;
                return (
                  <div
                    key={link.id}
                    className="rounded-[0.9rem] border border-violet-500/10 bg-black/45 px-3 py-2.5"
                  >
                    <p className="text-sm text-white/85">{link.label}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-violet-300/38">
                      {from} → {to} · {link.protocol}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-violet-200/35">No direct flows</p>
            )}
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
