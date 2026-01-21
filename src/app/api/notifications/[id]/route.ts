import { NextRequest, NextResponse } from 'next/server';
import { notificationsService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateNotificationSchema = z.object({
  read: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ownership check: verify notification belongs to current user
    const { data: notification } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    if (notification.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only modify your own notifications' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { read } = updateNotificationSchema.parse(body);

    if (read) {
      await notificationsService.markAsRead(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ownership check: verify notification belongs to current user
    const { data: notification } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    if (notification.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own notifications' },
        { status: 403 }
      );
    }

    await notificationsService.deleteNotification(id);

    return NextResponse.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
