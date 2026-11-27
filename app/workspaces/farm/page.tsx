import { createDemoMonitoringSource } from "@/lib/gadews/monitoring-demo";
import { createExampleTilapiaInput } from "@/lib/gadews/tilapia-assessment";
import { FarmDesk } from "./farm-desk";

export default async function FarmWorkspace() {
  const exampleTime = new Date("2026-10-29T12:00:00Z");
  const shrimp = await createDemoMonitoringSource({ now: () => exampleTime }).readLatest("demo-partial");
  const tilapia = createExampleTilapiaInput();
  return <FarmDesk shrimp={shrimp} tilapia={tilapia} />;
}
