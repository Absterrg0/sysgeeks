import type { CSSProperties, ReactNode } from "react";
import { getInvestigation, listConcepts, listInvestigations } from "@/lib/content";
import { C, Mark, OG_CONTENT_TYPE, OG_SIZE, render } from "@/lib/og";
import { SITE_HOST, SITE_TITLE } from "@/lib/site";

export const alt = SITE_TITLE;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* The home page's hero as a card: the headline, and a real system failing with its incident ticket. */

const ROW = 430;
const NODE = { w: 170, h: 72 };
const COL = [64, 290, 516, 742, 968];
const FAILED = 3;
// The ticket is placed by its bottom edge, where the lead from the failure meets it.
const TICKET = { left: 688, width: 450, bottom: 372 };

const mono: CSSProperties = { fontFamily: "Mono", textTransform: "uppercase", letterSpacing: 1.5 };

function Node({ col, kind, name, down }: { col: number; kind: string; name: string; down?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: COL[col],
        top: ROW,
        width: NODE.w,
        height: NODE.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 12,
        background: down
          ? "repeating-linear-gradient(135deg, rgba(244,96,106,0.14) 0px, rgba(244,96,106,0.14) 2px, transparent 2px, transparent 8px), linear-gradient(#24121a, #1a0e12)"
          : "linear-gradient(#17181d, #101116)",
        border: down ? "2px solid #F4606A" : "1px solid rgba(255,255,255,0.1)",
        boxShadow: down ? "0 0 44px -6px rgba(244,96,106,0.6)" : "0 14px 30px -14px rgba(0,0,0,0.9)",
      }}
    >
      {down && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 99, background: "#F4606A" }} />
      )}
      <div style={{ ...mono, fontSize: 12, color: down ? C.gap : C.ink3 }}>{kind}</div>
      <div style={{ fontFamily: "Sans", fontWeight: 500, fontSize: 18, color: C.ink }}>{name}</div>
    </div>
  );
}

const y = ROW + NODE.h / 2;
const left = (col: number) => COL[col]!;
const right = (col: number) => COL[col]! + NODE.w;

/** A flow between neighbours, with a request on it if it is running. A plain function: Satori takes only SVG elements inside <svg>. */
function flow(x1: number, x2: number, broken = false) {
  const dir = Math.sign(x2 - x1);
  const end = x2 - dir * 7;
  return (
    <g key={`${x1}-${x2}`}>
      <path
        d={`M${x1} ${y} H${end}`}
        stroke={broken ? "#F4606A" : "#3A3E47"}
        strokeWidth={broken ? 2.2 : 2}
        strokeDasharray={broken ? "5 5" : undefined}
        fill="none"
      />
      <path d={`M${x2} ${y} l${-dir * 9} -5 v10 z`} fill={broken ? "#F4606A" : "#6B707B"} />
      {!broken && (
        <g>
          <path d={`M${x1 + 12} ${y} h20`} stroke={C.accent} strokeOpacity={0.3} strokeWidth={9} strokeLinecap="round" />
          <path d={`M${x1 + 12} ${y} h20`} stroke={C.accent} strokeWidth={3} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

function Line({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "flex", ...style }}>{children}</div>;
}

export default async function Image() {
  const investigation = getInvestigation("video-processing-pipeline");
  const stageIndex = investigation?.stages.findIndex((s) => s.id === "worker-dies-mid-job") ?? -1;
  const event = investigation?.stages[stageIndex]?.event?.title ?? "Deploy kills a worker mid-transcode";
  const stage = String(stageIndex + 1).padStart(2, "0");
  const failedX = COL[FAILED]! + NODE.w / 2;

  return render(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#07080A",
        color: C.ink,
        fontFamily: "Sans",
      }}
    >
      {/* The matrix, lit around the running system; cool light on the headline; red light from the failure. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage: "radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.17) 1.2px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage: "radial-gradient(ellipse 62% 58% at 62% 66%, rgba(7,8,10,0) 0%, rgba(7,8,10,0.55) 55%, #07080A 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage: "radial-gradient(ellipse 48% 52% at 22% 34%, rgba(0,150,255,0.09), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage: `radial-gradient(ellipse 26% 32% at ${failedX}px ${y}px, rgba(244,96,106,0.24), transparent 72%)`,
        }}
      />

      <div style={{ position: "absolute", left: 64, top: 50, display: "flex", alignItems: "center", gap: 16 }}>
        <Mark size={44} />
        <div style={{ display: "flex", fontFamily: "Pixel", fontSize: 34 }}>
          <span>sys</span>
          <span style={{ color: C.ink3 }}>geeks</span>
        </div>
      </div>
      <div style={{ position: "absolute", right: 62, top: 62, display: "flex", ...mono, fontSize: 17, color: C.ink2 }}>
        {SITE_HOST}
      </div>

      <div style={{ position: "absolute", left: 64, top: 140, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, ...mono, fontSize: 15, color: C.ink3 }}>
          <div style={{ width: 10, height: 10, borderRadius: 99, background: "#F4606A", boxShadow: "0 0 10px #F4606A" }} />
          Live · stage {stage} of {String(investigation?.stages.length ?? 14).padStart(2, "0")}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 20,
            fontFamily: "Display",
            fontWeight: 500,
            fontSize: 62,
            lineHeight: 1.04,
            letterSpacing: -2,
          }}
        >
          <Line>Every system breaks.</Line>
          <Line>
            Learn
            <span
              style={{
                margin: "0 16px",
                fontFamily: "Pixel",
                letterSpacing: 0,
                color: C.accent,
                textShadow: "0 0 22px rgba(0,187,255,0.5)",
              }}
            >
              why
            </span>
            before
          </Line>
          <Line>the interviewer asks.</Line>
        </div>
      </div>

      {/* The incident, edged in the failure's red, with the log carved into it. */}
      <div
        style={{
          position: "absolute",
          left: TICKET.left,
          bottom: OG_SIZE.height - TICKET.bottom,
          width: TICKET.width,
          display: "flex",
          flexDirection: "column",
          padding: "20px 22px",
          borderRadius: 18,
          background: "linear-gradient(#15161a, #101115)",
          border: "1px solid rgba(244,96,106,0.4)",
          boxShadow: "0 0 80px -24px rgba(244,96,106,0.55)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 14 }}>
          <span style={{ color: C.gap }}>Failure · stage {stage}</span>
          <span style={{ color: C.ink3 }}>12:05:01</span>
        </div>
        <div style={{ display: "flex", marginTop: 10, fontFamily: "Display", fontWeight: 500, fontSize: 24, letterSpacing: -0.4 }}>
          {event}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 11,
            background: "#0A0B0D",
            border: "1px solid rgba(255,255,255,0.05)",
            fontFamily: "Mono",
            fontSize: 14,
            lineHeight: 1.75,
            color: C.ink3,
          }}
        >
          <Line>
            <span style={{ color: C.ink2, marginRight: 10 }}>12:04:31</span>worker-3 SIGTERM, 30 s grace
          </Line>
          <Line style={{ color: C.gap }}>
            <span style={{ marginRight: 10 }}>12:05:01</span>worker-3 killed
          </Line>
          <Line>
            <span style={{ color: C.ink2, marginRight: 10 }}>12:05:01</span>job 812 running · owner=worker-3
          </Line>
        </div>
      </div>

      <svg width={1200} height={630} viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
        {flow(right(0), left(1))}
        {flow(right(1), left(2))}
        {flow(left(3), right(2), true)}
        {flow(right(3), left(4), true)}
        <path
          d={`M${failedX} ${ROW} V${TICKET.bottom}`}
          stroke="#F4606A"
          strokeOpacity={0.8}
          strokeWidth={1.6}
          strokeDasharray="3 5"
        />
      </svg>

      <Node col={0} kind="Client" name="Instructor" />
      <Node col={1} kind="Service" name="Video API" />
      <Node col={2} kind="Database" name="Postgres" />
      <Node col={3} kind="Worker · down" name="Transcode workers" down />
      <Node col={4} kind="Object store" name="Object storage" />

      <div
        style={{
          position: "absolute",
          left: 64,
          bottom: 50,
          display: "flex",
          gap: 28,
          ...mono,
          fontSize: 17,
          color: C.ink3,
        }}
      >
        <span>{listInvestigations().length} systems</span>
        <span>{listConcepts().length} concepts</span>
        <span>Free, no signup</span>
      </div>
    </div>,
  );
}
