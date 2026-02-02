import {
  UserPlus,
  FileText,
  Target,
  ThumbsUp,
  ThumbsDown,
  Send,
  FileAudio,
  BookOpen,
  LucideIcon
} from "lucide-react";

export type ActivityType =
  | 'buyer_added'
  | 'deal_created'
  | 'buyer_scored'
  | 'buyer_interested'
  | 'buyer_passed'
  | 'outreach_approved'
  | 'transcript_added'
  | 'learning_captured';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  link?: string;
}

interface ActivityConfig {
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}

export const activityConfig: Record<ActivityType, ActivityConfig> = {
  buyer_added: {
    icon: UserPlus,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
  },
  deal_created: {
    icon: FileText,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
  },
  buyer_scored: {
    icon: Target,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
  },
  buyer_interested: {
    icon: ThumbsUp,
    colorClass: "text-green-500",
    bgClass: "bg-green-500/10",
  },
  buyer_passed: {
    icon: ThumbsDown,
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10",
  },
  outreach_approved: {
    icon: Send,
    colorClass: "text-green-500",
    bgClass: "bg-green-500/10",
  },
  transcript_added: {
    icon: FileAudio,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
  },
  learning_captured: {
    icon: BookOpen,
    colorClass: "text-purple-500",
    bgClass: "bg-purple-500/10",
  },
};
