
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, Clock, AlertCircle, TrendingUp } from "lucide-react";

interface QuickStatsProps {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  rejectedUsers: number;
  newUsersToday?: number;
}

export function QuickStats({ 
  totalUsers, 
  approvedUsers, 
  pendingUsers, 
  rejectedUsers,
  newUsersToday = 0
}: QuickStatsProps) {
  const stats = [
    {
      title: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Approved",
      value: approvedUsers,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Pending Review",
      value: pendingUsers,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      urgent: pendingUsers > 0
    },
    {
      title: "Rejected",
      value: rejectedUsers,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.urgent && stat.value > 0 && (
                <Badge variant="secondary" className="mt-2 bg-yellow-100 text-yellow-800">
                  Needs attention
                </Badge>
              )}
              {stat.title === "Total Users" && newUsersToday > 0 && (
                <div className="flex items-center mt-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{newUsersToday} today
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
