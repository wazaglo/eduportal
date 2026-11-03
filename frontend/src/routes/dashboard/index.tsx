import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import {
  MessageSquareIcon,
  BookOpenIcon,
  DatabaseIcon,
  ArrowRightIcon,
  WandIcon,
  LightbulbIcon,
} from "lucide-qwik";
import { StatCard } from "~/components/molecules/StatCard";
import { Button } from "~/components/atoms/Button";
import { useQuestions } from "~/stores/question-store";

export default component$(() => {
  const questions = useQuestions();
  const recentQuestions = questions.state.questions.slice(0, 3);

  const quickActions = [
    {
      icon: MessageSquareIcon,
      label: "Ask a Question",
      description: "Get answers from the curriculum",
      href: "/dashboard/ask",
      color: "bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400",
    },
    {
      icon: BookOpenIcon,
      label: "View History",
      description: "Browse past questions and FAQs",
      href: "/dashboard/history",
      color: "bg-accent-50 text-accent-600 dark:bg-accent-700/20 dark:text-accent-400",
    },
    {
      icon: DatabaseIcon,
      label: "Knowledge Base",
      description: "Browse learning materials",
      href: "/dashboard/knowledge-base",
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    },
  ];

  return (
    <div class="space-y-6 max-w-7xl mx-auto">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p class="text-text-muted text-sm mt-1">Welcome back! Here's your activity overview.</p>
        </div>
        <Link href="/dashboard/ask">
          <Button variant="primary">
            <WandIcon class="h-4 w-4" />
            Ask a Question
          </Button>
        </Link>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Questions Asked"
          value={questions.state.total}
          icon={MessageSquareIcon}
          color="primary"
        />
        <StatCard
          title="Answered"
          value={questions.state.questions.filter((q) => q.status === "answered").length}
          icon={LightbulbIcon}
          color="success"
        />
        <StatCard
          title="KB Articles"
          value="108"
          icon={DatabaseIcon}
          color="info"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <div class="rounded-2xl border border-border bg-surface p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-text-primary">Recent Questions</h2>
              <Link
                href="/dashboard/history"
                class="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                View all
                <ArrowRightIcon class="h-4 w-4" />
              </Link>
            </div>
            <div class="space-y-3">
              {recentQuestions.length === 0 ? (
                <div class="text-center py-8">
                  <MessageSquareIcon class="h-8 w-8 text-text-muted mx-auto mb-2" />
                  <p class="text-sm text-text-muted">No questions yet</p>
                  <Link href="/dashboard/ask">
                    <Button variant="primary" size="sm" class="mt-3">
                      Ask your first question
                    </Button>
                  </Link>
                </div>
              ) : (
                recentQuestions.map((q) => (
                  <Link
                    key={q.questionId}
                    href={`/dashboard/ask/${q.questionId}`}
                    class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-secondary transition-colors group"
                  >
                    <div class="rounded-lg bg-surface-tertiary p-2 group-hover:bg-primary-50 dark:group-hover:bg-primary-950/40 transition-colors">
                      <MessageSquareIcon class="h-4 w-4 text-text-muted group-hover:text-primary-600 transition-colors" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-text-primary truncate">{q.question}</p>
                      <p class="text-xs text-text-muted truncate">
                        {q.subject ?? "General"} · {q.status}
                      </p>
                    </div>
                    <span class="text-xs text-text-muted">
                      {new Date(Date.parse(q.createdAt)).toLocaleDateString()}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div class="rounded-2xl border border-border bg-surface p-6">
            <h2 class="text-lg font-semibold text-text-primary mb-4">Quick Actions</h2>
            <div class="space-y-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-secondary transition-colors group"
                >
                  <div class={[`rounded-lg p-2`, action.color].join(" ")}>
                    <action.icon class="h-5 w-5" />
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-text-primary">{action.label}</p>
                    <p class="text-xs text-text-muted">{action.description}</p>
                  </div>
                  <ArrowRightIcon class="h-4 w-4 text-text-muted group-hover:text-primary-600 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
