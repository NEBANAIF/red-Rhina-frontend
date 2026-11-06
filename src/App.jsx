import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './auth/LoginPage.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './layout/AppLayout.jsx';
import ForgotPasswordPage from './auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './auth/ResetPasswordPage.jsx';
import ChangePasswordPage from './auth/ChangePasswordPage.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import PosPage from './pages/pos/PosPage.jsx';
import InventoryPage from './pages/inventory/InventoryPage.jsx';
import BatchesPage from './pages/batches/BatchesPage.jsx';
import SalesHistoryPage from './pages/sales-history/SalesHistoryPage.jsx';
import CustomersPage from './pages/customers/CustomersPage.jsx';
import LoansPage from './pages/loans/LoansPage.jsx';
import DebtsPage from './pages/debts/DebtsPage.jsx';
import ManufacturingDashboardPage from './pages/manufacturing/ManufacturingDashboardPage.jsx';
import HrDashboardPage from './pages/hr/HrDashboardPage.jsx';
import EmployeesPage from './pages/hr/EmployeesPage.jsx';
import AttendancePage from './pages/hr/AttendancePage.jsx';
import LeavePage from './pages/hr/LeavePage.jsx';
import PayrollPage from './pages/hr/PayrollPage.jsx';
import HrSetupPage from './pages/hr/HrSetupPage.jsx';
import LiveAttendancePage from './pages/hr/LiveAttendancePage.jsx';
import HierarchyPage from './pages/hr/HierarchyPage.jsx';
import MeetingsPage from './pages/hr/MeetingsPage.jsx';
import MyPayslipsPage from './pages/hr/MyPayslipsPage.jsx';
import ManufacturingReportsPage from './pages/manufacturing/ManufacturingReportsPage.jsx';
import DirectSalesPage from './pages/manufacturing/DirectSalesPage.jsx';
import RawMaterialsPage from './pages/manufacturing/RawMaterialsPage.jsx';
import RawMaterialPurchasesPage from './pages/manufacturing/RawMaterialPurchasesPage.jsx';
import MachinesPage from './pages/manufacturing/MachinesPage.jsx';
import QualityPage from './pages/manufacturing/QualityPage.jsx';
import BomsPage from './pages/manufacturing/BomsPage.jsx';
import ProductionOrdersPage from './pages/manufacturing/ProductionOrdersPage.jsx';
import ReturnsPage from './pages/returns/ReturnsPage.jsx';
import TransfersPage from './pages/transfers/TransfersPage.jsx';
import StockHistoryPage from './pages/stock-history/StockHistoryPage.jsx';
import SuppliersPage from './pages/suppliers/SuppliersPage.jsx';
import PurchasesPage from './pages/purchases/PurchasesPage.jsx';
import FinancePage from './pages/finance/FinancePage.jsx';
import ExpensesPage from './pages/expenses/ExpensesPage.jsx';
import PaymentsPage from './pages/payments/PaymentsPage.jsx';
import ReportsPage from './pages/reports/ReportsPage.jsx';
import BranchesPage from './pages/branches/BranchesPage.jsx';
import UsersPage from './pages/users/UsersPage.jsx';
import RolesPage from './pages/roles/RolesPage.jsx';
import SettingsPage from './pages/settings/SettingsPage.jsx';
import NotificationsPage from './pages/notifications/NotificationsPage.jsx';
import BranchProductsPage from './pages/branch-products/BranchProductsPage.jsx';
import LoadingState from './components/LoadingState.jsx';
import { ROUTE_PERMISSIONS, firstAllowedPath, branchTypeOfRole } from './navigation.js';

/** "/" and unknown addresses: send the user to the first page they are allowed to open. */
function HomeRedirect() {
  const { status, user, hasPermission } = useAuth();
  if (status === 'loading') {
    return <LoadingState label="Checking your session..." />;
  }
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace />;
  }
  const target = firstAllowedPath(hasPermission, branchTypeOfRole(user.role));
  if (!target) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-medium text-ink-700">Your role doesn't give access to any page yet.</p>
          <p className="mt-1 text-sm text-ink-500">Ask an administrator to update your role.</p>
        </div>
      </div>
    );
  }
  return <Navigate to={target} replace />;
}

/** A user who still has a one-time password cannot use the app until they have chosen their own. */
function PasswordGate({ children }) {
  const { user } = useAuth();
  return user?.mustChangePassword ? <ChangePasswordPage /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <ProtectedRoute>
            <PasswordGate>
              <AppLayout />
            </PasswordGate>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/dashboard']}><DashboardPage /></ProtectedRoute>} />
        <Route path="/branches" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/branches']}><BranchesPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/notifications']}><NotificationsPage /></ProtectedRoute>} />
        <Route path="/branch-products" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/branch-products']}><BranchProductsPage /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/pos']}><PosPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/inventory']}><InventoryPage /></ProtectedRoute>} />
        <Route path="/batches" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/batches']}><BatchesPage /></ProtectedRoute>} />
        <Route path="/sales-history" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/sales-history']}><SalesHistoryPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/customers']}><CustomersPage /></ProtectedRoute>} />
        <Route path="/manufacturing/dashboard" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/dashboard']}><ManufacturingDashboardPage /></ProtectedRoute>} />
        <Route path="/manufacturing/materials" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/materials']}><RawMaterialsPage /></ProtectedRoute>} />
        <Route path="/manufacturing/purchases" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/purchases']}><RawMaterialPurchasesPage /></ProtectedRoute>} />
        <Route path="/hr/dashboard" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/dashboard']}><HrDashboardPage /></ProtectedRoute>} />
        <Route path="/hr/employees" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/employees']}><EmployeesPage /></ProtectedRoute>} />
        <Route path="/hr/attendance" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/attendance']}><AttendancePage /></ProtectedRoute>} />
        <Route path="/hr/leave" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/leave']}><LeavePage /></ProtectedRoute>} />
        <Route path="/hr/payroll" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/payroll']}><PayrollPage /></ProtectedRoute>} />
        <Route path="/hr/live-attendance" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/live-attendance']}><LiveAttendancePage /></ProtectedRoute>} />
        <Route path="/hr/my-payslips" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/my-payslips']}><MyPayslipsPage /></ProtectedRoute>} />
        <Route path="/hr/meetings" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/meetings']}><MeetingsPage /></ProtectedRoute>} />
        <Route path="/hr/hierarchy" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/hierarchy']}><HierarchyPage /></ProtectedRoute>} />
        <Route path="/hr/setup" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/hr/setup']}><HrSetupPage /></ProtectedRoute>} />
        <Route path="/manufacturing/reports" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/reports']}><ManufacturingReportsPage /></ProtectedRoute>} />
        <Route path="/manufacturing/direct-sales" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/direct-sales']}><DirectSalesPage /></ProtectedRoute>} />
        <Route path="/manufacturing/machines" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/machines']}><MachinesPage /></ProtectedRoute>} />
        <Route path="/manufacturing/quality" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/quality']}><QualityPage /></ProtectedRoute>} />
        <Route path="/manufacturing/boms" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/boms']}><BomsPage /></ProtectedRoute>} />
        <Route path="/manufacturing/production" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/manufacturing/production']}><ProductionOrdersPage /></ProtectedRoute>} />
        <Route path="/debts" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/debts']}><DebtsPage /></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/loans']}><LoansPage /></ProtectedRoute>} />
        <Route path="/returns" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/returns']}><ReturnsPage /></ProtectedRoute>} />
        <Route path="/transfers" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/transfers']}><TransfersPage /></ProtectedRoute>} />
        <Route path="/stock-history" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/stock-history']}><StockHistoryPage /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/suppliers']}><SuppliersPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/purchases']}><PurchasesPage /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/finance']}><FinancePage /></ProtectedRoute>} />
        {/* Either EXPENSE_CREATE or EXPENSE_VIEW reaches Expenses; the page itself handles the split (see its own comment). */}
        <Route path="/expenses" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/expenses']}><ExpensesPage /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/payments']}><PaymentsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/reports']}><ReportsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/users']}><UsersPage /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/roles']}><RolesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/settings']}><SettingsPage /></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
