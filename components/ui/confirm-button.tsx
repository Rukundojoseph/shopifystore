"use client";
import type { ComponentProps } from "react";
import { Button } from "./index";

export function ConfirmButton({ message, ...props }: ComponentProps<typeof Button> & { message: string }) {
  return <Button {...props} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }} />;
}
