export type Column = { id: string; name: string };
export type Board = { id: string; name: string; description: string; ownerId: string; memberIds: string[]; columns: Column[]; revision: number; taskCount: number; deleting: boolean; updatedAt: unknown };
export type Task = { id: string; title: string; description: string; columnId: string; rank: number; priority: 'none' | 'low' | 'medium' | 'high'; dueDate: string | null; assigneeId: string | null; createdBy: string; revision: number };
export type Member = { id: string; name: string; photoURL: string | null; role: 'owner' | 'member' };
export type Invitation = { id: string; email: string; expiresAt: number; state: string };
export const LIMITS = { boards: 20, members: 20, columns: 20, tasks: 500, invites: 20, requestsPerMinute: 120 };
