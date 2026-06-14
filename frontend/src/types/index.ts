export interface User {
    _id?: string;
    id?: string;
    username: string;
    email?: string;
    avatar?: string;
    team?: string;
    role?: string;
}

export interface Meeting {
    meetingId: string;
    title: string;
    status: "active" | "ended";
    createdAt: string;
    endedAt?: string;
    notes?: string;
    recordingUrl?: string;
    transcript?: TranscriptEntry[];
    summary?: MeetingSummary;
    host?: User;
}

export interface TranscriptEntry {
    username: string;
    text: string;
    timestamp: string;
}

export interface MeetingSummary {
    text?: string;
    keyPoints?: string[];
    actionItems?: ActionItem[];
}

export interface ActionItem {
    task: string;
    assignee: string;
    status: string;
}

export interface Task {
    _id: string;
    meetingId?: string;
    title: string;
    assignee: string;
    status: "todo" | "pending" | "in_progress" | "completed";
    team?: string;
}

export interface ChatMessage {
    socketId: string;
    username: string;
    message: string;
    timestamp: string;
}

export interface RemoteStream {
    id: string;
    stream: MediaStream;
    username: string;
}

export interface Notification {
    _id: string;
    userId: string;
    type: "mention" | "action_item" | "task_assigned";
    title: string;
    message: string;
    read: boolean;
    metadata?: {
        meetingId?: string;
        taskId?: string;
        fromUsername?: string;
    };
    createdAt: string;
}

export interface Analytics {
    meetingsCount: number;
    endedMeetingsCount: number;
    activeMeetingsCount: number;
    tasksCount: number;
    tasksBreakdown: {
        todo: number;
        in_progress: number;
        completed: number;
    };
    meetingFrequency: { date: string; count: number }[];
    productivity: {
        completionRate: number;
        avgParticipants: number;
        transcriptTurns: number;
        messagesSent: number;
    };
}

export interface TeamMember {
    _id?: string;
    username: string;
    email: string;
    role: string;
}

export interface Invitation {
    _id: string;
    team: string;
    role: string;
    token: string;
    invitedBy?: { username: string; email: string };
}

export interface Toast {
    msg: string;
    type: "success" | "error" | "info";
}
