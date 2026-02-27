"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphLink, GraphNode, PhotoGraphResponse } from "@/types/graph";

const VIEWBOX_WIDTH = 1400;
const VIEWBOX_HEIGHT = 900;

type PositionedNode = GraphNode & {
  x: number;
  y: number;
  radius: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashToUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function clipId(id: string): string {
  return `clip-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function buildLayout(nodes: GraphNode[], links: GraphLink[]): Map<string, PositionedNode> {
  const centerX = VIEWBOX_WIDTH / 2;
  const centerY = VIEWBOX_HEIGHT / 2;
  const positioned = new Map<string, PositionedNode>();

  const tagNodes = nodes
    .filter((node) => node.type === "tag")
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  tagNodes.forEach((tagNode, index) => {
    const ring = Math.floor(index / 12);
    const inRingIndex = index % 12;
    const radiusBase = 170 + ring * 110;
    const theta = (Math.PI * 2 * inRingIndex) / 12 + ring * 0.32;
    const x = centerX + Math.cos(theta) * radiusBase;
    const y = centerY + Math.sin(theta) * radiusBase;
    positioned.set(tagNode.id, {
      ...tagNode,
      x: clamp(x, 28, VIEWBOX_WIDTH - 28),
      y: clamp(y, 28, VIEWBOX_HEIGHT - 28),
      radius: clamp(12 + Math.sqrt(Math.max(1, tagNode.count)) * 2.2, 14, 28),
    });
  });

  const photoToTags = new Map<string, string[]>();
  for (const link of links) {
    if (!photoToTags.has(link.source)) {
      photoToTags.set(link.source, []);
    }
    photoToTags.get(link.source)?.push(link.target);
  }

  nodes
    .filter((node) => node.type === "photo")
    .forEach((photoNode) => {
      const connectedTagIds = photoToTags.get(photoNode.id) ?? [];
      if (connectedTagIds.length === 0) return;

      let sumX = 0;
      let sumY = 0;
      let count = 0;

      for (const tagId of connectedTagIds) {
        const tagNode = positioned.get(tagId);
        if (!tagNode) continue;
        sumX += tagNode.x;
        sumY += tagNode.y;
        count += 1;
      }

      const jitterX = (hashToUnit(`${photoNode.id}:jx`) - 0.5) * 70;
      const jitterY = (hashToUnit(`${photoNode.id}:jy`) - 0.5) * 70;
      const baseX = count > 0 ? sumX / count : centerX;
      const baseY = count > 0 ? sumY / count : centerY;

      positioned.set(photoNode.id, {
        ...photoNode,
        x: clamp(baseX + jitterX, 30, VIEWBOX_WIDTH - 30),
        y: clamp(baseY + jitterY, 30, VIEWBOX_HEIGHT - 30),
        radius: 24,
      });
    });

  return positioned;
}

export function PhotoGraphView() {
  const [minTagFreq, setMinTagFreq] = useState(1);
  const [data, setData] = useState<PhotoGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/photos/graph?minTagFreq=${minTagFreq}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("그래프 데이터를 불러오지 못했습니다.");
        }
        const payload = (await response.json()) as PhotoGraphResponse;
        setData(payload);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string })?.name === "AbortError") return;
        const message =
          fetchError instanceof Error ? fetchError.message : "알 수 없는 오류가 발생했습니다.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [minTagFreq]);

  const positioned = useMemo(() => {
    if (!data) return null;
    return buildLayout(data.nodes, data.links);
  }, [data]);

  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !data) return;

    const handleMouseOver = (event: MouseEvent) => {
      const target = (event.target as Element).closest("g.graph-node") as SVGGElement | null;
      if (!target) return;

      const hoveredId = target.getAttribute("data-id");
      if (!hoveredId) return;

      const connectedIds = new Set<string>([hoveredId]);
      for (const link of data.links) {
        if (link.source === hoveredId) connectedIds.add(link.target);
        else if (link.target === hoveredId) connectedIds.add(link.source);
      }

      const nodes = svg.querySelectorAll<SVGGElement>("g.graph-node");
      for (const node of nodes) {
        const id = node.getAttribute("data-id");
        if (id && connectedIds.has(id)) {
          node.style.opacity = "1";
        } else {
          node.style.opacity = "0.2";
        }
      }

      const lines = svg.querySelectorAll<SVGLineElement>("line.graph-link");
      for (const line of lines) {
        const s = line.getAttribute("data-source");
        const t = line.getAttribute("data-target");
        if (hoveredId === s || hoveredId === t) {
          line.style.opacity = "0.9";
        } else {
          line.style.opacity = "0.15";
        }
      }
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = (event.target as Element).closest("g.graph-node");
      if (!target) return;

      const nodes = svg.querySelectorAll<SVGGElement>("g.graph-node");
      for (const node of nodes) {
        node.style.opacity = "1";
      }

      const lines = svg.querySelectorAll<SVGLineElement>("line.graph-link");
      for (const line of lines) {
        line.style.opacity = "0.4";
      }
    };

    svg.addEventListener("mouseover", handleMouseOver);
    svg.addEventListener("mouseout", handleMouseOut);

    return () => {
      svg.removeEventListener("mouseover", handleMouseOver);
      svg.removeEventListener("mouseout", handleMouseOut);
    };
  }, [data, positioned]);

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (event) => {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    setViewport((prev) => {
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
      const nextScale = clamp(prev.scale * zoomFactor, 0.55, 2.6);
      const worldX = (pointerX - prev.x) / prev.scale;
      const worldY = (pointerY - prev.y) / prev.scale;

      return {
        scale: nextScale,
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale,
      };
    });
  };

  const onPointerDown: React.PointerEventHandler<SVGSVGElement> = (event) => {
    draggingRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: viewport.x,
      startY: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove: React.PointerEventHandler<SVGSVGElement> = (event) => {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    setViewport((prev) => ({
      ...prev,
      x: drag.startX + dx,
      y: drag.startY + dy,
    }));
  };

  const onPointerUp: React.PointerEventHandler<SVGSVGElement> = (event) => {
    if (draggingRef.current?.pointerId === event.pointerId) {
      draggingRef.current = null;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Tag Filter</p>
            <p className="mt-1 text-sm text-stone-700">
              태그 최소 빈도: <span className="font-semibold">{minTagFreq}</span>
            </p>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={minTagFreq}
            onChange={(event) => {
              setLoading(true);
              setError(null);
              setMinTagFreq(Number(event.target.value));
            }}
            className="w-56 accent-stone-800"
            aria-label="태그 최소 빈도"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {loading && (
          <p className="p-6 text-sm text-stone-600">그래프를 불러오는 중...</p>
        )}
        {!loading && error && (
          <p className="p-6 text-sm text-red-700">{error}</p>
        )}
        {!loading && !error && data && positioned && (
          <>
            <div className="flex items-center justify-end gap-2 border-b border-stone-200 px-4 py-2">
              <button
                type="button"
                onClick={() => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale * 1.15, 0.55, 2.6) }))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 text-stone-700 hover:bg-stone-100"
                aria-label="확대"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale * 0.87, 0.55, 2.6) }))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 text-stone-700 hover:bg-stone-100"
                aria-label="축소"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
                className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100"
              >
                reset
              </button>
            </div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="h-[68vh] min-h-[460px] w-full touch-none select-none cursor-grab active:cursor-grabbing"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <defs>
                {data.nodes
                  .filter((node) => node.type === "photo")
                  .map((node) => {
                    const positionedNode = positioned.get(node.id);
                    if (!positionedNode) return null;
                    return (
                      <clipPath id={clipId(node.id)} key={node.id}>
                        <circle cx={positionedNode.x} cy={positionedNode.y} r={positionedNode.radius} />
                      </clipPath>
                    );
                  })}
              </defs>

              <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
                {data.links.slice(0, 1400).map((link, index) => {
                  const source = positioned.get(link.source);
                  const target = positioned.get(link.target);
                  if (!source || !target) return null;
                  return (
                    <line
                      key={`${link.source}-${link.target}-${index}`}
                      className="graph-link"
                      data-source={link.source}
                      data-target={link.target}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="rgb(120 113 108 / 0.55)"
                      strokeWidth={1.2}
                      opacity={0.4}
                      style={{ transition: "opacity 0.2s ease" }}
                    />
                  );
                })}

                {data.nodes
                  .filter((node) => node.type === "photo")
                  .map((node) => {
                    const item = positioned.get(node.id);
                    if (!item) return null;
                    return (
                      <g
                        key={node.id}
                        className="graph-node"
                        data-id={node.id}
                        opacity={1}
                        style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
                      >
                        <circle
                          cx={item.x}
                          cy={item.y}
                          r={item.radius + 2}
                          fill="white"
                          stroke="rgb(231 229 228)"
                          strokeWidth={1.2}
                        />
                        <image
                          href={`/_next/image?url=${encodeURIComponent(node.src)}&w=96&q=75`}
                          x={item.x - item.radius}
                          y={item.y - item.radius}
                          width={item.radius * 2}
                          height={item.radius * 2}
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#${clipId(node.id)})`}
                        />
                        <title>{node.title}</title>
                      </g>
                    );
                  })}

                {data.nodes
                  .filter((node) => node.type === "tag")
                  .map((node) => {
                    const item = positioned.get(node.id);
                    if (!item) return null;
                    return (
                      <g
                        key={node.id}
                        className="graph-node"
                        data-id={node.id}
                        opacity={1}
                        style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
                      >
                        <circle
                          cx={item.x}
                          cy={item.y}
                          r={item.radius}
                          fill="rgb(231 229 228)"
                          stroke="rgb(168 162 158)"
                          strokeWidth={1}
                        />
                        <text
                          x={item.x}
                          y={item.y + 0.5}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={10}
                          fill="rgb(41 37 36)"
                          className="font-medium"
                        >
                          {node.tag}
                        </text>
                        <title>{`${node.tag} (${node.count})`}</title>
                      </g>
                    );
                  })}
              </g>
            </svg>

            <div className="border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
              {`photos ${data.meta.totalPhotos} · tags ${data.meta.totalTags} · top ${data.meta.topTagsLimit}`}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
