// The Tasks LIST's loading frame (owner, 13 Nov). In its own route group so it wraps the list alone: a task's record
// page (tasks/[number]) answers a real 404 for a task that does not exist (W32), which a frame over it would turn into 200.
export { PageLoading as default } from '@/ui/shell/PageLoading';
