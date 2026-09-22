import { Children, cloneElement, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  useSensor, useSensors, defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "motion/react";
import { Badge, Button, Card, Checkbox, Dialog, DropdownMenu, Flex, IconButton, Text, Tooltip } from "@radix-ui/themes";
import { ArrowDownUp, Check, GripVertical, LayoutDashboard, Maximize2, Plus, RotateCcw, Settings2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { readCurrentThemeSettings, saveThemeSettings } from "@/utils/saveThemeSettings";
import { DASHBOARD_SETTINGS_KEY, defaultHeight, defaultLayout, defaultLimit, defaultWidth, parseDashboardLayout, widgetIds, type DashboardLayout, type WidgetHeight, type WidgetId, type WidgetWidth } from "./layout";
import "./dashboard.css";

type WidgetProps = {
  id: WidgetId;
  children: ReactNode | ((limit: number) => ReactNode);
  supportsLimit?: boolean;
  limit?: number;
};

const GRID_ROW_HEIGHT = 8;
const GRID_GAP = 16;

const minimumWidgetHeight = (height: WidgetHeight) => {
  if (height === "normal") return 360;
  if (height === "tall") return 488;
  return 176;
};

const rowSpanFor = (height: number) =>
  Math.max(1, Math.ceil((height + GRID_GAP) / (GRID_ROW_HEIGHT + GRID_GAP)));

export function DashboardWidget({ children, limit = 5 }: WidgetProps) {
  return <>{typeof children === "function" ? children(limit) : children}</>;
}

function SortableWidget({ item, editing, title, supportsLimit, onRemove, onWidth, onHeight, onLimit, children }: {
  item: DashboardLayout[number]; editing: boolean; title: string;
  supportsLimit: boolean; onRemove: () => void; onWidth: (width: WidgetWidth) => void;
  onHeight: (height: WidgetHeight) => void; onLimit: (limit: number) => void; children: ReactNode;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [rowSpan, setRowSpan] = useState(() => rowSpanFor(minimumWidgetHeight(item.height)));
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const controlsHeight = toolsRef.current?.offsetHeight ?? 0;
        const naturalHeight = body.scrollHeight + controlsHeight;
        setRowSpan(rowSpanFor(Math.max(minimumWidgetHeight(item.height), naturalHeight)));
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [item.height, item.limit, editing]);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id, disabled: !editing,
    transition: { duration: reduced ? 0 : 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });
  return (
    <section ref={setNodeRef} data-widget={item.id} data-width={item.width} data-height={item.height}
      className={`km-dashboard-widget${isDragging ? " is-dragging" : ""}`}
      aria-label={title}
      style={{ transform: CSS.Translate.toString(transform), transition, gridRowEnd: `span ${rowSpan}` }}>
      <Card className="km-dashboard-widget-card">
        {editing && <div ref={toolsRef} className="km-dashboard-widget-tools">
          <Tooltip content={t("dashboardLayout.move", { name: title })}>
            <IconButton ref={setActivatorNodeRef} {...attributes} {...listeners}
              className="km-dashboard-grip" variant="ghost" color="gray"
              aria-label={t("dashboardLayout.move", { name: title })}>
              <GripVertical size={16} />
            </IconButton>
          </Tooltip>
          <Text size="1" color="gray" className="km-dashboard-tool-title">{title}</Text>
          <DropdownMenu.Root>
            <Tooltip content={t("dashboardLayout.width")}>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" color="gray" aria-label={t("dashboardLayout.width")}>
                  <Maximize2 size={15} />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup value={item.width} onValueChange={(value) => onWidth(value as WidgetWidth)}>
                {(["compact", "wide", "full"] as const).map((width) =>
                  <DropdownMenu.RadioItem key={width} value={width}>{t(`dashboardLayout.${width}`)}</DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          {supportsLimit && <DropdownMenu.Root>
            <Tooltip content={t("dashboardLayout.visibleNodes")}>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" color="gray" aria-label={t("dashboardLayout.visibleNodes")}>
                  <Settings2 size={15} />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup value={String(item.limit)} onValueChange={(value) => onLimit(Number(value))}>
                {[2, 3, 4, 5, 8, 10].map((limit) =>
                  <DropdownMenu.RadioItem key={limit} value={String(limit)}>{t("dashboardLayout.visibleNodesCount", { count: limit })}</DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>}
          <DropdownMenu.Root>
            <Tooltip content={t("dashboardLayout.height")}>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" color="gray" aria-label={t("dashboardLayout.height")}>
                  <ArrowDownUp size={15} />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup value={item.height} onValueChange={(value) => onHeight(value as WidgetHeight)}>
                {(["short", "normal", "tall"] as const).map((height) =>
                  <DropdownMenu.RadioItem key={height} value={height}>{t(`dashboardLayout.${height}`)}</DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <Tooltip content={t("dashboardLayout.hide", { name: title })}>
            <IconButton variant="ghost" color="gray" onClick={onRemove} aria-label={t("dashboardLayout.hide", { name: title })}>
              <X size={15} />
            </IconButton>
          </Tooltip>
        </div>}
        <div ref={bodyRef} className="km-dashboard-widget-body">{children}</div>
      </Card>
    </section>
  );
}

export function DashboardBoard({ children }: { children: ReactElement<WidgetProps>[] }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [layout, setLayout] = useState<DashboardLayout>(defaultLayout);
  const [saved, setSaved] = useState<DashboardLayout>(defaultLayout);
  const [theme, setTheme] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<WidgetId | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const widgets = new Map((Children.toArray(children) as ReactElement<WidgetProps>[]).map((child) => [child.props.id, child]));
  const title = (id: WidgetId) => t(`dashboardLayout.widgets.${id}`);
  const renderedWidgets = layout.map((item) => {
    const widget = widgets.get(item.id);
    if (!widget) return null;
    return <SortableWidget key={item.id} item={item} title={title(item.id)}
      editing={editing && !saving} supportsLimit={Boolean(widget.props.supportsLimit)}
      onRemove={() => setLayout((current) => current.filter((entry) => entry.id !== item.id))}
      onWidth={(width) => setLayout((current) => current.map((entry) => entry.id === item.id ? { ...entry, width } : entry))}
      onHeight={(height) => setLayout((current) => current.map((entry) => entry.id === item.id ? { ...entry, height } : entry))}
      onLimit={(limit) => setLayout((current) => current.map((entry) => entry.id === item.id ? { ...entry, limit } : entry))}>
      {cloneElement(widget, { limit: item.limit })}
    </SortableWidget>;
  });
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    readCurrentThemeSettings().then((result) => {
      if (cancelled) return;
      const next = parseDashboardLayout(result.settings[DASHBOARD_SETTINGS_KEY]);
      setTheme(result.theme);
      setSaved(next);
      setLayout(next);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  const save = async () => {
    if (theme === null) return;
    setSaving(true);
    try {
      await saveThemeSettings(theme, { [DASHBOARD_SETTINGS_KEY]: layout });
      setSaved(layout);
      setEditing(false);
      toast.success(t("dashboardLayout.saved"));
    } catch {
      toast.error(t("dashboardLayout.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="km-dashboard-board" data-editing={editing}>
      <Flex align="center" justify="between" gap="3" wrap="wrap" className="km-dashboard-board-toolbar">
        <Flex gap="2" align="center">
          <LayoutDashboard size={16} color="var(--gray-10)" />
          <Text size="2" weight="medium">{t(editing ? "dashboardLayout.editing" : "dashboardLayout.workspace")}</Text>
          <Badge color="gray" variant="soft">{layout.length} / {widgetIds.length}</Badge>
        </Flex>
        <Flex gap="2" align="center" wrap="wrap">
          {loadError ? <Button size="2" variant="soft" color="red" onClick={() => setAttempt((value) => value + 1)}>
            <RotateCcw size={14} />{t("dashboardLayout.loadFailed")}
          </Button> : editing ? <>
            <Tooltip content={t("dashboardLayout.reset")}>
              <IconButton variant="ghost" color="gray" disabled={saving} aria-label={t("dashboardLayout.reset")}
                onClick={() => setLayout(defaultLayout())}><RotateCcw size={16} /></IconButton>
            </Tooltip>
            <Button variant="soft" disabled={saving} onClick={() => setChoosing(true)}><Plus size={15} />{t("dashboardLayout.cards")}</Button>
            <Button variant="soft" color="gray" disabled={saving} onClick={() => { setLayout(saved); setEditing(false); }}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button loading={saving} onClick={() => void save()}><Check size={15} />{t("common.save", "Save")}</Button>
          </> : <Button variant="soft" disabled={theme === null} onClick={() => setEditing(true)}>
            <Settings2 size={15} />{t("dashboardLayout.customize")}
          </Button>}
        </Flex>
      </Flex>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: { draggable: t("dashboardLayout.keyboard") },
          announcements: {
            onDragStart: ({ active }) => t("dashboardLayout.picked", { name: title(active.id as WidgetId) }),
            onDragOver: ({ active, over }) => over ? t("dashboardLayout.moved", { name: title(active.id as WidgetId), position: layout.findIndex((item) => item.id === over.id) + 1 }) : undefined,
            onDragEnd: () => t("dashboardLayout.dropped"),
            onDragCancel: () => t("dashboardLayout.cancelled"),
          },
        }}
        onDragStart={({ active }) => setActive(active.id as WidgetId)}
        onDragCancel={() => setActive(null)}
        onDragEnd={({ active, over }) => {
          setActive(null);
          if (over && active.id !== over.id) setLayout((current) =>
            arrayMove(current, current.findIndex((item) => item.id === active.id), current.findIndex((item) => item.id === over.id)));
        }}>
        <SortableContext items={layout.map((item) => item.id)} strategy={rectSortingStrategy}>
          <div className="km-dashboard-grid">{renderedWidgets}</div>
        </SortableContext>
        <DragOverlay adjustScale={false} dropAnimation={reduced ? null : {
          duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
        }}>
          {active && <Card className="km-dashboard-drag-preview">
            <div className="km-dashboard-widget-tools"><GripVertical size={16} /><Text size="1">{title(active)}</Text></div>
            <div className="km-dashboard-widget-body">{widgets.get(active)}</div>
          </Card>}
        </DragOverlay>
      </DndContext>
      {layout.length === 0 && <div className="km-dashboard-empty">
        <LayoutDashboard size={28} color="var(--gray-9)" />
        <Text size="2" color="gray">{t("dashboardLayout.empty")}</Text>
        <Button variant="soft" disabled={theme === null} onClick={() => { setEditing(true); setChoosing(true); }}>
          <Plus size={15} />{t("dashboardLayout.cards")}
        </Button>
      </div>}
      <Dialog.Root open={choosing} onOpenChange={setChoosing}>
        <Dialog.Content maxWidth="480px">
          <Dialog.Title>{t("dashboardLayout.cards")}</Dialog.Title>
          <Dialog.Description size="2" color="gray">{t("dashboardLayout.selection", { count: layout.length })}</Dialog.Description>
          <div className="km-dashboard-catalog">
            {widgetIds.map((id) => <label key={id} className="km-dashboard-catalog-row">
              <Checkbox checked={layout.some((item) => item.id === id)} onCheckedChange={(checked) =>
                setLayout((current) => checked === true
                  ? [...current.filter((item) => item.id !== id), { id, width: defaultWidth(id), height: defaultHeight(id), limit: defaultLimit(id) }]
                  : current.filter((item) => item.id !== id))} />
              <Text size="2">{title(id)}</Text>
            </label>)}
          </div>
          <Flex justify="end" mt="4"><Dialog.Close><Button>{t("common.done", "Done")}</Button></Dialog.Close></Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
