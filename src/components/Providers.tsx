"use client";

import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [/* queryClient */] = useState(() => null);
  useTheme();
  return <>{children}</>;
}
