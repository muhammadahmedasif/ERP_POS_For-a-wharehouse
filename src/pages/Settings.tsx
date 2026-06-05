import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useAppStore } from '../store';
import { toast } from 'sonner';

export default function Settings() {
  const { t } = useTranslation();
  const { settings, updateSettings, user } = useAppStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings({
      ...settings,
      sellerName: settings.sellerName || user?.name || ''
    });
  }, [settings, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const loadingToast = toast.loading('Saving settings...');
    try {
      await updateSettings(localSettings);
      toast.success('Settings saved successfully!');
    } catch (e) {
      toast.error('Failed to save settings.');
    } finally {
      setIsSaving(false);
      toast.dismiss(loadingToast);
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 500,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const dataUrl = reader.result as string;
            const res = await fetch('/api/upload-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dataUrl })
            });
            const result = await res.json();
            if (!res.ok) {
              throw new Error(result.error || 'Failed to upload profile picture.');
            }
            setLocalSettings(prev => ({ ...prev, profilePictureUrl: result.url, profilePicturePublicId: result.public_id }));
          } catch (error: any) {
            toast.error(error.message || 'Failed to upload profile picture.');
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error: any) {
        toast.error(error.message || 'Failed to compress profile picture.');
      }
    }
  };

  const handleRemoveProfilePicture = async () => {
    await fetch('/api/delete-image', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: localSettings.profilePicturePublicId })
    });
    setLocalSettings(prev => ({ ...prev, profilePictureUrl: '', profilePicturePublicId: '' }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Settings</h2>
      
      <Card className="max-w-2xl">
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle className="text-base text-slate-800">Store Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-4xl text-slate-400 font-bold">
                {localSettings.profilePictureUrl ? (
                  <img src={localSettings.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  localSettings.sellerName?.charAt(0) || 'U'
                )}
              </div>
              <div className="space-y-2">
                <Input type="file" onChange={handleProfilePictureChange} accept="image/*" />
                {localSettings.profilePictureUrl && (
                  <Button type="button" variant="outline" size="sm" onClick={handleRemoveProfilePicture}>Remove Image</Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Seller Name</label>
              <Input 
                value={localSettings.sellerName} 
                onChange={e => setLocalSettings({...localSettings, sellerName: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Store Name</label>
              <Input 
                value={localSettings.storeName} 
                onChange={e => setLocalSettings({...localSettings, storeName: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Tax Rate (%)</label>
              <Input 
                type="number"
                value={localSettings.taxRate} 
                onChange={e => setLocalSettings({...localSettings, taxRate: parseFloat(e.target.value) || 0})} 
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Default Low Inventory Alert Threshold</label>
              <Input 
                type="number"
                value={localSettings.defaultLowInventoryThreshold} 
                onChange={e => setLocalSettings({...localSettings, defaultLowInventoryThreshold: parseInt(e.target.value) || 0})} 
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
