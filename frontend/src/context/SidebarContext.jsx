import React, { createContext, useContext, useState } from 'react'

const SidebarContext = createContext({
  isCollapsed: false,
  toggleSidebar: () => {},
})

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev)
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
