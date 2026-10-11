"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

export function TrackedDownloadLink({
  href,
  resource,
  className,
  children,
}: {
  href: string;
  resource: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      download
      className={className}
      onClick={() => track("resource_download_clicked", { resource })}
    >
      {children}
    </a>
  );
}
