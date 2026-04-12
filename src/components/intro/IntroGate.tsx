"use client";

import { useState } from "react";
import LiquefiedIntro from "./LiquefiedIntro";

export default function IntroGate() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <LiquefiedIntro onFinish={() => setDismissed(true)} />;
}
