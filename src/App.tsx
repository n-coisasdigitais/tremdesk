import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Kanban from "./pages/Kanban";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import DayLog from "./pages/DayLog";
import DayLogNew from "./pages/DayLogNew";
import DayLogDetail from "./pages/DayLogDetail";
import Users from "./pages/admin/Users";
import Companies from "./pages/admin/Companies";
import Teams from "./pages/admin/Teams";
import Announcements from "./pages/admin/Announcements";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/daylog" element={<ProtectedRoute><DayLog /></ProtectedRoute>} />
          <Route path="/daylog/new" element={<ProtectedRoute><DayLogNew /></ProtectedRoute>} />
          <Route path="/daylog/:id" element={<ProtectedRoute><DayLogDetail /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/admin/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
          <Route path="/admin/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
          <Route path="/admin/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
