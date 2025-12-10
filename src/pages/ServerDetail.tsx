import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { CheckCircle, XCircle, Activity, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface ServerData {
  id: number;
  name: string;
  domain: string;
  status: string;
  responseTime: number;
  interval: number;
  lastCheck?: string;
}

interface Log {
  id: number;
  statusCode: number;
  responseTime: number;
  status: string;
  message: string;
  createdAt: string;
}

const ServerDetail = () => {
  const { id } = useParams();
  const [server, setServer] = useState<ServerData | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [responseData, setResponseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const data = await api.getServer(id!);
      setServer(data.server);
      setLogs(data.logs);
      setResponseData(data.uptimeData.map((d: any) => ({ time: d.hour, ms: d.avg_response_time || 0 })));
    } catch (error) {
      console.error('Failed to fetch server:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await api.checkServerNow(id!);
      await fetchData();
      toast({ title: "Check complete", description: "Server check completed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  if (loading || !server) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              {server.name}
              {server.status === "up" ? (
                <CheckCircle className="h-8 w-8 text-success" />
              ) : (
                <XCircle className="h-8 w-8 text-destructive" />
              )}
            </h1>
            <p className="text-muted-foreground">{server.domain}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleCheck} disabled={checking}>
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
              Check Now
            </Button>
            <Badge variant={server.status === "up" ? "default" : "destructive"} className="text-lg px-4 py-2">
              {server.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${server.status === 'up' ? 'text-success' : 'text-destructive'}`}>
                {server.status === 'up' ? 'Online' : 'Offline'}
              </div>
              <p className="text-xs text-muted-foreground">
                {server.status === 'up' ? 'All systems operational' : 'Server is down'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{server.responseTime}ms</div>
              <p className="text-xs text-muted-foreground">Last check response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monitoring Interval</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{server.interval} min</div>
              <p className="text-xs text-muted-foreground">Check frequency</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Response Time History</CardTitle>
            <CardDescription>Last 24 hours performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={responseData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="ms" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--accent))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Log</CardTitle>
            <CardDescription>Recent monitoring checks</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status Code</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.createdAt).toLocaleString('id-ID')}</TableCell>
                    <TableCell>
                      <Badge variant={log.statusCode >= 200 && log.statusCode < 400 ? "default" : "destructive"}>
                        {log.statusCode || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.responseTime > 0 ? `${log.responseTime}ms` : "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'up' ? "default" : "destructive"}>
                        {log.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {logs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No logs yet. Monitoring data will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ServerDetail;
