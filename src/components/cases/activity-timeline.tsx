'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  FolderPlus,
  FileEdit,
  ArrowRightLeft,
  Upload,
  Brain,
  CheckCircle2,
  FilePlus,
  Bot,
  ClipboardCheck,
  Send,
} from 'lucide-react';
import { useActivities, type ActivityWithUser } from '@/hooks/use-activities';
import type { ActivityType } from '@/types';

const activityTypeConfig: Record<
  ActivityType,
  { icon: React.ElementType; color: string }
> = {
  case_created: { icon: FolderPlus, color: 'text-success bg-success/10' },
  case_updated: { icon: FileEdit, color: 'text-info bg-info/10' },
  status_changed: { icon: ArrowRightLeft, color: 'text-warning bg-warning/10' },
  document_uploaded: { icon: Upload, color: 'text-primary bg-primary/10' },
  document_analyzed: { icon: Brain, color: 'text-ai-accent bg-ai-accent-muted' },
  document_verified: { icon: CheckCircle2, color: 'text-success bg-success/10' },
  form_created: { icon: FilePlus, color: 'text-info bg-info/10' },
  form_ai_filled: { icon: Bot, color: 'text-ai-accent bg-ai-accent-muted' },
  form_reviewed: { icon: ClipboardCheck, color: 'text-success bg-success/10' },
  form_filed: { icon: Send, color: 'text-success bg-success/10' },
  note_added: { icon: FileEdit, color: 'text-muted-foreground bg-muted' },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ActivityItem({ activity }: { activity: ActivityWithUser }) {
  const config = activityTypeConfig[activity.activity_type] || {
    icon: FileEdit,
    color: 'text-muted-foreground bg-muted',
  };
  const Icon = config.icon;
  const userName = `${activity.user.first_name} ${activity.user.last_name}`.trim();

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`rounded-full p-2 ${config.color}`}>
          <Icon size={14} />
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={activity.user.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-muted">
              {activity.user.first_name?.charAt(0)}
              {activity.user.last_name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">{userName}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(activity.created_at)}</span>
        </div>
        <p className="text-sm text-muted-foreground">{activity.description}</p>
      </div>
    </div>
  );
}

export function ActivityTimeline({ caseId }: { caseId: string }) {
  const { data: activities, isLoading, error } = useActivities(caseId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-muted-foreground text-center py-8">Failed to load activities.</p>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-0">
            {activities.map((activity, index) => (
              <div key={activity.id}>
                {index === activities.length - 1 ? (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`rounded-full p-2 ${
                          (activityTypeConfig[activity.activity_type] || {
                            color: 'text-muted-foreground bg-muted',
                          }).color
                        }`}
                      >
                        {(() => {
                          const Icon = (activityTypeConfig[activity.activity_type] || {
                            icon: FileEdit,
                          }).icon;
                          return <Icon size={14} />;
                        })()}
                      </div>
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={activity.user.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted">
                            {activity.user.first_name?.charAt(0)}
                            {activity.user.last_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground">
                          {`${activity.user.first_name} ${activity.user.last_name}`.trim()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(activity.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    </div>
                  </div>
                ) : (
                  <ActivityItem activity={activity} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No activity recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
