'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CheckCircle2, Clock, AlertTriangle, FileText, Send, User, Calendar,
  TrendingUp, Shield, ShieldCheck, ShieldAlert, Paperclip, Plus, Edit,
  Trash2, Eye, Filter, Check, X, ArrowRight, ExternalLink, Activity,
  DollarSign, Sparkles, MessageSquare, Bell, Layers, CheckSquare, RefreshCw,
  GitBranch, GitPullRequest, Laptop, Users, ChevronRight, Lock
} from 'lucide-react';
import {
  Milestone, TaskItem, WorkLog, ActivityTimelineItem, EmployeeProductivityStats,
  ProjectAnalytics, ProjectAnnouncement, ProjectNotificationItem, PriorityLevel, TaskStatus,
  DEFAULT_EMPLOYEE_RATES, calculateProjectAnalytics, calculateProjectProgress,
  parseAssignees, isAssignedTo
} from '@/lib/project-execution-types';

// ── COLOR CONSTANTS ──
const priorityColors: Record<PriorityLevel, string> = {
  Low: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  Medium: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  High: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Urgent: 'text-red-400 bg-red-500/10 border-red-500/20'
};

const taskStatusColors: Record<TaskStatus, string> = {
  Pending: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  'In Progress': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Review: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Blocked: 'text-red-400 bg-red-500/10 border-red-500/20',
  Paused: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Cancelled: 'text-gray-500 bg-gray-500/10 border-gray-500/20'
};

// ── 1. EMPLOYEE DASHBOARD VIEW ──
interface EmployeeDashboardProps {
  currentEmployee: string;
  tasks: TaskItem[];
  milestones: Milestone[];
  workLogs: WorkLog[];
  onSubmitWorkLog: (task: TaskItem) => void;
}

export function EmployeeDashboardView({
  currentEmployee,
  tasks,
  milestones,
  workLogs,
  onSubmitWorkLog
}: EmployeeDashboardProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'today' | 'upcoming' | 'completed' | 'history'>('my');

  // Filter employee tasks — supports both single and comma-separated multi-assignee format
  const myTasks = tasks.filter(t => isAssignedTo(t, currentEmployee));
  const todayTasks = myTasks.filter(t => t.status === 'In Progress' || t.status === 'Review');
  const upcomingTasks = myTasks.filter(t => t.status === 'Pending');
  const completedTasks = myTasks.filter(t => t.status === 'Completed');
  const myLogs = workLogs.filter(w => w.employee_name.toLowerCase() === currentEmployee.toLowerCase());

  const getFilteredList = () => {
    switch (activeTab) {
      case 'today': return todayTasks;
      case 'upcoming': return upcomingTasks;
      case 'completed': return completedTasks;
      default: return myTasks;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#11241c] via-[#1a382c] to-[#11241c] p-4 rounded-xl border border-gold/30 flex flex-wrap justify-between items-center gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gold/20 border border-gold flex items-center justify-center text-gold font-bold text-lg">
            {currentEmployee.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">{currentEmployee}'s Productivity Workspace</h3>
              <Badge className="bg-gold/10 text-gold border-gold/30 text-[10px]">Deliverable Mode</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Focus on completed deliverables, progress updates, and approved work logs.</p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-lg border border-border text-xs font-mono">
          <div><span className="text-muted-foreground">Assigned:</span> <span className="text-gold font-bold">{myTasks.length}</span></div>
          <div className="h-3 w-px bg-border" />
          <div><span className="text-muted-foreground">In Progress:</span> <span className="text-blue-400 font-bold">{todayTasks.length}</span></div>
          <div className="h-3 w-px bg-border" />
          <div><span className="text-muted-foreground">Done:</span> <span className="text-emerald-400 font-bold">{completedTasks.length}</span></div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex gap-1.5 bg-black/30 p-1 rounded-lg border border-border text-xs">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'my' ? 'bg-gold text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            My Tasks ({myTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'today' ? 'bg-gold text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Today's Focus ({todayTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'upcoming' ? 'bg-gold text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Upcoming ({upcomingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'completed' ? 'bg-gold text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Completed ({completedTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'history' ? 'bg-gold text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            My Work Logs ({myLogs.length})
          </button>
        </div>
      </div>

      {/* Main List */}
      {activeTab === 'history' ? (
        <div className="space-y-3">
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/20">
                    <th className="text-left py-2.5 px-3 font-semibold">Date & Time</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Task</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Work Completed</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Progress Delta</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Time Spent</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myLogs.map(log => (
                    <tr key={log.id} className="border-b border-border hover:bg-[#11241c]/20">
                      <td className="py-2.5 px-3 text-muted-foreground">{new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">{log.task_title || 'Task'}</td>
                      <td className="py-2.5 px-3">
                        <p className="text-foreground max-w-xs">{log.work_completed}</p>
                        {log.files_modified && log.files_modified.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {log.files_modified.map((f, i) => (
                              <span key={i} className="text-[9px] bg-black/40 border border-border px-1.5 py-0.5 rounded text-gold font-mono">{f}</span>
                            ))}
                          </div>
                        )}
                        {log.blockers && (
                          <p className="text-[10px] text-amber-400 mt-1 italic flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> Blocker: {log.blockers}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-gold">
                        {log.progress_before}% → {log.progress_after}%
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-semibold">{log.hours_spent} hrs</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full capitalize border ${log.status === 'Approved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : log.status === 'Rejected' ? 'text-red-400 bg-red-500/10 border-red-500/20' : log.status === 'Changes Requested' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-purple-400 bg-purple-500/10 border-purple-500/20'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {myLogs.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground italic">No work logs submitted yet. Click "Submit Work" on any task to log your work.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getFilteredList().map(task => (
            <Card key={task.id} className="bg-card border-border hover:border-gold/30 transition-all duration-200 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-gold font-semibold uppercase tracking-wider">{task.milestone_title || 'Frontend Development'}</span>
                    <h4 className="text-sm font-bold text-foreground mt-0.5">{task.title}</h4>
                  </div>
                  <Badge className={`text-[10px] capitalize ${taskStatusColors[task.status]}`}>
                    {task.status}
                  </Badge>
                </div>

                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>Progress</span>
                    <span className="text-gold font-bold">{task.progress}%</span>
                  </div>
                  <Progress value={task.progress} className="h-1.5 bg-black/40" />
                </div>

                {/* Task Metadata */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                  <div>
                    <span className="block text-[9px] uppercase">Due Date</span>
                    <span className="font-medium text-foreground flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3 text-gold" />{task.due_date ? formatDate(task.due_date) : '15 July'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase">Est. Hours</span>
                    <span className="font-medium text-foreground flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3 text-gold" />{task.estimated_hours} Hours</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase">Priority</span>
                    <Badge className={`text-[9px] py-0 px-1.5 mt-0.5 ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex justify-end">
                  <Button
                    variant="gold"
                    size="sm"
                    className="h-8 text-xs font-bold gap-1.5 px-4"
                    onClick={() => onSubmitWorkLog(task)}
                  >
                    <Send className="h-3.5 w-3.5" /> Submit Work Log
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {getFilteredList().length === 0 && (
            <div className="md:col-span-2 text-center py-12 border border-dashed border-border rounded-xl bg-card/40">
              <CheckCircle2 className="h-8 w-8 text-gold mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No tasks found in this section</p>
              <p className="text-xs text-muted-foreground mt-1">Select another tab to view your assigned deliverables.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 2. WORK LOG SUBMISSION DRAWER / DIALOG ──
interface WorkLogSubmissionProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (logData: Partial<WorkLog>) => void;
}

export function WorkLogSubmissionDrawer({
  task,
  isOpen,
  onClose,
  onSubmit
}: WorkLogSubmissionProps) {
  const [workCompleted, setWorkCompleted] = useState('');
  const [progressAfter, setProgressAfter] = useState<number>(task ? Math.min(100, task.progress + 25) : 50);
  const [hoursSpent, setHoursSpent] = useState<string>('4');
  const [filesModifiedStr, setFilesModifiedStr] = useState('');
  const [blockers, setBlockers] = useState('');
  const [attachmentLink, setAttachmentLink] = useState('');

  React.useEffect(() => {
    if (task) {
      setProgressAfter(Math.min(100, task.progress + 25));
    }
  }, [task]);

  if (!task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCompleted.trim()) return;

    const filesArray = filesModifiedStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const attachmentsList = attachmentLink.trim() ? [
      { name: attachmentLink.split('/').pop() || 'Attachment', url: attachmentLink, type: 'drive' as const }
    ] : [];

    onSubmit({
      task_id: task.id,
      task_title: task.title,
      milestone_id: task.milestone_id,
      milestone_title: task.milestone_title || 'Frontend Development',
      employee_name: task.assigned_to,
      work_completed: workCompleted,
      progress_before: task.progress,
      progress_after: progressAfter,
      hours_spent: parseFloat(hoursSpent) || 0,
      hourly_rate: DEFAULT_EMPLOYEE_RATES[task.assigned_to]?.rate || 500,
      calculated_cost: (parseFloat(hoursSpent) || 0) * (DEFAULT_EMPLOYEE_RATES[task.assigned_to]?.rate || 500),
      files_modified: filesArray.length > 0 ? filesArray : ['Invoice.tsx', 'InvoiceTable.tsx', 'InvoiceService.ts'],
      blockers: blockers.trim() || undefined,
      attachments: attachmentsList
    });

    // Reset form
    setWorkCompleted('');
    setFilesModifiedStr('');
    setBlockers('');
    setAttachmentLink('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-gold">
            <Send className="h-4 w-4" />
            Submit Work Log for "{task.title}"
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs pt-2">
          {/* Readonly Summary Card */}
          <div className="bg-black/30 p-3 rounded-lg border border-border space-y-1 font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">Project:</span> <span className="text-foreground font-semibold">Netgain Business OS ERP</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Milestone:</span> <span className="text-foreground">{task.milestone_title || 'Frontend Development'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Current Task Progress:</span> <span className="text-gold font-bold">{task.progress}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estimated Hours:</span> <span className="text-foreground">{task.estimated_hours} Hours</span></div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Today's Work Completed *</Label>
            <Textarea
              placeholder="Describe actual work finished (e.g. Completed responsive invoice table, added GST calculations, implemented PDF download button)..."
              value={workCompleted}
              onChange={e => setWorkCompleted(e.target.value)}
              required
              className="h-24 text-xs bg-muted/20 border-border"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Progress After (%)</Label>
              <Input
                type="number"
                min={task.progress}
                max={100}
                value={progressAfter}
                onChange={e => setProgressAfter(Number(e.target.value))}
                className="h-8 text-xs bg-muted/20 border-border font-mono font-bold text-gold"
              />
              <p className="text-[10px] text-muted-foreground">Progress Before: {task.progress}%</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Time Spent Today (Hours) *</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={hoursSpent}
                onChange={e => setHoursSpent(e.target.value)}
                required
                className="h-8 text-xs bg-muted/20 border-border font-mono"
              />
              <p className="text-[10px] text-muted-foreground">No start/stop timer required</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Files Modified (Comma separated)</Label>
            <Input
              placeholder="e.g. Invoice.tsx, InvoiceTable.tsx, InvoiceService.ts"
              value={filesModifiedStr}
              onChange={e => setFilesModifiedStr(e.target.value)}
              className="h-8 text-xs bg-muted/20 border-border font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Blockers / Dependencies (Optional)</Label>
            <Input
              placeholder="e.g. Waiting for Razorpay Live API approval."
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              className="h-8 text-xs bg-muted/20 border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Attachment Link / Drive / GitHub PR (Optional)</Label>
            <Input
              placeholder="https://drive.google.com/... or https://github.com/..."
              value={attachmentLink}
              onChange={e => setAttachmentLink(e.target.value)}
              className="h-8 text-xs bg-muted/20 border-border"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button variant="gold" size="sm" type="submit" className="h-8 text-xs font-bold px-6">
              Submit Work Log for Approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── 3. MANAGER APPROVALS QUEUE ──
interface ManagerApprovalsProps {
  workLogs: WorkLog[];
  onApprove: (logId: string) => void;
  onRequestChanges: (logId: string, feedback: string) => void;
  onReject: (logId: string) => void;
}

export function ManagerApprovalsQueue({
  workLogs,
  onApprove,
  onRequestChanges,
  onReject
}: ManagerApprovalsProps) {
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [feedback, setFeedback] = useState('');
  const { toast } = useToast();

  const pendingLogs = workLogs.filter(w => w.status === 'Pending');
  const reviewedLogs = workLogs.filter(w => w.status !== 'Pending');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-[#11241c] to-black p-4 rounded-xl border border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Manager Work Log Approvals Queue</h3>
            <p className="text-xs text-muted-foreground">Task progress and project analytics update ONLY after explicit approval.</p>
          </div>
        </div>
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs px-3 py-1 font-bold">
          {pendingLogs.length} Pending Review
        </Badge>
      </div>

      {/* Pending Work Logs Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-gold uppercase tracking-wider">Work Logs Awaiting Approval</h4>
        
        <div className="grid grid-cols-1 gap-3">
          {pendingLogs.map(log => (
            <Card key={log.id} className="bg-card border-gold/40 shadow-lg">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gold/10 text-gold border-gold/30 text-[10px]">{log.employee_name}</Badge>
                    <span className="text-xs font-bold text-foreground">{log.task_title || 'Task'}</span>
                    <span className="text-[10px] text-muted-foreground">· {log.milestone_title || 'Frontend'}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Submitted {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-xs space-y-2">
                  <div className="bg-black/30 p-2.5 rounded border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Work Completed</span>
                    <p className="text-foreground font-medium mt-0.5">{log.work_completed}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="bg-muted/20 p-2 rounded">
                      <span className="text-[9px] text-muted-foreground uppercase block">Progress Impact</span>
                      <span className="text-gold font-bold">{log.progress_before}% → {log.progress_after}%</span>
                    </div>
                    <div className="bg-muted/20 p-2 rounded">
                      <span className="text-[9px] text-muted-foreground uppercase block">Logged Time</span>
                      <span className="text-foreground font-bold">{log.hours_spent} Hours</span>
                    </div>
                    <div className="bg-muted/20 p-2 rounded">
                      <span className="text-[9px] text-muted-foreground uppercase block">Hourly Rate</span>
                      <span className="text-foreground font-bold">{formatCurrency(log.hourly_rate)}/hr</span>
                    </div>
                    <div className="bg-muted/20 p-2 rounded">
                      <span className="text-[9px] text-muted-foreground uppercase block">Calculated Cost</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(log.calculated_cost)}</span>
                    </div>
                  </div>

                  {log.files_modified && log.files_modified.length > 0 && (
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Files Modified: </span>
                      <span className="font-mono text-gold">{log.files_modified.join(', ')}</span>
                    </div>
                  )}

                  {log.blockers && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>Blocker:</strong> {log.blockers}</span>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-red-400 border-red-500/20 hover:bg-red-500/10"
                    onClick={() => {
                      onReject(log.id);
                      toast({ title: 'Work log rejected' });
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-amber-400 border-amber-500/20 hover:bg-amber-500/10"
                    onClick={() => setSelectedLog(log)}
                  >
                    Request Changes
                  </Button>
                  <Button
                    variant="gold"
                    size="sm"
                    className="h-8 text-xs font-bold px-5 gap-1"
                    onClick={() => {
                      onApprove(log.id);
                      toast({ title: '✅ Work Log Approved!', description: `Task progress updated to ${log.progress_after}%. Internal cost added.` });
                    }}
                  >
                    <Check className="h-4 w-4" /> Approve Deliverable
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {pendingLogs.length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-xl bg-card/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-foreground">All work logs reviewed!</p>
              <p className="text-xs text-muted-foreground">New submitted work logs from employees will appear here for manager sign-off.</p>
            </div>
          )}
        </div>
      </div>

      {/* Reviewed History Section */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recently Reviewed Logs</h4>
        
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[750px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/20">
                  <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[130px]">Employee</th>
                  <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[150px]">Task</th>
                  <th className="text-left py-2.5 px-3 font-semibold min-w-[200px]">Work Summary</th>
                  <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[140px]">Hours & Cost</th>
                  <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[120px]">Reviewer</th>
                  <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[110px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {reviewedLogs.map(log => (
                  <tr key={log.id} className="border-b border-border hover:bg-[#11241c]/20">
                    <td className="py-2.5 px-3 font-semibold text-gold">{log.employee_name}</td>
                    <td className="py-2.5 px-3 font-semibold text-foreground">{log.task_title}</td>
                    <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">{log.work_completed}</td>
                    <td className="py-2.5 px-3 font-mono">
                      <span>{log.hours_spent} hrs</span> · <span className="text-emerald-400 font-bold">{formatCurrency(log.calculated_cost)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{log.reviewed_by || 'Admin Manager'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${log.status === 'Approved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Request Changes Modal */}
      <Dialog open={!!selectedLog} onOpenChange={open => { if (!open) setSelectedLog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-gold">Request Changes for {selectedLog?.employee_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs py-2">
            <p className="text-muted-foreground">Provide clear feedback on what needs to be revised before approval:</p>
            <Textarea
              placeholder="e.g. Please upload unit tests or fix GST percentage calculation for B2B invoices..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              className="h-20 text-xs bg-muted/20 border-border"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>Cancel</Button>
            <Button
              variant="gold"
              size="sm"
              onClick={() => {
                if (selectedLog) {
                  onRequestChanges(selectedLog.id, feedback);
                  setSelectedLog(null);
                  setFeedback('');
                  toast({ title: 'Requested changes sent to employee' });
                }
              }}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 4. MILESTONE & TASK TREE VIEW ──
interface MilestonesTaskTreeProps {
  milestones: Milestone[];
  tasks: TaskItem[];
  teamMembers?: any[];
  onAddTask: (task: Partial<TaskItem>) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus, newProgress: number) => void;
}

export function MilestonesTaskTree({
  milestones,
  tasks,
  teamMembers = [],
  onAddTask,
  onUpdateTaskStatus
}: MilestonesTaskTreeProps) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [milestoneId, setMilestoneId] = useState(milestones[0]?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [estHours, setEstHours] = useState('18');

  const toggleAssignee = (name: string) => {
    setSelectedAssignees(prev =>
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const selectedM = milestones.find(m => m.id === milestoneId);
    const finalAssignee = selectedAssignees.length > 0
      ? selectedAssignees.join(',')
      : (teamMembers[0]?.name || 'Unassigned');

    onAddTask({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      assigned_to: finalAssignee,
      milestone_id: milestoneId,
      milestone_title: selectedM?.title || 'Frontend Development',
      due_date: dueDate || new Date().toISOString().slice(0, 10),
      priority,
      estimated_hours: parseFloat(estHours) || 16,
      logged_hours: 0,
      status: 'Pending',
      progress: 0
    });

    setTaskTitle('');
    setTaskDesc('');
    setSelectedAssignees([]);
    setShowAddTask(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Project Milestones & Task Breakdown</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">Hierarchical execution map: Project → Milestones → Tasks → Assignees</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setShowAddTask(true)} className="h-8 text-xs font-bold gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>

      {/* Milestones List */}
      <div className="space-y-4">
        {milestones.map(m => {
          const milestoneTasks = tasks.filter(t => t.milestone_id === m.id || (!t.milestone_id && m.order_index === 2));
          const completedMTasks = milestoneTasks.filter(t => t.status === 'Completed').length;
          const milestoneProgress = milestoneTasks.length > 0 ? Math.round((completedMTasks / milestoneTasks.length) * 100) : m.status === 'Completed' ? 100 : 0;

          return (
            <div key={m.id} className="border border-border rounded-xl bg-card overflow-hidden">
              {/* Milestone Banner */}
              <div className="p-3.5 bg-black/40 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`h-7 w-7 rounded-lg border flex items-center justify-center text-xs font-bold ${m.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-gold/10 text-gold border-gold/30'}`}>
                    {m.order_index}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{m.title}</h4>
                    {m.description && <p className="text-[10px] text-muted-foreground">{m.description}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-32 space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Milestone Progress</span>
                      <span className="text-gold font-bold">{milestoneProgress}%</span>
                    </div>
                    <Progress value={milestoneProgress} className="h-1.5 bg-black/50" />
                  </div>
                  <Badge className={`text-[10px] ${m.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gold/10 text-gold border-gold/30'}`}>
                    {m.status}
                  </Badge>
                </div>
              </div>

              {/* Tasks List inside Milestone */}
              <div className="p-3 space-y-2">
                {milestoneTasks.map(t => (
                  <div key={t.id} className="p-3 rounded-lg bg-black/20 border border-border hover:border-gold/30 transition-colors flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{t.title}</span>
                        <Badge className={`text-[9px] py-0 px-1.5 ${priorityColors[t.priority]}`}>{t.priority}</Badge>
                      </div>
                      {t.description && <p className="text-[11px] text-muted-foreground truncate">{t.description}</p>}
                    </div>

                    {/* Metadata Items */}
                    <div className="flex items-center gap-4 text-[11px] font-mono">
                      <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                        <User className="h-3 w-3 text-gold shrink-0" />
                        {parseAssignees(t.assigned_to).map((name, i) => (
                          <span key={i} className="text-foreground font-medium bg-gold/10 border border-gold/20 rounded px-1 py-0.5 text-[10px]">{name}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3 w-3 text-gold" />
                        <span>{t.due_date ? formatDate(t.due_date) : '15 July'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3 text-gold" />
                        <span>{t.estimated_hours} hrs</span>
                      </div>

                      {/* Status Dropdown */}
                      <Select
                        value={t.status}
                        onValueChange={(val: TaskStatus) => {
                          const progMap: Record<TaskStatus, number> = {
                            Pending: 0,
                            'In Progress': 30,
                            Review: 90,
                            Completed: 100,
                            Blocked: t.progress,
                            Paused: t.progress,
                            Cancelled: t.progress
                          };
                          onUpdateTaskStatus(t.id, val, progMap[val]);
                        }}
                      >
                        <SelectTrigger className={`h-7 w-28 text-[10px] font-semibold border ${taskStatusColors[t.status]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending" className="text-[11px]">Pending (0%)</SelectItem>
                          <SelectItem value="In Progress" className="text-[11px]">In Progress (30%)</SelectItem>
                          <SelectItem value="Review" className="text-[11px]">Review (90%)</SelectItem>
                          <SelectItem value="Completed" className="text-[11px]">Completed (100%)</SelectItem>
                          <SelectItem value="Blocked" className="text-[11px]">Blocked</SelectItem>
                          <SelectItem value="Paused" className="text-[11px]">Paused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                {milestoneTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">No tasks created under this milestone yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-gold">Create New Task & Assign Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <Label>Task Title *</Label>
              <Input placeholder="e.g. Invoice Module" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea placeholder="Implement Invoice Creation, PDF Export, Razorpay Integration" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="h-16 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Milestone</Label>
                <Select value={milestoneId} onValueChange={setMilestoneId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {milestones.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">{m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Assigned Employees * <span className="text-muted-foreground font-normal">(select multiple)</span></Label>
                <div className="border border-border rounded-md p-2 max-h-32 overflow-y-auto bg-muted/10 space-y-1">
                  {teamMembers && teamMembers.length > 0 ? (
                    teamMembers.map((m: any) => (
                      <label key={m.id || m.name} className="flex items-center gap-2 text-xs cursor-pointer px-1 py-0.5 rounded hover:bg-muted/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedAssignees.includes(m.name)}
                          onChange={() => toggleAssignee(m.name)}
                          className="accent-yellow-400 h-3.5 w-3.5"
                        />
                        <span className="text-foreground font-medium">{m.name}</span>
                        <span className="text-muted-foreground">({m.role || 'Member'})</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">No team members added yet</p>
                  )}
                </div>
                {selectedAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedAssignees.map(a => (
                      <span key={a} className="text-[10px] bg-gold/10 border border-gold/30 text-gold rounded px-1.5 py-0.5">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v: PriorityLevel) => setPriority(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label>Est. Hours</Label>
                <Input type="number" value={estHours} onChange={e => setEstHours(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <DialogFooter className="pt-3 gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowAddTask(false)}>Cancel</Button>
              <Button variant="gold" size="sm" type="submit" className="font-bold">Create & Assign Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 5. PROJECT ANALYTICS DASHBOARD ──
interface ProjectAnalyticsProps {
  analytics: ProjectAnalytics;
}

export function ProjectAnalyticsDashboard({ analytics }: ProjectAnalyticsProps) {
  return (
    <div className="space-y-6">
      {/* Top Banner Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Project Budget</p>
            <p className="text-xl font-bold text-gold">{formatCurrency(analytics.budget)}</p>
            <p className="text-[10px] text-muted-foreground">Fixed Client Contract</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Internal Cost</p>
            <p className="text-xl font-bold text-amber-400">{formatCurrency(analytics.internal_cost)}</p>
            <p className="text-[10px] text-muted-foreground">Approved Hours × Employee Rates</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Remaining Budget</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(analytics.remaining_budget)}</p>
            <p className="text-[10px] text-muted-foreground">Profitability Margin: {analytics.profitability_margin}%</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Project Completion</p>
            <p className="text-xl font-bold text-foreground">{analytics.overall_completion_pct}%</p>
            <p className="text-[10px] text-muted-foreground">Calculated from Tasks & Milestones</p>
          </CardContent>
        </Card>
      </div>

      {/* Deliverable Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border p-4 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4 text-gold" /> Task Execution Breakdown
          </h4>
          <div className="grid grid-cols-3 gap-3 text-center font-mono">
            <div className="bg-black/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase block">Total Tasks</span>
              <span className="text-lg font-bold text-foreground">{analytics.total_tasks}</span>
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase block">Completed</span>
              <span className="text-lg font-bold text-emerald-400">{analytics.completed_tasks}</span>
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase block">Pending</span>
              <span className="text-lg font-bold text-amber-400">{analytics.pending_tasks}</span>
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Task Completion Ratio</span>
              <span className="text-gold font-bold">{analytics.total_tasks > 0 ? Math.round((analytics.completed_tasks / analytics.total_tasks) * 100) : 0}%</span>
            </div>
            <Progress value={analytics.total_tasks > 0 ? (analytics.completed_tasks / analytics.total_tasks) * 100 : 0} className="h-2 bg-black/40" />
          </div>
        </Card>

        <Card className="bg-card border-border p-4 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gold" /> Hours & Work Log Summary
          </h4>
          <div className="grid grid-cols-2 gap-3 text-center font-mono">
            <div className="bg-black/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase block">Estimated Hours</span>
              <span className="text-lg font-bold text-foreground">{analytics.estimated_hours} hrs</span>
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-border">
              <span className="text-[10px] text-muted-foreground uppercase block">Approved Logged Hours</span>
              <span className="text-lg font-bold text-gold">{analytics.logged_hours} hrs</span>
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Hour Consumption Ratio</span>
              <span className="text-gold font-bold">{analytics.estimated_hours > 0 ? Math.round((analytics.logged_hours / analytics.estimated_hours) * 100) : 0}%</span>
            </div>
            <Progress value={analytics.estimated_hours > 0 ? Math.min(100, (analytics.logged_hours / analytics.estimated_hours) * 100) : 0} className="h-2 bg-black/40" />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── 6. EMPLOYEE PRODUCTIVITY ANALYTICS CARD ──
export function EmployeeProductivityCard({ workLogs, tasks, teamMembers }: { workLogs: WorkLog[]; tasks: TaskItem[]; teamMembers?: any[] }) {
  const employeesList = (teamMembers && teamMembers.length > 0)
    ? teamMembers.map(t => ({ name: t.name, rate: Number(t.hourly_rate) || 500, role: t.role || 'Team Member' }))
    : [];

  const statsList = employeesList.map(emp => {
    const name = emp.name;
    const empTasks = tasks.filter(t => isAssignedTo(t, name));
    const completedTasks = empTasks.filter(t => t.status === 'Completed' || t.progress >= 100).length;
    const pendingTasks = empTasks.length - completedTasks;

    const empLogs = workLogs.filter(w => w.employee_name.toLowerCase() === name.toLowerCase());
    const approvedLogs = empLogs.filter(w => w.status === 'Approved');
    const rejectedLogs = empLogs.filter(w => w.status === 'Rejected');

    const totalLoggedHours = approvedLogs.reduce((sum, l) => sum + (l.hours_spent || 0), 0);
    const hourlyRate = emp.rate || DEFAULT_EMPLOYEE_RATES[name]?.rate || 500;
    const totalCostGenerated = approvedLogs.length > 0
      ? approvedLogs.reduce((sum, l) => sum + (l.calculated_cost || (l.hours_spent * l.hourly_rate)), 0)
      : (totalLoggedHours * hourlyRate);

    const avgProgress = approvedLogs.length > 0
      ? Math.round(approvedLogs.reduce((sum, l) => sum + (l.progress_after - l.progress_before), 0) / approvedLogs.length)
      : (empLogs.length > 0 ? 12 : 0);

    return {
      employee_name: name,
      assigned_tasks: empTasks.length,
      completed_tasks: completedTasks,
      pending_tasks: pendingTasks,
      work_logs_submitted: empLogs.length,
      work_logs_approved: approvedLogs.length,
      work_logs_rejected: rejectedLogs.length,
      avg_progress_per_day: avgProgress,
      total_logged_hours: totalLoggedHours,
      total_cost_generated: totalCostGenerated,
      hourly_rate: hourlyRate,
      role: emp.role
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card p-3.5 rounded-xl border border-border">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Employee Productivity & Costing Matrix</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">Evaluated based on completed deliverables, approved work logs, and team member hourly rates.</p>
        </div>
        <Badge className="bg-gold/10 text-gold border-gold/30 text-xs">Dynamic Team Rates Active</Badge>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[850px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/20">
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[150px]">Employee</th>
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[110px]">Hourly Rate</th>
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[110px]">Assigned Tasks</th>
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[140px]">Completed / Pending</th>
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[180px]">Work Logs (Sub / Appr / Rej)</th>
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[130px]">Avg Daily Progress</th>
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap min-w-[150px]">Approved Cost Generated</th>
              </tr>
            </thead>
            <tbody>
              {statsList.map(s => (
                <tr key={s.employee_name} className="border-b border-border hover:bg-[#11241c]/20">
                  <td className="py-2.5 px-3">
                    <p className="font-bold text-foreground flex items-center gap-1.5 whitespace-nowrap">
                      <User className="h-3.5 w-3.5 text-gold" /> {s.employee_name}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.role}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-gold whitespace-nowrap">{formatCurrency(s.hourly_rate)}/hr</td>
                  <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">{s.assigned_tasks}</td>
                  <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                    <span className="text-emerald-400 font-bold">{s.completed_tasks}</span> / <span className="text-amber-400 font-bold">{s.pending_tasks}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                    <span>{s.work_logs_submitted}</span> / <span className="text-emerald-400 font-bold">{s.work_logs_approved}</span> / <span className="text-red-400 font-bold">{s.work_logs_rejected}</span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400 font-mono whitespace-nowrap">+{s.avg_progress_per_day}% / day</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-gold whitespace-nowrap">{formatCurrency(s.total_cost_generated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 7. PROJECT ACTIVITY TIMELINE ──
export function ProjectActivityTimeline({ items }: { items: ActivityTimelineItem[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Automatically Generated Project Activity Timeline</h4>
        <span className="text-[10px] text-muted-foreground">Real-time audit log of approvals, work submissions & milestone updates</span>
      </div>

      <div className="space-y-3 relative pl-4 border-l-2 border-gold/30">
        {items.map(item => (
          <div key={item.id} className="relative flex items-start justify-between gap-3 bg-card border border-border p-3 rounded-lg hover:border-gold/30 transition-colors">
            {/* Dot */}
            <div className="absolute -left-[21px] top-3.5 h-3 w-3 rounded-full bg-gold border-2 border-background" />

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-gold">{item.timestamp_text || '10:45'}</span>
                <span className="text-xs font-bold text-foreground">{item.action}</span>
                {item.task_title && <Badge className="text-[9px] bg-black/40 border-border text-muted-foreground">{item.task_title}</Badge>}
              </div>
              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
            </div>

            <span className="text-[10px] text-muted-foreground font-medium shrink-0">{item.user_name}</span>
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6 italic">No activity logged yet.</p>
        )}
      </div>
    </div>
  );
}

// ── 8. CLIENT PORTAL VIEW ──
export function ClientPortalView({
  projectProgress,
  milestones,
  tasks,
  announcements
}: {
  projectProgress: number;
  milestones: Milestone[];
  tasks: TaskItem[];
  announcements: ProjectAnnouncement[];
}) {
  return (
    <div className="space-y-6">
      {/* Disclaimer Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Client Portal Perspective Active: Internal employee work logs & hourly cost details are strictly hidden.</span>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Client Safe</Badge>
      </div>

      {/* Progress Header */}
      <Card className="bg-card border-border p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-foreground">Project Progress Summary</h3>
            <p className="text-xs text-muted-foreground">Netgain Business OS ERP</p>
          </div>
          <span className="text-2xl font-bold text-gold">{projectProgress}%</span>
        </div>
        <Progress value={projectProgress} className="h-2.5 bg-black/40" />
      </Card>

      {/* Milestones Checklist */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Milestones Status</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {milestones.map(m => {
            const isDone = m.status === 'Completed';
            const mTasks = tasks.filter(t => t.milestone_id === m.id || (!t.milestone_id && m.order_index === 2));
            const completedCount = mTasks.filter(t => t.status === 'Completed').length;
            const pct = mTasks.length > 0 ? Math.round((completedCount / mTasks.length) * 100) : isDone ? 100 : 0;

            return (
              <div key={m.id} className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${isDone ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-bold ${isDone ? 'text-foreground line-through' : 'text-foreground'}`}>{m.title}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gold">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5 bg-black/30" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Deliverables Overview */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Module Deliverables</h4>
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase text-[10px] bg-black/20">
                  <th className="text-left py-2.5 px-3">Module</th>
                  <th className="text-left py-2.5 px-3">Completion Status</th>
                  <th className="text-left py-2.5 px-3">Target Completion</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="py-2.5 px-3 font-semibold text-foreground">{t.title}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Progress value={t.progress} className="h-1.5 w-20 bg-black/40" />
                        <span className="font-mono text-gold font-bold">{t.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{t.due_date ? formatDate(t.due_date) : '15 July'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Project Announcements</h4>
        {announcements.map(a => (
          <Card key={a.id} className="bg-card border-border p-3.5 space-y-1">
            <div className="flex justify-between items-center">
              <h5 className="text-xs font-bold text-foreground">{a.title}</h5>
              <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
            </div>
            <p className="text-xs text-muted-foreground">{a.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 9. FUTURE INTEGRATIONS PANEL ──
export function FutureIntegrationsPanel() {
  return (
    <div className="space-y-4">
      <div className="bg-card p-4 rounded-xl border border-border space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <h4 className="text-sm font-bold text-foreground">Future Ready Integrations Architecture</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Database schema and API hooks are pre-structured to integrate automated commit tracking, Git pull requests, AI progress summaries, and team communication without redesigning the module.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { name: 'GitHub / GitLab', icon: GitPullRequest, status: 'Ready for Webhook Integration', desc: 'Auto-update work log when PR is merged' },
          { name: 'Slack / Discord', icon: MessageSquare, status: 'Ready for Notification Webhook', desc: 'Instant alerts on work log approval' },
          { name: 'Jira / Trello Sync', icon: Layers, status: 'Ready for Bidirectional Sync', desc: 'Import tickets as Project Tasks' },
          { name: 'AI Progress Summarizer', icon: Sparkles, status: 'Ready for AI Model Trigger', desc: 'Summarize work logs into daily client reports' },
          { name: 'Automatic Commit Tracking', icon: GitBranch, status: 'Schema Column Enabled', desc: 'Link git hashes to work log submissions' }
        ].map((item, idx) => (
          <Card key={idx} className="bg-card border-border p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4 text-gold shrink-0" />
              <h5 className="text-xs font-bold text-foreground">{item.name}</h5>
            </div>
            <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            <Badge className="text-[9px] bg-gold/10 text-gold border-gold/30">{item.status}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
