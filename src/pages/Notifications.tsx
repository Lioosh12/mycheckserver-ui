import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, CheckCircle, Plus, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationSettings {
  serverDown: boolean;
  slowResponse: boolean;
  dailySummary: boolean;
  slowThreshold: number;
}

const Notifications = () => {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [settings, setSettings] = useState<NotificationSettings>({
    serverDown: true,
    slowResponse: true,
    dailySummary: false,
    slowThreshold: 3000
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getNotificationSettings();
        setSettings(data);
      } catch (error) {
        console.error('Failed to fetch notification settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleAddWhatsApp = async () => {
    if (!whatsappNumber) return;
    
    try {
      await api.updateWhatsapp(whatsappNumber);
      await refreshUser();
      toast({
        title: "WhatsApp Added",
        description: "Nomor WhatsApp berhasil disimpan.",
      });
      setWhatsappNumber("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateSettings = async (key: keyof NotificationSettings, value: boolean) => {
    setSaving(true);
    try {
      const newSettings = { ...settings, [key]: value };
      await api.updateNotificationSettings(newSettings);
      setSettings(newSettings);
      toast({
        title: "Settings Updated",
        description: "Pengaturan notifikasi berhasil diperbarui.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendReport = async () => {
    setSendingReport(true);
    try {
      const result = await api.sendStatusReport();
      if (result.success) {
        toast({
          title: "Report Sent!",
          description: `Status report telah dikirim ke ${result.email}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingReport(false);
    }
  };

  const isPro = user?.plan === 'pro';

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
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Manage your notification preferences</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Get alerts via email</CardDescription>
                </div>
              </div>
              <Badge variant={user?.emailVerified ? "default" : "secondary"} className="flex items-center gap-1">
                {user?.emailVerified ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </>
                ) : 'Not Verified'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Email Address</Label>
                <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
              </div>
              <Button onClick={handleSendReport} disabled={sendingReport} variant="outline">
                {sendingReport ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Status Report Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-accent" />
                <div>
                  <CardTitle>WhatsApp Notifications</CardTitle>
                  <CardDescription>Get instant alerts on WhatsApp (Pro only)</CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Pro Feature</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isPro ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="whatsapp"
                        placeholder="+62812345678"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                      />
                      <Button onClick={handleAddWhatsApp}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {user?.whatsapp && (
                    <div className="space-y-2">
                      <Label>Registered Number</Label>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{user.whatsapp}</span>
                        </div>
                        <Badge variant={user.whatsappVerified ? "default" : "secondary"}>
                          {user.whatsappVerified ? 'Verified' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upgrade ke Pro untuk menggunakan notifikasi WhatsApp
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose when to receive notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Server Down Alerts</p>
                  <p className="text-sm text-muted-foreground">Instant notification when server goes down</p>
                </div>
                <Switch
                  checked={settings.serverDown}
                  onCheckedChange={(checked) => handleUpdateSettings('serverDown', checked)}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Slow Response Alerts</p>
                  <p className="text-sm text-muted-foreground">Alert when response time is above threshold</p>
                </div>
                <Switch
                  checked={settings.slowResponse}
                  onCheckedChange={(checked) => handleUpdateSettings('slowResponse', checked)}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Daily Summary (3x/day)</p>
                  <p className="text-sm text-muted-foreground">Status report at 08:00, 14:00, 20:00 WIB</p>
                </div>
                <Switch
                  checked={settings.dailySummary}
                  onCheckedChange={(checked) => handleUpdateSettings('dailySummary', checked)}
                  disabled={saving}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
