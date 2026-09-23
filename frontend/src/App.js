import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import TartanView from "@/pages/TartanView";
import InviteLanding from "@/pages/InviteLanding";
import MeDashboard from "@/pages/MeDashboard";
import OrganizerDashboard from "@/pages/OrganizerDashboard";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Studio from "@/pages/Studio";
import Admin from "@/pages/Admin";

function App() {
  return (
    <div className="App tartan-bg min-h-screen">
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/t/:token" element={<TartanView />} />
              <Route path="/j/:shareToken" element={<InviteLanding />} />
              <Route path="/me/:shareToken" element={<MeDashboard />} />
              <Route path="/dashboard/:shareToken" element={<OrganizerDashboard />} />
              <Route path="/p/:shareToken" element={<Profile />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" theme="dark" richColors />
        </AppProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
