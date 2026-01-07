import {
  IconBrandGithub,
  IconFileText,
  IconHome,
  IconMicrophone,
  IconBroadcast,
} from "@tabler/icons-react";

export function getDockItems(
  onAddClick: () => void,
  onStoryClick: () => void,
  onLiveClick: () => void
) {
  return [
    {
      title: "Dashboard",
      icon: <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
    },
    {
      title: "Add interview",
      icon: <IconMicrophone className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      onClick: onAddClick,
    },
    {
      title: "Storyline",
      icon: <IconFileText className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      onClick: onStoryClick,
    },
    {
      title: "Live tools",
      icon: <IconBroadcast className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      onClick: onLiveClick,
    },
    {
      title: "GitHub",
      icon: <IconBrandGithub className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "https://github.com/MauroDruwel/Midnight-Investigator",
    },
  ];
}