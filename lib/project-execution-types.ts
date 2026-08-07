export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';

export type TaskStatus = 
  | 'Pending'    // 0%
  | 'In Progress' // 30%
  | 'Review'     // 90%
  | 'Completed'  // 100%
  | 'Blocked'
  | 'Paused'
  | 'Cancelled';

export type WorkLogStatus = 'Pending' | 'Approved' | 'Changes Requested' | 'Rejected';

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked' | 'Paused';
  order_index: number;
  created_at?: string;
}

export interface TaskItem {
  id: string;
  project_id: string;
  milestone_id?: string;
  milestone_title?: string;
  title: string;
  description?: string;
  assigned_to: string; // Comma-separated employee names e.g. "Hemanth Anala,Maheswar Saranam"
  assigned_employee_id?: string;
  due_date?: string;
  priority: PriorityLevel;
  estimated_hours: number;
  logged_hours: number;
  status: TaskStatus;
  progress: number; // 0-100
  external_integration_id?: string; // GitHub PR / Jira ID
  metadata?: Record<string, any>; // Commits, PR link, branch
  created_at?: string;
  updated_at?: string;
}

/** Parse comma-separated assigned_to into a clean array */
export function parseAssignees(assigned_to: string): string[] {
  if (!assigned_to) return [];
  return assigned_to.split(',').map(s => s.trim()).filter(Boolean);
}

/** Check if a given employee name is in the task's assignee list */
export function isAssignedTo(task: TaskItem, employeeName: string): boolean {
  const assignees = parseAssignees(task.assigned_to);
  return assignees.some(a => a.toLowerCase() === employeeName.toLowerCase());
}

export interface Attachment {
  id?: string;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'zip' | 'video' | 'drive' | 'github' | 'document' | 'other';
  size?: string;
}

export interface WorkLog {
  id: string;
  project_id: string;
  project_title?: string;
  milestone_id?: string;
  milestone_title?: string;
  task_id: string;
  task_title?: string;
  employee_id?: string;
  employee_name: string;
  work_completed: string;
  progress_before: number;
  progress_after: number;
  hours_spent: number;
  hourly_rate: number;
  calculated_cost: number; // hours_spent * hourly_rate
  files_modified: string[];
  blockers?: string;
  attachments?: Attachment[];
  status: WorkLogStatus;
  reviewer_feedback?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  metadata?: Record<string, any>; // Commit details, AI summary
}

export interface ActivityTimelineItem {
  id: string;
  project_id: string;
  task_id?: string;
  task_title?: string;
  user_name: string;
  action: string;
  notes?: string;
  timestamp_text?: string;
  created_at: string;
}

export interface EmployeeProductivityStats {
  employee_name: string;
  assigned_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  work_logs_submitted: number;
  work_logs_approved: number;
  work_logs_rejected: number;
  avg_progress_per_day: number;
  total_logged_hours: number;
  total_cost_generated: number;
  hourly_rate: number;
}

export interface ProjectAnalytics {
  budget: number;
  internal_cost: number;
  remaining_budget: number;
  profitability_margin: number; // percentage
  estimated_hours: number;
  logged_hours: number;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  blocked_tasks: number;
  total_milestones: number;
  completed_milestones: number;
  overall_completion_pct: number;
}

export interface ProjectNotificationItem {
  id: string;
  recipient_role: 'employee' | 'manager' | 'founder';
  recipient_id?: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'due_soon' | 'work_log_submitted' | 'work_log_approved' | 'work_log_rejected' | 'project_delayed' | 'budget_exceeded';
  project_id?: string;
  task_id?: string;
  work_log_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface ProjectAnnouncement {
  id: string;
  project_id: string;
  title: string;
  content: string;
  created_by: string;
  visibility: 'Published to Client' | 'Internal Only';
  created_at: string;
}

// ── Default Employee Rates Mapping ──
export const DEFAULT_EMPLOYEE_RATES: Record<string, { rate: number; role: string }> = {
  Rahul: { rate: 500, role: 'Software Engineer' },
  Priya: { rate: 650, role: 'UI/UX Designer' },
  Anil: { rate: 450, role: 'Backend Developer' },
  Sneha: { rate: 550, role: 'QA Lead' },
  Vikram: { rate: 700, role: 'Fullstack Architect' }
};

// ── Calculation Utilities ──
export function calculateProjectProgress(tasks: TaskItem[], milestones: Milestone[]): number {
  if (tasks.length === 0 && milestones.length === 0) return 0;
  
  // Calculate task based completion percentage
  let taskProgressSum = 0;
  if (tasks.length > 0) {
    taskProgressSum = tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length;
  }
  
  // Calculate milestone based completion percentage
  let milestoneProgressSum = 0;
  if (milestones.length > 0) {
    const completedM = milestones.filter(m => m.status === 'Completed').length;
    milestoneProgressSum = (completedM / milestones.length) * 100;
  }
  
  if (tasks.length > 0 && milestones.length > 0) {
    return Math.round(taskProgressSum * 0.7 + milestoneProgressSum * 0.3);
  } else if (tasks.length > 0) {
    return Math.round(taskProgressSum);
  } else {
    return Math.round(milestoneProgressSum);
  }
}

export function calculateProjectAnalytics(
  budget: number,
  tasks: TaskItem[],
  milestones: Milestone[],
  approvedLogs: WorkLog[]
): ProjectAnalytics {
  const internal_cost = approvedLogs.reduce((sum, log) => sum + (log.calculated_cost || (log.hours_spent * (log.hourly_rate || 500))), 0);
  const remaining_budget = Math.max(0, budget - internal_cost);
  const profitability_margin = budget > 0 ? Math.round(((budget - internal_cost) / budget) * 100) : 0;
  
  const estimated_hours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const logged_hours = approvedLogs.reduce((sum, l) => sum + (l.hours_spent || 0), 0);
  
  const completed_tasks = tasks.filter(t => t.status === 'Completed' || t.progress >= 100).length;
  const pending_tasks = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress' || t.status === 'Review').length;
  const blocked_tasks = tasks.filter(t => t.status === 'Blocked').length;
  
  const completed_milestones = milestones.filter(m => m.status === 'Completed').length;
  const overall_completion_pct = calculateProjectProgress(tasks, milestones);

  return {
    budget,
    internal_cost,
    remaining_budget,
    profitability_margin,
    estimated_hours,
    logged_hours,
    total_tasks: tasks.length,
    completed_tasks,
    pending_tasks,
    blocked_tasks,
    total_milestones: milestones.length,
    completed_milestones,
    overall_completion_pct
  };
}

// Empty execution data structure template
export const MOCK_EXECUTION_DATA = {
  milestones: [] as Milestone[],
  tasks: [] as TaskItem[],
  workLogs: [] as WorkLog[],
  timeline: [] as ActivityTimelineItem[],
  announcements: [] as ProjectAnnouncement[],
  notifications: [] as ProjectNotificationItem[]
};
