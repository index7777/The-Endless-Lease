import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { uiCssVariables } from "./tokens";
import "./design-system.css";

const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(" ");
type BoxProps = HTMLAttributes<HTMLElement> & { children?: ReactNode };

export function DesignSystemRoot({ className, style, ...props }: BoxProps) {
  return <section className={classes("ui-design-root", className)} style={{ ...uiCssVariables, ...style }} {...props} />;
}
export function PaperPanel({ className, ...props }: BoxProps) { return <article className={classes("ui-paper-panel", className)} {...props} />; }
export function MetalFrame({ className, ...props }: BoxProps) { return <section className={classes("ui-metal-frame", className)} {...props} />; }
export function ArchiveCard({ className, ...props }: BoxProps) { return <article className={classes("ui-archive-card", className)} {...props} />; }
export function ManagementButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type={type} className={classes("ui-management-button", className)} {...props} />; }
export function ProgressHeader({ className, ...props }: BoxProps) { return <nav aria-label="建檔流程" className={classes("ui-progress-header", className)} {...props} />; }
export function LeaseStamp({ className, ...props }: BoxProps) { return <span className={classes("ui-lease-stamp", className)} {...props} />; }
export function AdministrativeDivider({ className, ...props }: BoxProps) { return <div aria-hidden="true" className={classes("ui-administrative-divider", className)} {...props} />; }
export function StatusLedger({ className, ...props }: BoxProps) { return <dl className={classes("ui-status-ledger", className)} {...props} />; }
export function ObjectiveNote({ className, ...props }: BoxProps) { return <aside className={classes("ui-objective-note", className)} {...props} />; }
export function DialogNotice({ className, ...props }: BoxProps) { return <aside role="status" className={classes("ui-dialog-notice", className)} {...props} />; }
