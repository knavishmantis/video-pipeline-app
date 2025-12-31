import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "./ui/sidebar";
import { IconDashboard, IconUsers, IconCurrencyDollar, IconLogout } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

export function SidebarNav() {
  const { user, logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false); // Start collapsed

  if (!isAuthenticated) {
    return null;
  }

  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';

  // Get profile picture - emoji, image URL, or fallback
  const getProfilePicture = () => {
    if (user?.profile_picture) {
      // If it's a URL (starts with http), return it
      if (user.profile_picture.startsWith('http')) {
        return user.profile_picture;
      }
      // Otherwise it's an emoji, return it
      return user.profile_picture;
    }
    // Fallback to generated avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff&size=128&bold=true`;
  };

  const links = [
    {
      label: "Dashboard",
      href: "/",
      icon: (
        <IconDashboard className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    ...(isAdmin ? [
      {
        label: "Users",
        href: "/users",
        icon: (
          <IconUsers className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
        ),
      },
      {
        label: "Payments",
        href: "/payments",
        icon: (
          <IconCurrencyDollar className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
        ),
      },
    ] : []),
  ];

  return (
    <Sidebar open={open} setOpen={setOpen} animate={true}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <SidebarLogo />
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink key={idx} link={link} />
            ))}
          </div>
        </div>
        <div>
          <SidebarLink
            link={{
              label: user?.discord_username || user?.name || "User",
              href: "#",
              icon: (
                user?.profile_picture && !user.profile_picture.startsWith('http') ? (
                  <div className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-base bg-gray-100 dark:bg-neutral-800">
                    {user.profile_picture}
                  </div>
                ) : (
                  <img
                    src={getProfilePicture()}
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                    width={20}
                    height={20}
                    alt="Avatar"
                    style={{ display: 'block' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.discord_username || user?.name || 'User')}&background=random&size=128`;
                    }}
                  />
                )
              ),
            }}
          />
          <SidebarLink
            link={{
              label: "Logout",
              href: "#",
              icon: (
                <IconLogout className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
              ),
            }}
            className="!text-red-600 hover:!bg-red-50 hover:!text-red-700 dark:!text-red-400 dark:hover:!bg-red-900/20"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
          />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}

const SidebarLogo = () => {
  const { isExpanded } = useSidebar();

  return (
    <a
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <img
        src="/knavishmantis-profilepic.jpg"
        alt="Logo"
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
      <motion.span
        animate={{
          opacity: isExpanded ? 1 : 0,
          width: isExpanded ? 'auto' : 0,
        }}
        transition={{ duration: 0.2 }}
        className="text-base font-medium whitespace-pre text-neutral-900 dark:text-white overflow-hidden"
      >
        Knavish Video Pipeline
      </motion.span>
    </a>
  );
};

export const Logo = () => {
  return (
    <a
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-black dark:text-white"
      >
        Knavish Video Pipeline
      </motion.span>
    </a>
  );
};

export const LogoIcon = () => {
  return (
    <a
      href="/"
      className="relative z-20 flex items-center justify-center py-1 text-sm font-normal text-black"
    >
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
    </a>
  );
};
