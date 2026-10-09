type WorkflowRun = {event?: string; status?: string; conclusion?: string | null; created_at?: string};
export function shouldRunScheduledRender(options: {eventName?: string; now?: Date | string; workflowRuns?: WorkflowRun[]}): {shouldRun: boolean; reason: string};
