import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileStack,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Palette,
  Settings,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Sidebar navigation, kept as one editable list so each phase can add its
 * page here the moment it's real — never before. An entry here is a promise
 * that `/w/[slug]/<href>` renders a genuinely working page, per the brief's
 * "no placeholder page falsely appears complete" rule.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "brand", label: "Brand", icon: Palette },
  { href: "knowledge", label: "Knowledge", icon: BookOpen },
  { href: "campaigns", label: "Campaigns", icon: Megaphone },
  { href: "ideas", label: "Idea board", icon: Lightbulb },
  { href: "studio", label: "Content studio", icon: Sparkles },
  { href: "approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "calendar", label: "Calendar", icon: CalendarDays },
  { href: "connections", label: "Connections", icon: Share2 },
  { href: "analytics", label: "Analytics", icon: BarChart3 },
  { href: "billing", label: "Billing", icon: CreditCard },
  { href: "activity", label: "Activity", icon: FileStack },
  { href: "notifications", label: "Notifications", icon: Bell },
  { href: "team", label: "Team", icon: Users },
  { href: "settings", label: "Settings", icon: Settings },
];
