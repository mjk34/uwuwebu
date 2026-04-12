"use client";

import { useState } from "react";

type CounterProps = {
  initial: number;
  label?: string;
};

export default function Counter({ initial, label = "count" }: CounterProps) {
  const [count, setCount] = useState(initial);

  return (
    <button
      type="button"
      onClick={() => setCount((c) => c + 1)}
      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
    >
      {label}: {count}
    </button>
  );
}
