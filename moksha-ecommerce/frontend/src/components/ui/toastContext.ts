import { createContext, use } from "react";

/**
 * The toast API and its hook, split from `<ToastProvider>` for the same reason
 * as the auth context: a module exporting both a component and a non-component
 * breaks Fast Refresh, so editing the provider would full-reload the page.
 */
export type ToastTone = "success" | "error" | "info";

export interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = use(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
