/** Log activity from anywhere (V646): the + and Ctrl K ask the one entry in the shell to open. */
export const LOG_ACTIVITY_EVENT = 'log-activity:open';

export const openLogActivity = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LOG_ACTIVITY_EVENT));
};
