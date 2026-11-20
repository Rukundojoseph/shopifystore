"use client";

import { createContext } from "react";

/** Provided by the storefront workflow runtime; absent in the editor and previews. */
export type WorkflowRunApi = {
  /** Handles a form element's submit: runs its workflows, or saves the submission by default. */
  submit: (formNodeId: string, form: HTMLFormElement) => Promise<{ ok: boolean; message?: string }>;
};

export const WorkflowRunContext = createContext<WorkflowRunApi | null>(null);
