import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { BudgetProvider } from './src/context/BudgetContext';
import { RequestsProvider } from './src/context/RequestsContext';
import { ShiaimProvider } from './src/context/ShiaimContext';
import { ProfitsProvider } from './src/context/ProfitsContext';
import { WorkPlanProvider } from './src/context/WorkPlanContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { seedFirestore } from './src/services/seedFirestore';
import { isDeviceCompromised } from './src/services/securityService';

function NotificationInit() {
  const { user } = useAuth();
  const { initForUser } = useNotifications();
  useEffect(() => {
    if (user) initForUser(user);
  }, [user?.username]);
  return null;
}

function BlockedScreen() {
  return (
    <View style={styles.blocked}>
      <Text style={styles.blockedIcon}>⛔</Text>
      <Text style={styles.blockedTitle}>גישה נדחתה</Text>
      <Text style={styles.blockedBody}>
        מכשיר זה אינו עומד בדרישות האבטחה של המערכת.{'\n'}
        (מכשיר פרוץ, כלי פריצה מותקנים, או סביבת אמולטור)
        {'\n'}לסיוע פנה למנהל המערכת.
      </Text>
    </View>
  );
}

export default function App() {
  const [rooted, setRooted] = useState<boolean | null>(null);

  useEffect(() => {
    seedFirestore();
    isDeviceCompromised().then(result => setRooted(result));
  }, []);

  // Still checking
  if (rooted === null) {
    return (
      <View style={styles.blocked}>
        <StatusBar style="light" backgroundColor="#111827" />
      </View>
    );
  }

  if (rooted) return <BlockedScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <DataProvider>
            <BudgetProvider>
              <RequestsProvider>
                <ShiaimProvider>
                  <ProfitsProvider>
                    <WorkPlanProvider>
                      <NotificationProvider>
                        <NotificationInit />
                        <StatusBar style="light" backgroundColor="#111827" />
                        <AppNavigator />
                      </NotificationProvider>
                    </WorkPlanProvider>
                  </ProfitsProvider>
                </ShiaimProvider>
              </RequestsProvider>
            </BudgetProvider>
          </DataProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  blockedIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  blockedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  blockedBody: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 26,
  },
});
