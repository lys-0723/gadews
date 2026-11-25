"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";

// Copied into a disposable checkout for browser checks; never a product route.
export default function CalendarCheck() {
  const [single, setSingle] = useState<Date>();
  const [range, setRange] = useState<DateRange>();
  return (
    <main className="flex flex-wrap gap-6 bg-white p-3 text-slate-950">
      <section data-c01="single" className="w-max">
        <h1>Single date</h1>
        <Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} selected={single} onSelect={setSingle} />
        <output>{single?.getDate() ?? "No date"}</output>
      </section>
      <section data-c01="range" className="w-max">
        <h1>Date range</h1>
        <Calendar mode="range" defaultMonth={new Date(2026, 9, 1)} selected={range} onSelect={setRange} />
        <output>{range?.from?.getDate() ?? "None"} - {range?.to?.getDate() ?? "None"}</output>
      </section>
    </main>
  );
}
