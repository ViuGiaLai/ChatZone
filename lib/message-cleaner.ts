import { supabase } from "@/lib/db";

export async function deleteExpiredMessages() {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const { data: oldMessages, error } = await supabase
    .from('messages')
    .select('id')
    .lt('timestamp', oneWeekAgo);

  if (error) {
    console.error('Error fetching old messages:', error);
    return;
  }

  if (!oldMessages || oldMessages.length === 0) {
    console.log('No expired messages to clean up.');
    return;
  }

  const ids = oldMessages.map(m => m.id);
  const { error: deleteError } = await supabase
    .from('messages')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.error('Error deleting old messages:', deleteError);
    return;
  }

  console.log(`Đã xoá ${ids.length} tin nhắn cũ hơn 1 tuần`);
}
