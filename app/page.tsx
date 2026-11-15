import { listTasks } from "@/lib/task-api";
import type { Task } from "@/lib/task-api";
import { TaskBoard } from "./_components/task-board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tasks: Task[] | null;
  try {
    tasks = await listTasks();
  } catch {
    tasks = null;
  }
  return (
    <section className="section" aria-labelledby="tasks-title">
      <div className="section-head">
        <h1 id="tasks-title" className="section-title">
          Tasks
        </h1>
      </div>
      <TaskBoard initialTasks={tasks} />
    </section>
  );
}
