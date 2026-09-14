import { AppShell } from "@/components/AppShell";
import ui from "@/styles/studio.module.scss";
import styles from "./placeholder.module.scss";

export default function WorkflowsPage() {
  return (
    <AppShell>
      <div className={ui.page}>
        <header className={ui.header}>
          <div>
            <span className={ui.eyebrow}>REPEATABLE WORK</span>
            <h1 className={ui.title}>工作流</h1>
          </div>
        </header>
        <section className={styles.placeholder} aria-label="工作流敬请期待">
          <span>WORKFLOW STUDIO</span>
          <h2>敬请期待</h2>
        </section>
      </div>
    </AppShell>
  );
}
