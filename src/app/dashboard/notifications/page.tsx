'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { NotificationsEmptyState } from '@/components/ui/empty-state';
import { Skeleton, NotificationSkeleton, ListSkeleton } from '@/components/ui/skeletons';

const typeConfig: Record<string, { className: string; label: string }> = {
  info: { className: 'bg-blue-100 text-blue-700', label: 'Info' },
  warning: { className: 'bg-amber-100 text-amber-700', label: 'Warning' },
  success: { className: 'bg-green-100 text-green-700', label: 'Success' },
  error: { className: 'bg-red-100 text-red-700', label: 'Error' },
};

export default function NotificationsPage() {
  const { data: notifications, isLoading, error } = useNotifications(true);
  const { mutate: markAsRead, isPending: isMarkingRead } = useMarkAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAllRead } = useMarkAllAsRead();

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        {/* Notifications skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-24" />
          <ListSkeleton count={4} ItemSkeleton={NotificationSkeleton} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-600">Failed to load notifications. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const unreadNotifications = notifications?.filter((n) => !n.read) || [];
  const readNotifications = notifications?.filter((n) => n.read) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Stay updated on your cases, documents, and deadlines
          </p>
        </div>
        {unreadNotifications.length > 0 && (
          <Button
            variant="outline"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllRead}
          >
            {isMarkingAllRead ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Mark all as read
          </Button>
        )}
      </div>

      {/* Unread Notifications */}
      {unreadNotifications.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Unread ({unreadNotifications.length})
          </h2>
          <div className="space-y-3">
            {unreadNotifications.map((notification) => {
              const typeInfo = typeConfig[notification.type] || typeConfig.system;
              return (
                <Card key={notification.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={typeInfo.className}>
                            {typeInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <h3 className="font-medium text-foreground">{notification.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        {notification.action_url && (
                          <Link
                            href={notification.action_url}
                            className="text-sm text-primary hover:underline mt-2 inline-block"
                          >
                            View details
                          </Link>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={isMarkingRead}
                        aria-label="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Read Notifications */}
      {readNotifications.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Earlier
          </h2>
          <div className="space-y-3">
            {readNotifications.map((notification) => {
              const typeInfo = typeConfig[notification.type] || typeConfig.system;
              return (
                <Card key={notification.id} className="opacity-70">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={typeInfo.className}>
                            {typeInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <h3 className="font-medium text-foreground/80">{notification.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        {notification.action_url && (
                          <Link
                            href={notification.action_url}
                            className="text-sm text-primary hover:underline mt-2 inline-block"
                          >
                            View details
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {notifications?.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <NotificationsEmptyState />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
