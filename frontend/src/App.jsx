import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import Discover from './components/Discover'
import KnowledgeGraph from './components/KnowledgeGraph'
import AgentMemory from './components/AgentMemory'
import KnowledgeGalaxy from './components/KnowledgeGalaxy'
import AgentCollaboration from './components/AgentCollaboration'
import SelfLearning from './components/SelfLearning'
import ExecutiveDashboard from './components/ExecutiveDashboard'
import SystemHealth from './components/SystemHealth'
import CreateContent from './components/create/CreateContent'
import ManageAds from './components/ads/ManageAds'
import ContentCalendar from './components/calendar/ContentCalendar'
import CRM from './components/CRM'
import Research from './components/Research'
import Documents from './components/Documents'
import Funnel from './components/Funnel'
import Outreach from './components/Outreach'
import VoiceCalls from './components/VoiceCalls'
import Chat from './components/Chat'
import AITeam from './components/AITeam'
import HelpCenter from './components/HelpCenter'
import Proposals from './components/Proposals'
import LeadIntel from './components/LeadIntel'
import Meetings from './components/Meetings'
import ClientSuccess from './components/ClientSuccess'
import Autopilot from './components/Autopilot'
import ImageStudio from './components/studio/ImageStudio'
import VideoStudio from './components/studio/VideoStudio'
import Settings from './components/Settings'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import Onboarding from './components/auth/Onboarding'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { SidebarProvider, useSidebar } from './context/SidebarContext'

/**
 * Layout component that manages the shared UI elements (Sidebar, Header) 
 * and handles the responsive margin shift based on sidebar state.
 */
function Layout({ children }) {
  const { isCollapsed } = useSidebar()
  
  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 min-h-screen font-['Outfit',sans-serif] transition-colors duration-300">
      {/* Sidebar - Reconstructed with exact fidelity and collapse logic */}
      <Sidebar />
      
      {/* Main Content Area - shifts with sidebar width */}
      <main className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${isCollapsed ? 'ml-[90px]' : 'ml-[290px]'}`}>
        <Header />
        
        <div className="flex-1">
          {children}
        </div>

        {/* Footer fidelity */}
        <footer className="mt-auto border-t border-gray-200 p-6 text-center text-xs text-gray-400 dark:border-gray-800">
          Copyright © 2026 FixMyLeads - AI Sales Platform
        </footer>
      </main>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/content/discover" element={<ProtectedRoute><Layout><Discover /></Layout></ProtectedRoute>} />
              <Route path="/knowledge-graph" element={<ProtectedRoute><Layout><KnowledgeGraph /></Layout></ProtectedRoute>} />
              <Route path="/agent-memory" element={<ProtectedRoute><Layout><AgentMemory /></Layout></ProtectedRoute>} />
              <Route path="/knowledge-galaxy" element={<ProtectedRoute><Layout><KnowledgeGalaxy /></Layout></ProtectedRoute>} />
              <Route path="/agent-collaboration" element={<ProtectedRoute><Layout><AgentCollaboration /></Layout></ProtectedRoute>} />
              <Route path="/self-learning" element={<ProtectedRoute><Layout><SelfLearning /></Layout></ProtectedRoute>} />
              <Route path="/executive-dashboard" element={<ProtectedRoute><Layout><ExecutiveDashboard /></Layout></ProtectedRoute>} />
              <Route path="/system-health" element={<ProtectedRoute><Layout><SystemHealth /></Layout></ProtectedRoute>} />
              <Route path="/content/create" element={<ProtectedRoute><Layout><CreateContent /></Layout></ProtectedRoute>} />
              <Route path="/content/ads" element={<ProtectedRoute><Layout><ManageAds /></Layout></ProtectedRoute>} />
              <Route path="/content/schedule" element={<ProtectedRoute><Layout><ContentCalendar /></Layout></ProtectedRoute>} />

              <Route path="/crm" element={<ProtectedRoute><Layout><CRM /></Layout></ProtectedRoute>} />
              <Route path="/research" element={<ProtectedRoute><Layout><Research /></Layout></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
              <Route path="/funnel" element={<ProtectedRoute><Layout><Funnel /></Layout></ProtectedRoute>} />
              <Route path="/leads/outreach" element={<ProtectedRoute><Layout><Outreach /></Layout></ProtectedRoute>} />
              <Route path="/leads/voice" element={<ProtectedRoute><Layout><VoiceCalls /></Layout></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Layout><Chat /></Layout></ProtectedRoute>} />
              <Route path="/ai-team" element={<ProtectedRoute><Layout><AITeam /></Layout></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><Layout><HelpCenter /></Layout></ProtectedRoute>} />
              <Route path="/proposals" element={<ProtectedRoute><Layout><Proposals /></Layout></ProtectedRoute>} />
              <Route path="/leads/intel" element={<ProtectedRoute><Layout><LeadIntel /></Layout></ProtectedRoute>} />
              <Route path="/meetings" element={<ProtectedRoute><Layout><Meetings /></Layout></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><Layout><ClientSuccess /></Layout></ProtectedRoute>} />
              <Route path="/autopilot" element={<ProtectedRoute><Layout><Autopilot /></Layout></ProtectedRoute>} />
              <Route path="/studio/image" element={<ProtectedRoute><Layout><ImageStudio /></Layout></ProtectedRoute>} />
              <Route path="/studio/video" element={<ProtectedRoute><Layout><VideoStudio /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />

              {/* Catch-all redirect to Home for any placeholder paths */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
