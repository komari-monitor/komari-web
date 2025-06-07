import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getColumns } from "@/components/session/columns";
import { DataTable } from "@/components/session/data-table";

export function SessionPage() {
  const {
    sessions,
    currentSessionId,
    loading,
    error,
    removeSession,
    removeAllSessions,
  } = useSession();

  const handleDelete = async (sessionId: string) => {
    await removeSession(sessionId);
    toast("成功");
  };

  const handleDeleteAll = async () => {
    await removeAllSessions();
    toast("成功");
  };

  const columns = getColumns(currentSessionId, handleDelete);

  if (loading) {
    return <div className="p-4">正在加载会话信息...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">错误: {error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">会话管理</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">删除所有会话</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确定要删除所有其他会话吗？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作将使包括当前设备的所有设备下线，且无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                className="bg-red-600 hover:bg-red-700"
              >
                确定
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <DataTable columns={columns} data={sessions} />
    </div>
  );
}
