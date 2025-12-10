import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Plus, CheckCircle, XCircle, Activity, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import api from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Server {
  id: number;
  name: string;
  domain: string;
  status: string;
  responseTime: number;
  lastCheck?: string;
}

const ServerList = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchServers = async () => {
    try {
      const data = await api.getServers();
      setServers(data.servers);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteServer(String(id));
      setServers(servers.filter(s => s.id !== id));
      toast({ title: "Server deleted", description: "Server berhasil dihapus" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCheck = async (id: number) => {
    setCheckingId(id);
    try {
      const result = await api.checkServerNow(String(id));
      await fetchServers();
      toast({ 
        title: "Check complete", 
        description: `Status: ${result.result.status}, Response: ${result.result.responseTime}ms` 
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCheckingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Server List</h1>
            <p className="text-muted-foreground">Manage and monitor your servers</p>
          </div>
          <Link to="/servers/add">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Server
            </Button>
          </Link>
        </div>

        <div className="grid gap-4">
          {servers.map((server) => (
            <Card key={server.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {server.name}
                      {server.status === "up" ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </CardTitle>
                    <CardDescription>{server.domain}</CardDescription>
                  </div>
                  <Badge variant={server.status === "up" ? "default" : "destructive"}>
                    {server.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span>Response Time: {server.responseTime}ms</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCheck(server.id)}
                      disabled={checkingId === server.id}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${checkingId === server.id ? 'animate-spin' : ''}`} />
                      Check
                    </Button>
                    <Link to={`/servers/${server.id}`}>
                      <Button variant="outline" size="sm">View Details</Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Server?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus server {server.name}? 
                            Semua data monitoring akan dihapus permanen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(server.id)} className="bg-destructive text-destructive-foreground">
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {servers.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No servers yet</h3>
              <p className="text-muted-foreground mb-4">Add your first server to start monitoring</p>
              <Link to="/servers/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ServerList;
