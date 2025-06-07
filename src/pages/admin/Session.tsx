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
import { useTranslation } from "react-i18next";

export default function SessionPage() {
  const { t } = useTranslation();
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
    toast(t("admin.session.success"));
  };

  const handleDeleteAll = async () => {
    await removeAllSessions();
    toast(t("admin.session.success"));
  };

  const columns = getColumns(currentSessionId, handleDelete);

  if (loading) {
    return <div className="p-4">{t("admin.session.loading")}</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{t("admin.session.error", { error })}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{t("admin.session.title")}</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">{t("admin.session.deleteAll")}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.session.confirmDeleteAllTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.session.confirmDeleteAllDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("admin.session.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                className="bg-red-600 hover:bg-red-700"
              >
                {t("admin.session.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <DataTable columns={columns} data={sessions} />
    </div>
  );
}