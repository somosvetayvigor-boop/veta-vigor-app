import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const TRAINING_REMINDER_ID = 1001;
const DAILY_MOTIVATION_ID = 1002;

export const requestNotificationPermissions = async () => {
  if (!Capacitor.isNativePlatform()) return false;
  
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions', error);
    return false;
  }
};

export const scheduleTrainingReminder = async (routineName) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Set for 6:00 PM today
    const scheduleDate = new Date();
    scheduleDate.setHours(18, 0, 0, 0);

    // If it's already past 6 PM, don't schedule for today
    if (new Date() > scheduleDate) return;

    // Cancel any existing reminder first to avoid duplicates
    await cancelTrainingReminder();

    await LocalNotifications.schedule({
      notifications: [
        {
          title: '¡No te rindas hoy!',
          body: `Te toca tu rutina: ${routineName}. ¡Entra al Cuartel y completa tu entrenamiento!`,
          id: TRAINING_REMINDER_ID,
          schedule: { at: scheduleDate },
          sound: null,
          attachments: null,
          actionTypeId: '',
          extra: null
        }
      ]
    });
    console.log(`Training reminder scheduled for 18:00 for ${routineName}`);
  } catch (error) {
    console.error('Error scheduling training reminder:', error);
  }
};

export const cancelTrainingReminder = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TRAINING_REMINDER_ID }] });
    console.log('Training reminder cancelled (Check-in done!)');
  } catch (error) {
    console.error('Error cancelling training reminder:', error);
  }
};

export const scheduleDailyMotivation = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: '¡Buenos días recluta!',
          body: 'Entra a V&V para leer tu mensaje de motivación del día y revisar tu calendario.',
          id: DAILY_MOTIVATION_ID,
          schedule: { 
            every: 'day', // Repeats daily
            on: {
              hour: 8,
              minute: 0
            } 
          },
          sound: null,
          attachments: null,
          actionTypeId: '',
          extra: null
        }
      ]
    });
    console.log('Daily motivation notification scheduled for 08:00 AM');
  } catch (error) {
    console.error('Error scheduling daily motivation:', error);
  }
};
