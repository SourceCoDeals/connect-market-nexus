
import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { User } from "@/types";

const AdminUsers = () => {
  const { useUsers, useUpdateUserStatus } = useAdmin();
  const { data: users = [], isLoading } = useUsers();
  const { mutate: updateUserStatus } = useUpdateUserStatus();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  
  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.company?.toLowerCase().includes(searchLower)
    );
  });
  
  const handleAction = (user: User, action: "approve" | "reject") => {
    setSelectedUser(user);
    setActionType(action);
  };
  
  const confirmAction = () => {
    if (selectedUser && actionType) {
      updateUserStatus({
        userId: selectedUser.id,
        status: actionType === "approve" ? "approved" : "rejected",
      });
    }
    setSelectedUser(null);
    setActionType(null);
  };
  
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rejected</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-500">Pending</Badge>;
    }
  };

  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="h-10 bg-muted rounded-md w-full max-w-sm animate-pulse"></div>
      <div className="border rounded-md">
        <div className="h-12 bg-muted/50 rounded-t-md animate-pulse"></div>
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="h-16 border-t bg-background animate-pulse"></div>
          ))}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">User Management</h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        renderSkeleton()
      ) : (
        <>
          <div className="flex gap-4 mb-6">
            <Badge className="bg-background text-foreground border">
              Total: {users.length}
            </Badge>
            <Badge className="bg-background text-foreground border">
              Pending: {users.filter((u) => u.approval_status === "pending").length}
            </Badge>
            <Badge className="bg-background text-foreground border">
              Approved: {users.filter((u) => u.approval_status === "approved").length}
            </Badge>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.company || "-"}</TableCell>
                      <TableCell>
                        {user.created_at
                          ? formatDistanceToNow(new Date(user.created_at), {
                              addSuffix: true,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(user.approval_status)}</TableCell>
                      <TableCell>
                        {user.email_verified ? (
                          <CheckCircle className="text-green-500 h-5 w-5" />
                        ) : (
                          <XCircle className="text-red-500 h-5 w-5" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.approval_status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500 hover:bg-green-500 hover:text-white"
                              onClick={() => handleAction(user, "approve")}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-500 hover:bg-red-500 hover:text-white"
                              onClick={() => handleAction(user, "reject")}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : user.approval_status === "rejected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-500 hover:bg-green-500 hover:text-white"
                            onClick={() => handleAction(user, "approve")}
                          >
                            Approve
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500 hover:bg-red-500 hover:text-white"
                            onClick={() => handleAction(user, "reject")}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={Boolean(selectedUser && actionType)} onOpenChange={() => setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {actionType === "approve" ? "Approve User" : "Reject User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionType === "approve" ? "approve" : "reject"}{" "}
              {selectedUser?.first_name} {selectedUser?.last_name}?
              {actionType === "approve"
                ? " This will grant them access to the marketplace."
                : " This will prevent them from accessing the marketplace."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={
                actionType === "approve"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-red-500 hover:bg-red-600"
              }
            >
              {actionType === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
