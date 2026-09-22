import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import TartanView from "@/pages/TartanView";
import InviteLanding from "@/pages/InviteLanding";
import MeDashboard from "@/pages/MeDashboard";
import OrganizerDashboard from "@/pages/OrganizerDashboard";

function App() {
  return (
    <div className="App tartan-bg min-h-screen">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/t/:token" element={<TartanView />} />
            <Route path="/j/:shareToken" element={<InviteLanding />} />
            <Route path="/me/:shareToken" element={<MeDashboard />} />
            <Route path="/dashboard/:shareToken" element={<OrganizerDashboard />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" theme="dark" richColors />
      </AppProvider>
    </div>
  );
}

export default App;
