import {
  ArrowRightLeft, ExternalLink, ArrowDownToLine, Eye, EyeOff, ToggleRight, Sparkle, MessageSquare, Timer, ShoppingCart, Send, MailPlus, RotateCcw,
  Ban, ListChecks, Trash2, type LucideIcon,
} from "lucide-react";
import { SYSTEM_PAGES, type ActionType, type Condition, type LayoutNode, type SiteConfig, type Trigger, type Workflow, type WorkflowAction } from "@/lib/editor/schema";
import { newNodeId } from "@/lib/editor/nodes";
import { elementLabel } from "./style-panel";

// Shared metadata for the workflow editor and the element logic dialog.

export type ActionMeta = { type: ActionType; label: string; group: string; icon: LucideIcon; staff?: boolean; make: () => WorkflowAction };

const aid = () => newNodeId("act");

export const ACTIONS: ActionMeta[] = [
  { type: "goToPage", label: "Go to page", group: "Navigation", icon: ArrowRightLeft, make: () => ({ id: aid(), type: "goToPage", to: "/products" }) },
  { type: "openUrl", label: "Open external website", group: "Navigation", icon: ExternalLink, make: () => ({ id: aid(), type: "openUrl", url: "https://", newTab: true }) },
  { type: "scrollTo", label: "Scroll to element / top", group: "Navigation", icon: ArrowDownToLine, make: () => ({ id: aid(), type: "scrollTo" }) },
  { type: "show", label: "Show an element", group: "Element actions", icon: Eye, make: () => ({ id: aid(), type: "show", nodeId: "pick-element" }) },
  { type: "hide", label: "Hide an element", group: "Element actions", icon: EyeOff, make: () => ({ id: aid(), type: "hide", nodeId: "pick-element" }) },
  { type: "toggle", label: "Toggle an element (show/hide)", group: "Element actions", icon: ToggleRight, make: () => ({ id: aid(), type: "toggle", nodeId: "pick-element" }) },
  { type: "toggleState", label: "Toggle an element's state (for conditions)", group: "Element actions", icon: Sparkle, make: () => ({ id: aid(), type: "toggleState", nodeId: "pick-element" }) },
  { type: "showMessage", label: "Show a message", group: "Messages & timing", icon: MessageSquare, make: () => ({ id: aid(), type: "showMessage", text: "Thank you!" }) },
  { type: "wait", label: "Wait", group: "Messages & timing", icon: Timer, make: () => ({ id: aid(), type: "wait", ms: 1000 }) },
  { type: "submitForm", label: "Save form submission", group: "Forms & data", icon: Send, make: () => ({ id: aid(), type: "submitForm" }) },
  { type: "subscribe", label: "Subscribe email to newsletter", group: "Forms & data", icon: MailPlus, make: () => ({ id: aid(), type: "subscribe", field: "email" }) },
  { type: "resetForm", label: "Reset the form", group: "Forms & data", icon: RotateCcw, make: () => ({ id: aid(), type: "resetForm" }) },
  { type: "addToCart", label: "Add a product to the cart", group: "Shop", icon: ShoppingCart, make: () => ({ id: aid(), type: "addToCart", productId: "", quantity: 1 }) },
  { type: "cancelOrder", label: "Cancel an order", group: "Orders (staff only)", icon: Ban, staff: true, make: () => ({ id: aid(), type: "cancelOrder", orderField: "order" }) },
  { type: "setOrderStatus", label: "Change an order's status", group: "Orders (staff only)", icon: ListChecks, staff: true, make: () => ({ id: aid(), type: "setOrderStatus", status: "PROCESSING", orderField: "order" }) },
  { type: "deleteOrder", label: "Delete an order", group: "Orders (staff only)", icon: Trash2, staff: true, make: () => ({ id: aid(), type: "deleteOrder", orderField: "order" }) },
];
export const ACTION_META = Object.fromEntries(ACTIONS.map((a) => [a.type, a])) as Record<ActionType, ActionMeta>;

// ─── Element index (for pickers and summaries) ────────────────────────────

export type NodeRef = { id: string; type: LayoutNode["type"]; label: string; pageId: string; pageName: string; sectionId: string; node: LayoutNode };

export const SYSTEM_PAGE_REFS = SYSTEM_PAGES.map((p) => ({ id: `sys:${p.kind}`, name: p.name, slug: p.slug, kind: p.kind }));

export function pageRefs(config: SiteConfig) {
  return [...config.pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug })), ...SYSTEM_PAGE_REFS];
}

export function indexNodes(config: SiteConfig): NodeRef[] {
  const out: NodeRef[] = [];
  const add = (pageId: string, pageName: string, sections: { id: string; nodes?: LayoutNode[] }[]) => {
    const walk = (nodes: LayoutNode[], sectionId: string) => {
      for (const n of nodes) {
        const text = typeof n.props.text === "string" ? n.props.text : typeof n.props.label === "string" ? n.props.label : typeof n.props.formName === "string" ? n.props.formName : "";
        out.push({ id: n.id, type: n.type, label: text ? `${elementLabel(n.type)} · ${text.slice(0, 32)}` : elementLabel(n.type), pageId, pageName, sectionId, node: n });
        if (n.children) walk(n.children, sectionId);
      }
    };
    for (const s of sections) if (s.nodes) walk(s.nodes, s.id);
  };
  if (config.header.settings.topBar === true && config.header.settings.topBarMode === "custom") add("header", "Header (all pages)", [{ id: "header", nodes: config.header.nodes }]);
  if (config.header.settings.navMode === "custom") add("header-bar", "Navigation bar (all pages)", [{ id: "header-bar", nodes: config.header.barNodes }]);
  else if (config.header.settings.navElements === true) add("header-nav", "Navigation bar (all pages)", [{ id: "header-nav", nodes: config.header.navNodes }]);
  for (const p of config.pages) add(p.id, p.name, p.sections);
  for (const sp of SYSTEM_PAGE_REFS) add(sp.id, sp.name, config.systemPages?.[sp.kind] ?? []);
  return out;
}

/** Form field names inside a form element (for "order number from field" etc.). */
export function formFields(form: LayoutNode | undefined): string[] {
  const out: string[] = [];
  const walk = (n: LayoutNode) => {
    if (["input", "textarea", "select", "checkbox"].includes(n.type) && typeof n.props.name === "string") out.push(n.props.name);
    n.children?.forEach(walk);
  };
  if (form) walk(form);
  return out;
}

// ─── Summaries ─────────────────────────────────────────────────────────────

export function nodeName(nodes: NodeRef[], id: string | undefined) {
  if (!id || id === "pick-element") return "…choose an element";
  return nodes.find((n) => n.id === id)?.label ?? "(deleted element)";
}

export function triggerSummary(t: Trigger, nodes: NodeRef[], pages: { id: string; name: string }[]) {
  const page = (id: string) => pages.find((p) => p.id === id)?.name ?? "(deleted page)";
  switch (t.type) {
    case "click": return `When ${nodeName(nodes, t.nodeId)} is clicked`;
    case "submit": return `When ${nodeName(nodes, t.nodeId)} is submitted`;
    case "pageLoad": return `When ${page(t.pageId)} is loaded`;
    case "scroll": return `When ${page(t.pageId)} is scrolled past ${t.offset}px`;
  }
}

export function actionSummary(a: WorkflowAction, nodes: NodeRef[], products: { id: string; name: string }[]) {
  const label = ACTION_META[a.type]?.label ?? a.type;
  const order = "orderField" in a && a.orderField ? `order no. from field “${a.orderField}”` : "orderNumber" in a && a.orderNumber ? `order #${a.orderNumber}` : "…choose an order";
  switch (a.type) {
    case "goToPage": return `Go to ${a.to || "…"}`;
    case "openUrl": return `Open ${a.url}${a.newTab ? " (new tab)" : ""}`;
    case "scrollTo": return a.nodeId ? `Scroll to ${nodeName(nodes, a.nodeId)}` : "Scroll to top";
    case "show": case "hide": case "toggle": case "toggleState": return `${label.split(" ")[0]} ${nodeName(nodes, a.nodeId)}${a.type === "toggleState" ? " state" : ""}`;
    case "showMessage": return `Show “${a.text.slice(0, 40)}”`;
    case "wait": return `Wait ${(a.ms / 1000).toFixed(1)}s`;
    case "addToCart": return `Add ${a.quantity} × ${products.find((p) => p.id === a.productId)?.name ?? "…choose a product"}`;
    case "subscribe": return `Subscribe field “${a.field}”`;
    case "cancelOrder": return `Cancel ${order}`;
    case "setOrderStatus": return `Set ${order} to ${a.status.replace(/_/g, " ").toLowerCase()}`;
    case "deleteOrder": return `Delete ${order}`;
    default: return label;
  }
}

export function conditionSummary(c: Condition | Workflow["when"], nodes: NodeRef[]) {
  if (!c) return "Always";
  switch (c.type) {
    case "hover": return "When hovered";
    case "pressed": return "While pressed";
    case "focus": return "When a field inside is focused";
    case "clicked": return "After this is clicked (toggles)";
    case "state": return `When ${nodeName(nodes, c.nodeId)}'s state is on`;
    case "scrolled": return `When page is scrolled past ${c.offset}px`;
    case "width": return `When page width is ${c.min !== undefined ? `≥ ${c.min}px` : ""}${c.min !== undefined && c.max !== undefined ? " and " : ""}${c.max !== undefined ? `≤ ${c.max}px` : ""}${c.min === undefined && c.max === undefined ? "any" : ""}`;
  }
}

export function newWorkflow(trigger: Trigger, name: string): Workflow {
  return { id: newNodeId("wf"), name, trigger, actions: [] };
}
