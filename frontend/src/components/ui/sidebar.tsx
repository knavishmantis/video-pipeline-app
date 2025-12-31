"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExpanded: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

interface SidebarProviderProps {
  children: ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SidebarProvider = ({ children, open: openProp, setOpen: setOpenProp, isExpanded: isExpandedProp }: SidebarProviderProps & { isExpanded?: boolean }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setInternalOpen;
  const isExpanded = isExpandedProp !== undefined ? isExpandedProp : open;

  return (
    <SidebarContext.Provider value={{ open, setOpen, isExpanded }}>
      {children}
    </SidebarContext.Provider>
  );
};

interface SidebarProps {
  children: ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}

export const Sidebar = ({ children, open: openProp, setOpen: setOpenProp, animate = true }: SidebarProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setInternalOpen;
  
  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // On desktop, expand on hover if closed. On mobile, only expand if explicitly open
  const isExpanded = isMobile ? open : (open || isHovered);

  return (
    <SidebarProvider open={open} setOpen={setOpen} isExpanded={isExpanded}>
      <div 
        className="relative flex h-full"
        onMouseEnter={() => {
          if (!isMobile) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (!isMobile) {
            setIsHovered(false);
          }
        }}
      >
        {/* Mobile overlay */}
        <AnimatePresence>
          {open && isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: animate ? 0.2 : 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setOpen(false)}
            />
          )}
        </AnimatePresence>
        
        {/* Sidebar - always visible, just collapsed/expanded */}
        <motion.div
          animate={{
            width: isExpanded ? 280 : 80,
          }}
          transition={{ duration: animate ? 0.3 : 0, ease: "easeInOut" }}
          className="relative h-full bg-gray-100 flex-shrink-0 overflow-hidden"
        >
          {children}
        </motion.div>
        
        {/* Mobile menu button */}
        {!open && isMobile && (
          <button
            onClick={() => setOpen(true)}
            className="fixed left-4 top-4 z-50 rounded-lg bg-white p-2 shadow-lg"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M2.5 5H17.5M2.5 10H17.5M2.5 15H17.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </SidebarProvider>
  );
};

interface SidebarBodyProps extends React.ComponentProps<typeof motion.div> {
  children: ReactNode;
}

export const SidebarBody = ({ children, className, ...props }: SidebarBodyProps) => {
  return (
    <motion.div
      className={cn("flex h-full flex-col p-4", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface SidebarLinkProps {
  link: {
    label: string;
    href: string;
    icon: React.ReactNode;
  };
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const SidebarLink = ({ link, className, onClick }: SidebarLinkProps) => {
  const { open, setOpen, isExpanded } = useSidebar();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
    
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
    
  const isActive = typeof window !== 'undefined' && window.location.pathname === link.href;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      onClick(e);
    } else if (link.href.startsWith('/')) {
      navigate(link.href);
    } else if (link.href !== '#') {
      window.location.href = link.href;
    }
    // Only close on mobile
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <a
      href={link.href}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer relative",
        isActive
          ? "bg-neutral-100 text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
        className
      )}
      title={!isExpanded ? link.label : undefined}
    >
      <span className="flex-shrink-0">{link.icon}</span>
      <motion.span
        animate={{
          opacity: isExpanded ? 1 : 0,
          width: isExpanded ? 'auto' : 0,
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden whitespace-nowrap"
      >
        {link.label}
      </motion.span>
    </a>
  );
};
