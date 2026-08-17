import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

export default function BackButtonHandler() {
  useEffect(() => {
    const handleBackButton = async (event) => {
      if (event.canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    };

    CapacitorApp.addListener('backButton', handleBackButton);
    return () => CapacitorApp.removeAllListeners();
  }, []);

  return null;
}
