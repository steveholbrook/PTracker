"use client";

import { useMemo, useRef } from "react";
import { addDays, format } from "date-fns";
import type {
  PoapActivity,
  PoapBaseline,
  PoapDependency,
  Workstream,
} from "@/types/domain";
import { activityProgress, todayDateString } from "@/utils/dashboard";
import {
  parseLocalDate,
  toLocalDateString,
  workingDaysBetween,
} from "@/utils/dates";
import {
  buildWorkstreamLayout,
  dateToPixel,
  pixelToDate,
} from "@/utils/poap";
import { cn } from "@/utils/cn";

const LEFT_WIDTH = 230;
const HEADER_HEIGHT = 48;
const LANE_HEIGHT = 34;

type DragOperation = {
  id: string;
  mode: "MOVE" | "RESIZE_LEFT" | "RESIZE_RIGHT";
  startClientX: number;
  original: PoapActivity;
};

export function GanttCanvas({
  projectStartDate,
  numberOfWeeks,
  mode,
  workstreams,
  activities,
  dependencies,
  baseline,
  criticalIds,
  selectedIds,
  editable,
  onSelect,
  onActivityChange,
  onCanvasDoubleClick,
  onToggleWorkstream,
  onReorderWorkstream,
}: {
  projectStartDate: string;
  numberOfWeeks: number;
  mode: "WEEK" | "MONTH";
  workstreams: Workstream[];
  activities: PoapActivity[];
  dependencies: PoapDependency[];
  baseline?: PoapBaseline;
  criticalIds: Set<string>;
  selectedIds: Set<string>;
  editable: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onActivityChange: (activity: PoapActivity, targetWorkstreamId?: string) => void;
  onCanvasDoubleClick: (date: string, workstreamId: string) => void;
  onToggleWorkstream: (workstreamId: string) => void;
  onReorderWorkstream: (sourceId: string, targetId: string) => void;
}) {
  const dragRef = useRef<DragOperation | undefined>(undefined);
  const draggedWorkstream = useRef<string | undefined>(undefined);
  const pixelsPerDay = mode === "WEEK" ? 17 : 5.2;
  const totalDays = numberOfWeeks * 7;
  const timelineWidth = totalDays * pixelsPerDay;
  const layout = useMemo(
    () => buildWorkstreamLayout(workstreams, activities, LANE_HEIGHT),
    [activities, workstreams],
  );
  const totalHeight = layout.reduce((total, row) => total + row.height, 0);
  const positions = useMemo(() => {
    const result = new Map<
      string,
      { x: number; y: number; width: number; activity: PoapActivity }
    >();
    layout.forEach((row) =>
      row.packed.forEach(({ activity, lane }) => {
        const x = dateToPixel(
          activity.startDate,
          projectStartDate,
          pixelsPerDay,
        );
        const width = activity.isMilestone
          ? 16
          : Math.max(
              10,
              (dateToPixel(
                toLocalDateString(
                  addDays(parseLocalDate(activity.endDate), 1),
                ),
                projectStartDate,
                pixelsPerDay,
              ) -
                x),
            );
        result.set(activity.id, {
          x,
          y: row.y + lane * LANE_HEIGHT + 7,
          width,
          activity,
        });
      }),
    );
    return result;
  }, [layout, pixelsPerDay, projectStartDate]);
  const today = todayDateString();
  const todayX = dateToPixel(today, projectStartDate, pixelsPerDay);
  const baselineMap = new Map(
    baseline?.activities.map((activity) => [activity.id, activity]) ?? [],
  );

  const timeHeaders = useMemo(() => {
    if (mode === "WEEK") {
      return Array.from({ length: numberOfWeeks }, (_, index) => {
        const start = addDays(parseLocalDate(projectStartDate), index * 7);
        return {
          key: `W${index + 1}`,
          label: `W${index + 1}`,
          sublabel: format(start, "dd MMM"),
          x: index * 7 * pixelsPerDay,
          width: 7 * pixelsPerDay,
        };
      });
    }
    const result: Array<{
      key: string;
      label: string;
      sublabel: string;
      x: number;
      width: number;
    }> = [];
    for (let day = 0; day < totalDays; day += 1) {
      const date = addDays(parseLocalDate(projectStartDate), day);
      const key = format(date, "yyyy-MM");
      const existing = result.at(-1);
      if (existing?.key === key) {
        existing.width += pixelsPerDay;
      } else {
        result.push({
          key,
          label: format(date, "MMMM"),
          sublabel: format(date, "yyyy"),
          x: day * pixelsPerDay,
          width: pixelsPerDay,
        });
      }
    }
    return result;
  }, [mode, numberOfWeeks, pixelsPerDay, projectStartDate, totalDays]);

  function finishDrag(event: React.PointerEvent<SVGSVGElement>) {
    const operation = dragRef.current;
    if (!operation) return;
    dragRef.current = undefined;
    const rawDelta =
      (event.clientX - operation.startClientX) / pixelsPerDay;
    const snapDays = mode === "WEEK" ? 7 : 30;
    const deltaDays = Math.round(rawDelta / snapDays) * snapDays;
    const next = { ...operation.original, updatedAt: new Date().toISOString() };
    if (operation.mode === "MOVE") {
      next.startDate = toLocalDateString(
        addDays(parseLocalDate(next.startDate), deltaDays),
      );
      next.endDate = toLocalDateString(
        addDays(parseLocalDate(next.endDate), deltaDays),
      );
    } else if (operation.mode === "RESIZE_LEFT") {
      const proposed = toLocalDateString(
        addDays(parseLocalDate(next.startDate), deltaDays),
      );
      if (proposed <= next.endDate) next.startDate = proposed;
    } else {
      const proposed = toLocalDateString(
        addDays(parseLocalDate(next.endDate), deltaDays),
      );
      if (proposed >= next.startDate) next.endDate = proposed;
    }
    next.durationWorkingDays = next.isMilestone
      ? 0
      : workingDaysBetween(next.startDate, next.endDate);
    const svgRect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - svgRect.top;
    const target = layout.find(
      (row) => y >= row.y && y <= row.y + row.height,
    );
    onActivityChange(next, target?.workstream.id);
  }

  return (
    <div className="scrollbar-thin h-[68vh] min-h-[560px] overflow-auto rounded-xl border border-[#d9e1eb] bg-white">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${LEFT_WIDTH}px ${timelineWidth}px`,
          gridTemplateRows: `${HEADER_HEIGHT}px ${Math.max(totalHeight, 60)}px`,
          minWidth: LEFT_WIDTH + timelineWidth,
        }}
      >
        <div className="sticky left-0 top-0 z-50 flex items-center border-b border-r border-white/10 bg-[#0b1f3a] px-4 text-xs font-bold uppercase tracking-[0.11em] text-white">
          Workstream
        </div>
        <div className="sticky top-0 z-40 flex bg-[#0b1f3a] text-white">
          {timeHeaders.map((header) => (
            <div
              key={header.key}
              className="flex shrink-0 flex-col items-center justify-center border-r border-white/10"
              style={{ width: header.width }}
            >
              <span className="text-xs font-bold">{header.label}</span>
              <span className="text-[9px] text-white/60">
                {header.sublabel}
              </span>
            </div>
          ))}
        </div>

        <div className="sticky left-0 z-30 bg-white">
          {layout.map((row) => {
            const rowActivities = activities.filter(
              (activity) => activity.workstreamId === row.workstream.id,
            );
            const completed = rowActivities.filter(
              (activity) => activity.status === "COMPLETE",
            ).length;
            return (
              <div
                key={row.workstream.id}
                draggable={editable}
                onDragStart={() => {
                  draggedWorkstream.current = row.workstream.id;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (
                    draggedWorkstream.current &&
                    draggedWorkstream.current !== row.workstream.id
                  ) {
                    onReorderWorkstream(
                      draggedWorkstream.current,
                      row.workstream.id,
                    );
                  }
                  draggedWorkstream.current = undefined;
                }}
                className="border-b border-r border-[#dce4ed] bg-white px-3 py-2"
                style={{ height: row.height }}
              >
                <button
                  onClick={() => onToggleWorkstream(row.workstream.id)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: row.workstream.colour }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#172033]">
                    {row.workstream.name}
                  </span>
                  <span className="text-[10px] text-[#7d8999]">
                    {row.workstream.collapsed ? "+" : "−"}
                  </span>
                </button>
                <p className="mt-1 truncate pl-5 text-[10px] text-[#7d8999]">
                  {row.workstream.owner || "Unassigned"} · {rowActivities.length}{" "}
                  activities · {rowActivities.length ? Math.round((completed / rowActivities.length) * 100) : 0}%
                </p>
              </div>
            );
          })}
        </div>

        <svg
          width={timelineWidth}
          height={Math.max(totalHeight, 60)}
          className="select-none bg-[#fbfcfd]"
          onPointerUp={finishDrag}
          onPointerCancel={() => {
            dragRef.current = undefined;
          }}
          onDoubleClick={(event) => {
            if (!editable) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const row = layout.find(
              (item) => y >= item.y && y <= item.y + item.height,
            );
            if (row)
              onCanvasDoubleClick(
                pixelToDate(x, projectStartDate, pixelsPerDay),
                row.workstream.id,
              );
          }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#62738a" />
            </marker>
            <marker
              id="critical-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c43d4f" />
            </marker>
          </defs>
          {timeHeaders.map((header) => (
            <line
              key={header.key}
              x1={header.x}
              y1={0}
              x2={header.x}
              y2={totalHeight}
              stroke="#e2e8ef"
            />
          ))}
          {layout.map((row) => (
            <g key={row.workstream.id}>
              <rect
                x={0}
                y={row.y}
                width={timelineWidth}
                height={row.height}
                fill={row.workstream.order % 2 ? "#f7f9fb" : "#ffffff"}
              />
              <line
                x1={0}
                y1={row.y + row.height}
                x2={timelineWidth}
                y2={row.y + row.height}
                stroke="#dce4ed"
              />
            </g>
          ))}

          {baseline
            ? activities.map((activity) => {
                const baselineActivity = baselineMap.get(activity.id);
                const position = positions.get(activity.id);
                if (!baselineActivity || !position) return null;
                const x = dateToPixel(
                  baselineActivity.startDate,
                  projectStartDate,
                  pixelsPerDay,
                );
                const width = Math.max(
                  4,
                  dateToPixel(
                    toLocalDateString(
                      addDays(parseLocalDate(baselineActivity.endDate), 1),
                    ),
                    projectStartDate,
                    pixelsPerDay,
                  ) - x,
                );
                return (
                  <rect
                    key={`baseline-${activity.id}`}
                    x={x}
                    y={position.y + 21}
                    width={width}
                    height={6}
                    rx={3}
                    fill="#9aa8b8"
                    opacity={0.55}
                  />
                );
              })
            : null}

          {dependencies.map((dependency) => {
            const from = positions.get(dependency.predecessorId);
            const to = positions.get(dependency.successorId);
            if (!from || !to) return null;
            const fromX = from.x + from.width;
            const fromY = from.y + 10;
            const toX = to.x;
            const toY = to.y + 10;
            const midX = Math.max(fromX + 14, (fromX + toX) / 2);
            const critical =
              criticalIds.has(dependency.predecessorId) &&
              criticalIds.has(dependency.successorId);
            return (
              <path
                key={dependency.id}
                d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX - 3} ${toY}`}
                fill="none"
                stroke={critical ? "#c43d4f" : "#62738a"}
                strokeWidth={critical ? 2 : 1.4}
                markerEnd={
                  critical ? "url(#critical-arrow)" : "url(#arrow)"
                }
                opacity={0.8}
              />
            );
          })}

          {[...positions.values()].map(({ activity, x, y, width }) => {
            const selected = selectedIds.has(activity.id);
            const critical = criticalIds.has(activity.id);
            const progress = activityProgress(activity, today);
            if (activity.isMilestone) {
              return (
                <g
                  key={activity.id}
                  transform={`translate(${x},${y + 2}) rotate(45 8 8)`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect(activity.id, event.ctrlKey || event.metaKey);
                    dragRef.current = {
                      id: activity.id,
                      mode: "MOVE",
                      startClientX: event.clientX,
                      original: activity,
                    };
                  }}
                  className={editable ? "cursor-grab" : ""}
                >
                  <title>{`${activity.name} · ${activity.startDate}`}</title>
                  <rect
                    width={16}
                    height={16}
                    rx={2}
                    fill={critical ? "#c43d4f" : activity.colour}
                    stroke={selected ? "#0b1f3a" : "white"}
                    strokeWidth={selected ? 3 : 1.5}
                  />
                </g>
              );
            }
            return (
              <g
                key={activity.id}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect(activity.id, event.ctrlKey || event.metaKey);
                  if (editable)
                    dragRef.current = {
                      id: activity.id,
                      mode: "MOVE",
                      startClientX: event.clientX,
                      original: activity,
                    };
                }}
                className={editable ? "cursor-grab" : ""}
              >
                <title>{`${activity.name}\n${activity.startDate} → ${activity.endDate}\n${progress.toFixed(0)}% complete`}</title>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={21}
                  rx={5}
                  fill={activity.colour}
                  stroke={
                    selected ? "#0b1f3a" : critical ? "#c43d4f" : "white"
                  }
                  strokeWidth={selected ? 3 : critical ? 2.5 : 1}
                />
                <rect
                  x={x}
                  y={y}
                  width={(width * progress) / 100}
                  height={21}
                  rx={5}
                  fill="#07192f"
                  opacity={0.28}
                />
                {width > 58 ? (
                  <text
                    x={x + 8}
                    y={y + 14}
                    fill="white"
                    fontSize={10}
                    fontWeight={700}
                    pointerEvents="none"
                  >
                    {activity.name.length > Math.floor(width / 7)
                      ? `${activity.name.slice(0, Math.floor(width / 7) - 1)}…`
                      : activity.name}
                  </text>
                ) : null}
                {editable && selected ? (
                  <>
                    <rect
                      x={x - 3}
                      y={y + 3}
                      width={7}
                      height={15}
                      rx={2}
                      fill="white"
                      stroke="#0b1f3a"
                      className="cursor-ew-resize"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        dragRef.current = {
                          id: activity.id,
                          mode: "RESIZE_LEFT",
                          startClientX: event.clientX,
                          original: activity,
                        };
                      }}
                    />
                    <rect
                      x={x + width - 4}
                      y={y + 3}
                      width={7}
                      height={15}
                      rx={2}
                      fill="white"
                      stroke="#0b1f3a"
                      className="cursor-ew-resize"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        dragRef.current = {
                          id: activity.id,
                          mode: "RESIZE_RIGHT",
                          startClientX: event.clientX,
                          original: activity,
                        };
                      }}
                    />
                  </>
                ) : null}
              </g>
            );
          })}

          {todayX >= 0 && todayX <= timelineWidth ? (
            <g pointerEvents="none">
              <line
                x1={todayX}
                y1={0}
                x2={todayX}
                y2={totalHeight}
                stroke="#d12d43"
                strokeWidth={2}
              />
              <rect
                x={Math.max(0, todayX - 22)}
                y={1}
                width={44}
                height={16}
                rx={3}
                fill="#d12d43"
              />
              <text
                x={todayX}
                y={12}
                textAnchor="middle"
                fill="white"
                fontSize={8}
                fontWeight={800}
              >
                TODAY
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <div
        className={cn(
          "sticky bottom-2 left-2 z-50 ml-2 mt-[-36px] w-max rounded-lg border px-3 py-1.5 text-[10px] shadow-sm",
          todayX < 0 || todayX > timelineWidth
            ? "border-[#efd39f] bg-[#fff7e8] text-[#8f5e0b]"
            : "border-[#dbe3eb] bg-white/95 text-[#6f7e92]",
        )}
      >
        {todayX < 0
          ? "Today is before the project horizon"
          : todayX > timelineWidth
            ? "Today is after the project horizon"
            : "Drag bars to move · use handles to resize · Ctrl-click to multi-select"}
      </div>
    </div>
  );
}
