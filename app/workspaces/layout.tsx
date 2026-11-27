import type { ReactNode } from "react";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { PublicResources, WorkspaceNavigation } from "@/components/gadews/workspaces/workspace-navigation";
import styles from "@/components/gadews/workspaces/workspaces.module.css";

export default function WorkspacesLayout({ children }: {children: ReactNode}) {
  return <div className={styles.shell}>
    <StickyHeader />
    <WorkspaceNavigation />
    <main className={styles.content}>{children}</main>
    <PublicResources />
  </div>;
}
