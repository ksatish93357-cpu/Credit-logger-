import React from 'react';
import { NavigationShell } from './components/NavigationShell';
import { PinLockScreen } from './components/PinLockScreen';
import { SplashScreen } from './components/SplashScreen';
import { AppProvider, useApp } from './context/AppContext';
import { CalculatorScreen } from './screens/CalculatorScreen';
import {
  AddCreditScreen,
  CreditDetailsScreen,
  CreditListScreen,
  DailyCreditUpdateScreen,
  EditCreditScreen,
  MainCreditUpdateScreen,
} from './screens/CreditsScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { JsonExportScreen, JsonImportScreen, PdfPreviewScreen } from './screens/DataManagementScreen';
import {
  AddCreditPaymentScreen,
  NormalPaymentScreen,
  PaymentPreviewScreen,
  PaymentReceiptScreen,
} from './screens/PaymentsScreen';
import { ProfileDetailsScreen, ProfileFormScreen, ProfilesListScreen } from './screens/ProfilesScreen';
import { RemindersScreen, ReportsScreen } from './screens/ReportsRemindersScreen';
import {
  AboutScreen,
  FirebaseConfigScreen,
  LanguageSettingsScreen,
  SecuritySettingsScreen,
  SettingsHubScreen,
  SyncStatusScreen,
  ThemeSettingsScreen,
} from './screens/SettingsFirebaseScreens';
import { TransactionDetailsScreen, TransactionHistoryScreen } from './screens/TransactionsScreen';

const ScreenRouter: React.FC = () => {
  const { loading, showSplash, dismissSplash, isLocked, route } = useApp();

  if (showSplash || loading) {
    return <SplashScreen onContinue={dismissSplash} />;
  }

  if (isLocked) {
    return <PinLockScreen />;
  }

  const renderScreen = () => {
    switch (route.screen) {
      case 'home':
        return <DashboardScreen />;
      case 'profiles':
        return <ProfilesListScreen />;
      case 'add_profile':
        return <ProfileFormScreen />;
      case 'edit_profile':
        return <ProfileFormScreen editProfileId={route.profileId} />;
      case 'profile_details':
        return <ProfileDetailsScreen profileId={route.profileId || ''} />;
      case 'credit_list':
        return <CreditListScreen />;
      case 'add_credit':
        return <AddCreditScreen initialProfileId={route.profileId} />;
      case 'credit_details':
        return <CreditDetailsScreen creditId={route.creditId || ''} />;
      case 'edit_credit':
        return <EditCreditScreen creditId={route.creditId || ''} />;
      case 'daily_credit_update':
        return <DailyCreditUpdateScreen creditId={route.creditId || ''} />;
      case 'main_credit_update':
        return <MainCreditUpdateScreen creditId={route.creditId || ''} />;
      case 'add_payment':
        return <AddCreditPaymentScreen initialProfileId={route.profileId} initialCreditId={route.creditId} />;
      case 'payment_preview':
        return <PaymentPreviewScreen />;
      case 'payment_receipt':
        return <PaymentReceiptScreen paymentId={route.paymentId || ''} />;
      case 'normal_payment':
        return <NormalPaymentScreen initialProfileId={route.profileId} />;
      case 'transactions':
        return <TransactionHistoryScreen />;
      case 'transaction_details':
        return <TransactionDetailsScreen transactionId={route.transactionId || ''} />;
      case 'calculator':
        return <CalculatorScreen initialTab={route.calculatorTab || 'loan'} />;
      case 'loan_calculator':
        return <CalculatorScreen initialTab="loan" />;
      case 'reports':
        return <ReportsScreen />;
      case 'reminders':
        return <RemindersScreen />;
      case 'json_export':
        return <JsonExportScreen />;
      case 'json_import':
        return <JsonImportScreen />;
      case 'pdf_preview':
        return (
          <PdfPreviewScreen
            mode={route.pdfMode}
            profileId={route.profileId}
            creditId={route.creditId}
            paymentId={route.paymentId}
          />
        );
      case 'firebase_config':
        return <FirebaseConfigScreen />;
      case 'sync_status':
        return <SyncStatusScreen />;
      case 'settings':
        return <SettingsHubScreen />;
      case 'security_settings':
        return <SecuritySettingsScreen />;
      case 'language_settings':
        return <LanguageSettingsScreen />;
      case 'theme_settings':
        return <ThemeSettingsScreen />;
      case 'about':
        return <AboutScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return <NavigationShell>{renderScreen()}</NavigationShell>;
};

export default function App() {
  return (
    <AppProvider>
      <ScreenRouter />
    </AppProvider>
  );
}
