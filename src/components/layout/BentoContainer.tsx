import type { ReactNode } from "react";

type Props = { children: ReactNode; className?: string };

export default function BentoContainer({ children, className = "" }: Props) {
  return <div className={`grid h-full grid-cols-12 gap-4 overflow-y-auto p-4 ${className}`}>{children}</div>;
}
