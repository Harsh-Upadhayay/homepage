"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Briefcase,
  ChevronDown,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  HardDrive,
  Lock,
  Mail,
  Route,
  Server,
  Shield,
  type LucideIcon,
} from "lucide-react";

import { ArchitectureMap } from "@/components/architecture-map";
import { NumberTicker }    from "@/components/ui/number-ticker";
import { Marquee }         from "@/components/ui/marquee";
import { Spotlight }       from "@/components/ui/spotlight-new";
import type { CheckedService, Overview } from "@/lib/overview";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 60_000;

const SECTION_ORDER = ["Platform", "Cloud", "Media", "Automation", "AI", "Lab"] as const;

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────

function formatPercent(v: number | null) {
  if (v === null || Number.isNaN(v)) return "--";
  return `${v.toFixed(1)}%`;
}

function formatUptime(v: number | null) {
  if (v === null || v <= 0) return "--";
  const d = Math.floor(v / 86400);
  const h = Math.floor((v % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

function formatThroughput(bps: number | null) {
  if (bps === null || bps <= 0) return "--";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let v = bps;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatEndpointStatus(s: CheckedService) {
  if (s.statusCode !== null) return `HTTP ${s.statusCode}`;
  if (s.error) return s.error;
  return "No response";
}

function getAccessTone(access: string) {
  switch (access) {
    case "Public": return "border-emerald-300/22 bg-emerald-500/10 text-emerald-200";
    case "Admin":  return "border-amber-300/22  bg-amber-500/10  text-amber-200";
    default:       return "border-sky-300/22    bg-sky-500/10    text-sky-200";
  }
}

// ─────────────────────────────────────────────
// small shared components
// ─────────────────────────────────────────────

function StatusPill({ active, error }: { active: boolean; error: string | null }) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-200">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        Down
      </span>
    );
  }
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
      active
        ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
        : "border-zinc-400/25   bg-zinc-500/8    text-zinc-300",
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-400" : "bg-zinc-400")} />
      {active ? "Online" : "Offline"}
    </span>
  );
}

function MetricBar({ value, colorClass = "from-violet-500 to-indigo-400" }: {
  value: number | null;
  colorClass?: string;
}) {
  const pct = Math.min(Math.max(value ?? 0, 0), 100);
  return (
    <div className="mt-2.5 h-[3px] rounded-full bg-white/6 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }}
        className={cn("h-full rounded-full bg-gradient-to-r", colorClass)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// NavBar
// ─────────────────────────────────────────────

function NavBar({ overview }: { overview: Overview }) {
  const { meta, summary } = overview;
  type NavLink = { href: string; icon: LucideIcon; label: string };
  const links: NavLink[] = [
    meta.ownerGithubUrl   && { href: meta.ownerGithubUrl,                icon: Code2,     label: "GitHub"   },
    meta.ownerLinkedinUrl && { href: meta.ownerLinkedinUrl,              icon: Briefcase, label: "LinkedIn" },
    meta.ownerResumeUrl   && { href: meta.ownerResumeUrl,                icon: FileText, label: "Resume"   },
    meta.ownerContactEmail && { href: `mailto:${meta.ownerContactEmail}`, icon: Mail,     label: "Email"    },
  ].filter((x): x is NavLink => Boolean(x));

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-violet-500/10 bg-[#050508]/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-xs tracking-widest text-white/45">{meta.domain}</span>
          <span className="hidden text-[10px] text-white/18 sm:inline">·</span>
          <span className="hidden text-[10px] uppercase tracking-[0.18em] text-white/30 sm:inline">
            {summary.activeServices}/{summary.totalServices} online
          </span>
        </div>
        <div className="flex items-center gap-1">
          {links.map(({ href, icon: Icon, label }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("mailto") ? undefined : "_blank"}
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/45 transition-all hover:bg-violet-500/8 hover:text-white/80"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}

// ─────────────────────────────────────────────
// Hero section
// ─────────────────────────────────────────────

function HeroSection({ overview }: { overview: Overview }) {
  const { meta, summary, metrics, services } = overview;

  const avgResponseMs = useMemo(() => {
    const active = services.filter((s) => s.active && s.responseTimeMs > 0);
    if (!active.length) return null;
    return Math.round(active.reduce((sum, s) => sum + s.responseTimeMs, 0) / active.length);
  }, [services]);

  const containerCount = metrics.containerCount !== null ? Math.round(metrics.containerCount) : null;

  const stats = [
    { value: containerCount ?? 0,    suffix: "",   label: "Containers" },
    { value: summary.activeServices,  suffix: "",   label: "Online"     },
    { value: summary.totalServices,   suffix: "",   label: "Endpoints"  },
    { value: avgResponseMs ?? 0,      suffix: "ms", label: "Avg latency" },
  ];

  type HeroLink = { href: string; label: string; primary?: boolean };
  const ctaLinks: HeroLink[] = [
    { href: "#architecture", label: "Explore Architecture", primary: true },
    ...(meta.ownerGithubUrl  ? [{ href: meta.ownerGithubUrl,  label: "GitHub"  }] : []),
    ...(meta.ownerResumeUrl  ? [{ href: meta.ownerResumeUrl,  label: "Resume"  }] : []),
  ];

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pb-24 pt-32 md:px-8">
      {/* backgrounds */}
      <div className="hero-aurora" />
      <div className="pointer-events-none absolute inset-0">
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, rgba(124,58,237,0.14) 0%, rgba(99,102,241,0.05) 50%, transparent 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, rgba(6,182,212,0.09) 0%, rgba(99,102,241,0.03) 80%, transparent 100%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, rgba(124,58,237,0.06) 0%, transparent 80%)"
          duration={12}
          xOffset={120}
        />
        <div className="depth-noise absolute inset-0 opacity-25" />
      </div>

      {/* content */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <span className="accent-badge">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            {meta.ownerRole ?? "Platform Engineer"}
          </span>
        </motion.div>

        {/* name */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-5 text-sm font-medium uppercase tracking-[0.32em] text-white/38"
        >
          {meta.ownerName}
        </motion.p>

        {/* headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, delay: 0.14 }}
          className="mt-4 text-5xl font-light leading-[1.08] tracking-tight md:text-7xl [text-wrap:balance]"
        >
          A production homelab{" "}
          <span className="gradient-text">built from scratch.</span>
        </motion.h1>

        {/* sub */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.22 }}
          className="mx-auto mt-7 max-w-2xl text-lg font-light leading-relaxed text-white/45 md:text-xl"
        >
          {meta.ownerTagline ?? "Everything you see here is running live — containers, a full auth stack, GPU inference, and automated CI/CD. All on one machine."}
        </motion.p>

        {/* stat strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.32 }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          {stats.map(({ value, suffix, label }) => (
            <div key={label} className="stat-chip">
              <div className="flex items-baseline gap-0.5">
                <span className="gradient-text-subtle font-mono text-2xl font-light">
                  <NumberTicker value={value} className="gradient-text-subtle font-mono text-2xl font-light" />
                </span>
                {suffix && <span className="font-mono text-sm text-violet-300/60">{suffix}</span>}
              </div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/35">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.42 }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          {ctaLinks.map(({ href, label, primary }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("#") ? undefined : "_blank"}
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium transition-all",
                primary
                  ? "border-violet-500/50 bg-violet-600/20 text-white hover:bg-violet-600/35 hover:border-violet-400/70 shadow-[0_0_20px_rgba(124,58,237,0.2)]"
                  : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white/85 hover:border-white/18",
              )}
            >
              {label}
              {primary ? <ArrowRight className="h-4 w-4" /> : <ExternalLink className="h-3.5 w-3.5" />}
            </a>
          ))}
        </motion.div>
      </div>

      {/* scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <ChevronDown className="h-5 w-5 animate-bounce text-white/20" />
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Telemetry section
// ─────────────────────────────────────────────

function TelemetrySection({ overview }: { overview: Overview }) {
  const { metrics } = overview;

  const primary = [
    { label: "CPU",  value: metrics.cpuPercent,    fmt: formatPercent, bar: "from-violet-500 to-indigo-400" },
    { label: "RAM",  value: metrics.memoryPercent, fmt: formatPercent, bar: "from-indigo-500 to-sky-400"    },
    { label: "Disk", value: metrics.diskPercent,   fmt: formatPercent, bar: "from-sky-500 to-cyan-400"      },
    { label: "GPU",  value: metrics.gpuPercent,    fmt: formatPercent, bar: "from-cyan-500 to-teal-400"     },
  ];

  const secondary = [
    { label: "Net Receive",  value: formatThroughput(metrics.networkRxBps) },
    { label: "Net Transmit", value: formatThroughput(metrics.networkTxBps) },
    { label: "Node Uptime",  value: formatUptime(metrics.uptimeSeconds)    },
    {
      label: "Containers",
      value: metrics.containerCount !== null ? String(Math.round(metrics.containerCount)) : "--",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 md:px-8 lg:px-12">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.52 }}
        className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      >
        {/* primary metrics */}
        <div className="glass-card rounded-[2rem] p-7 md:p-10">
          <p className="section-eyebrow">Live Telemetry</p>
          <h2 className="section-title">Node metrics, right now.</h2>
          <p className="section-copy">
            Pulled from Prometheus every 30 seconds — CPU, memory, storage, and GPU across the host.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {primary.map(({ label, value, fmt, bar }) => (
              <div key={label} className="metric-card">
                <p className="metric-label">{label} Utilization</p>
                <p className="metric-value">{fmt(value)}</p>
                <MetricBar value={value} colorClass={bar} />
              </div>
            ))}
          </div>
        </div>

        {/* secondary metrics */}
        <div className="glass-card flex flex-col rounded-[2rem] p-7 md:p-10">
          <p className="section-eyebrow">System</p>
          <h3 className="section-title text-[clamp(1.5rem,2.4vw,2.4rem)]">Network &amp; runtime.</h3>
          <div className="mt-8 flex flex-1 flex-col justify-between gap-3">
            {secondary.map(({ label, value }) => (
              <div key={label} className="metric-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Architecture section (wraps the map)
// ─────────────────────────────────────────────

function ArchitectureSection({ overview }: { overview: Overview }) {
  const callouts = [
    {
      label: "Single entry point",
      body: "All public traffic enters through Cloudflare and Traefik — one place to enforce TLS, rate limits, and routing.",
    },
    {
      label: "Zero-trust access",
      body: "Protected apps can't be reached without a valid Authelia session. Policy is set per-host and enforced at the proxy.",
    },
    {
      label: "Full observability",
      body: "Prometheus scrapes every layer — proxy, node, containers, and GPU. Grafana surfaces it with OIDC-backed login.",
    },
  ];

  return (
    <section id="architecture" className="mx-auto max-w-7xl px-5 md:px-8 lg:px-12">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.52 }}
      >
        <p className="section-eyebrow">Architecture</p>
        <h2 className="section-title">How every request gets handled.</h2>
        <p className="section-copy max-w-3xl">
          Traffic enters through Cloudflare, gets inspected and routed by Traefik, and can&apos;t reach any
          protected app without clearing Authelia first. Click any node to explore the dependency graph.
        </p>

        <div className="mt-10">
          <ArchitectureMap overview={overview} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {callouts.map(({ label, body }) => (
            <div key={label} className="glass-card rounded-[1.5rem] p-6 transition-colors hover:border-violet-500/22">
              <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/45">{label}</p>
              <p className="mt-3 text-sm leading-relaxed text-white/55">{body}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Capability pillars
// ─────────────────────────────────────────────

const PILLARS = [
  {
    icon: Route,
    label: "Routing & Ingress",
    plain: "Every public request passes through a single, hardened entry point.",
    tech: "Traefik v3 · TLS automation · Cloudflare DNS-01 · HTTP→HTTPS redirect · secure-headers middleware",
    color: "from-violet-500/15 to-violet-500/0",
    iconColor: "text-violet-300",
    iconBg: "border-violet-500/20 bg-violet-500/10",
  },
  {
    icon: Lock,
    label: "Zero-Trust Auth",
    plain: "Protected apps can't be reached without authentication — enforced by policy, not convention.",
    tech: "Authelia ForwardAuth · LLDAP directory · OIDC clients · per-host session cookies · 2FA ready",
    color: "from-indigo-500/15 to-indigo-500/0",
    iconColor: "text-indigo-300",
    iconBg: "border-indigo-500/20 bg-indigo-500/10",
  },
  {
    icon: Activity,
    label: "Full Observability",
    plain: "CPU, memory, disk, network, GPU — everything is measured and visible in real time.",
    tech: "Prometheus · Grafana · node-exporter · cAdvisor · DCGM GPU exporter · 30s scrape interval",
    color: "from-sky-500/15 to-sky-500/0",
    iconColor: "text-sky-300",
    iconBg: "border-sky-500/20 bg-sky-500/10",
  },
  {
    icon: HardDrive,
    label: "Persistent Storage",
    plain: "Service state survives container rebuilds, updates, and migrations — nothing is lost.",
    tech: "/storage root · per-service UID isolation · owner/mode documented · state vs cache boundary enforced",
    color: "from-cyan-500/15 to-cyan-500/0",
    iconColor: "text-cyan-300",
    iconBg: "border-cyan-500/20 bg-cyan-500/10",
  },
  {
    icon: Bot,
    label: "GPU AI Inference",
    plain: "Run large language models locally, accessible to any OpenAI-compatible client.",
    tech: "Ollama · NVIDIA CUDA · OpenAI-compatible gateway · bearer-gated API · hot model swap",
    color: "from-emerald-500/15 to-emerald-500/0",
    iconColor: "text-emerald-300",
    iconBg: "border-emerald-500/20 bg-emerald-500/10",
  },
  {
    icon: GitBranch,
    label: "CI/CD Pipeline",
    plain: "Push to main and the change builds, publishes, and deploys automatically — no manual steps.",
    tech: "Jenkins + Docker-in-Docker · GitHub Actions · multi-arch images (amd64/arm64) · Watchtower hot-pull",
    color: "from-amber-500/15 to-amber-500/0",
    iconColor: "text-amber-300",
    iconBg: "border-amber-500/20 bg-amber-500/10",
  },
] as const;

function CapabilitySection() {
  return (
    <section className="mx-auto max-w-7xl px-5 md:px-8 lg:px-12">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.52 }}
      >
        <p className="section-eyebrow">What This Demonstrates</p>
        <h2 className="section-title">Skills in production.</h2>
        <p className="section-copy max-w-2xl">
          Each pillar below is live and running. Hover to see the tools underneath.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, label, plain, tech, color, iconColor, iconBg }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.42 }}
              className="pillar-card group"
            >
              {/* accent top glow */}
              <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[1.5rem] bg-gradient-to-b opacity-80", color)} />

              <div className="relative">
                <div className={cn("inline-flex rounded-[0.85rem] border p-2.5", iconBg)}>
                  <Icon className={cn("h-5 w-5", iconColor)} />
                </div>

                <h3 className="mt-4 text-base font-medium text-white/92">{label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/52">{plain}</p>

                <div className="mt-4 border-t border-white/[0.05] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300/38 transition-colors duration-200 group-hover:text-violet-300/60">
                    Stack
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/32 transition-colors duration-200 group-hover:text-white/55">
                    {tech}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Tech stack marquee
// ─────────────────────────────────────────────

const TECH_ITEMS = [
  { label: "Docker",      icon: Server    },
  { label: "Traefik",     icon: Route     },
  { label: "Authelia",    icon: Shield    },
  { label: "LLDAP",       icon: Database  },
  { label: "Prometheus",  icon: Activity  },
  { label: "Grafana",     icon: Activity  },
  { label: "PostgreSQL",  icon: Database  },
  { label: "Redis",       icon: Cpu       },
  { label: "NVIDIA",      icon: Cpu       },
  { label: "Ollama",      icon: Bot       },
  { label: "Next.js",     icon: Globe     },
  { label: "Jenkins",     icon: GitBranch },
  { label: "Cloudflare",  icon: Globe     },
  { label: "Linux",       icon: Server    },
  { label: "Python",      icon: Cpu       },
  { label: "TypeScript",  icon: Cpu       },
  { label: "Immich",      icon: Database  },
  { label: "Jellyfin",    icon: Database  },
  { label: "Nextcloud",   icon: Database  },
  { label: "Kubernetes",  icon: Server    },
] as const;

function TechStackSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 md:px-8 lg:px-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.45 }}
      >
        <p className="section-eyebrow">Technologies</p>
        <h2 className="section-title text-[clamp(1.5rem,2.4vw,2.4rem)]">The tools in the stack.</h2>

        <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <Marquee pauseOnHover className="[--duration:35s] [--gap:0.75rem]" repeat={3}>
            {TECH_ITEMS.map(({ label, icon: Icon }) => (
              <div key={label} className="tech-tag">
                <Icon className="h-3.5 w-3.5 opacity-70" />
                {label}
              </div>
            ))}
          </Marquee>
          <Marquee pauseOnHover reverse className="mt-3 [--duration:42s] [--gap:0.75rem]" repeat={3}>
            {[...TECH_ITEMS].reverse().map(({ label, icon: Icon }) => (
              <div key={label} className="tech-tag">
                <Icon className="h-3.5 w-3.5 opacity-70" />
                {label}
              </div>
            ))}
          </Marquee>
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Services section
// ─────────────────────────────────────────────

const SECTION_META: Record<string, { description: string; icon: LucideIcon; tone: string }> = {
  Platform:   { description: "Ingress, identity, and operator surfaces.",          icon: Shield,    tone: "from-violet-400/16 to-violet-200/0"  },
  Cloud:      { description: "Personal cloud applications and sync workloads.",    icon: Database,  tone: "from-sky-400/14   to-sky-200/0"      },
  Media:      { description: "Streaming, discovery, and media automation.",        icon: Globe,     tone: "from-emerald-400/14 to-emerald-200/0" },
  Automation: { description: "Indexers, release handling, and download ingestion.",icon: GitBranch, tone: "from-amber-400/14  to-amber-200/0"    },
  AI:         { description: "GPU-backed local inference and API gateway.",        icon: Bot,       tone: "from-cyan-400/14   to-cyan-200/0"     },
  Lab:        { description: "Additional domains and experimental services.",      icon: Server,    tone: "from-zinc-400/12   to-zinc-200/0"     },
};

function EndpointRow({ service, isLast }: { service: CheckedService; isLast: boolean }) {
  return (
    <a
      href={service.url}
      target="_blank"
      rel="noreferrer"
      className="endpoint-row group relative grid gap-3 px-4 py-4 pl-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5 md:pl-12"
    >
      <span
        className={cn(
          "pointer-events-none absolute left-4 top-[1.45rem] h-3 w-3 rounded-full border-2 border-[#07070e] shadow-sm md:left-5",
          service.active ? "bg-emerald-400" : "bg-rose-400",
        )}
      />
      {!isLast && (
        <span
          className={cn(
            "pointer-events-none absolute bottom-[-0.8rem] left-[21px] top-7 w-px md:left-6",
            service.active
              ? "bg-gradient-to-b from-emerald-400/30 via-white/6 to-transparent"
              : "bg-gradient-to-b from-rose-400/20 via-white/6 to-transparent",
          )}
        />
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-light text-white/92">{service.name}</h4>
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em]", getAccessTone(service.access))}>
            {service.access}
          </span>
          {service.dynamic && (
            <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/35">
              Dynamic
            </span>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/45">{service.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] uppercase tracking-[0.16em] text-white/30">
          <span className="font-mono normal-case tracking-[0.07em] text-white/38">{service.host}</span>
          <span className="hidden text-white/14 sm:inline">/</span>
          <span>{formatEndpointStatus(service)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <span className="inline-flex items-center rounded-full border border-white/7 bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] text-white/45">
          {service.statusCode !== null ? `${service.responseTimeMs}ms` : "n/a"}
        </span>
        <StatusPill active={service.active} error={service.error} />
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-white/28 transition-colors group-hover:text-white/65">
          Open <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </a>
  );
}

function ServicesSection({
  servicesBySection,
}: {
  servicesBySection: [string, CheckedService[]][];
}) {
  return (
    <section id="services" className="mx-auto max-w-7xl px-5 md:px-8 lg:px-12">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.52 }}
      >
        <p className="section-eyebrow">Services</p>
        <h2 className="section-title">Published endpoints.</h2>

        <div className="mt-10 space-y-5">
          {servicesBySection.map(([section, services]) => {
            const meta = SECTION_META[section] ?? SECTION_META.Lab;
            const Icon = meta.icon;
            const onlineCount = services.filter((s) => s.active).length;

            return (
              <section
                key={section}
                className="endpoint-cluster relative overflow-hidden p-5 md:p-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8"
              >
                <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-80", meta.tone)} />

                <div className="relative lg:pr-2">
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/35">
                    <Icon className="h-4 w-4" />
                    {section}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/35">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {onlineCount} live
                    </span>
                    <span className="h-1 w-1 rounded-full bg-white/18" />
                    <span>{services.length} routes</span>
                  </div>
                  <p className="mt-2 max-w-[180px] text-xs leading-relaxed text-white/38 font-light">
                    {meta.description}
                  </p>
                </div>

                <div className="relative mt-5 lg:mt-0">
                  <div className="endpoint-board">
                    {services.map((service, i) => (
                      <EndpointRow
                        key={service.id}
                        service={service}
                        isLast={i === services.length - 1}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────

function PageFooter({ overview }: { overview: Overview }) {
  const { meta, summary } = overview;

  type FooterLink = { href: string; label: string; icon: LucideIcon };
  const links: FooterLink[] = [
    meta.ownerGithubUrl    && { href: meta.ownerGithubUrl,                 label: "GitHub",   icon: Code2     },
    meta.ownerLinkedinUrl  && { href: meta.ownerLinkedinUrl,               label: "LinkedIn", icon: Briefcase },
    meta.ownerResumeUrl    && { href: meta.ownerResumeUrl,                 label: "Resume",   icon: FileText },
    meta.ownerContactEmail && { href: `mailto:${meta.ownerContactEmail}`,  label: "Email",    icon: Mail     },
  ].filter((x): x is FooterLink => Boolean(x));

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="mx-auto max-w-7xl px-5 pb-10 md:px-8 lg:px-12"
    >
      <div className="rounded-2xl border border-violet-500/10 bg-[#07070e]/80 p-5 text-xs text-white/35 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-55" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>
              {meta.ownerName}
              {meta.ownerRole && <span className="text-white/20"> · {meta.ownerRole}</span>}
            </span>
          </div>

          {links.length > 0 && (
            <div className="flex items-center gap-1">
              {links.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("mailto") ? undefined : "_blank"}
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all hover:bg-violet-500/8 hover:text-white/65"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ))}
            </div>
          )}

          <div className="font-mono tracking-wider text-white/30">
            {summary.activeServices} / {summary.totalServices} ONLINE ·{" "}
            {new Date(meta.refreshedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
          </div>
        </div>
      </div>
    </motion.footer>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export function HomelabExperience({ initialOverview }: { initialOverview: Overview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const deferredServices = useDeferredValue(overview.services);

  const refreshOverview = useEffectEvent(async () => {
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      if (!res.ok) throw new Error(`Refresh failed with ${res.status}`);
      const next = (await res.json()) as Overview;
      startTransition(() => {
        setOverview(next);
        setRefreshError(null);
      });
    } catch (err) {
      startTransition(() => {
        setRefreshError(err instanceof Error ? err.message : "Refresh failed");
      });
    }
  });

  useEffect(() => {
    const id = window.setInterval(() => void refreshOverview(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const servicesBySection = useMemo(() => {
    const grouped = new Map<string, CheckedService[]>();
    for (const svc of deferredServices) {
      if (!grouped.has(svc.section)) grouped.set(svc.section, []);
      grouped.get(svc.section)?.push(svc);
    }
    const known = SECTION_ORDER
      .map((s) => [s, grouped.get(s) ?? []] as const)
      .filter(([, svcs]) => svcs.length > 0);
    const extra = Array.from(grouped.entries())
      .filter(([s]) => !SECTION_ORDER.includes(s as (typeof SECTION_ORDER)[number]))
      .sort(([a], [b]) => a.localeCompare(b));
    return [...known, ...extra] as [string, CheckedService[]][];
  }, [deferredServices]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050508] text-white selection:bg-violet-500/20 selection:text-white">
      <NavBar overview={overview} />

      <HeroSection overview={overview} />

      <div className="space-y-28 pb-20">
        <TelemetrySection overview={overview} />
        <ArchitectureSection overview={overview} />
        <CapabilitySection />
        <TechStackSection />
        <ServicesSection servicesBySection={servicesBySection} />
        <PageFooter overview={overview} />
      </div>

      <AnimatePresence>
        {refreshError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-5 right-5 z-30 inline-flex max-w-xs items-start gap-2 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200 backdrop-blur-xl"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {refreshError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
