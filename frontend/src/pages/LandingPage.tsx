"use client";
import { cn } from "@/lib/utils";
import { Spotlight } from "@/components/ui/spotlight-new";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";
import { motion } from "motion/react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import CamIcon from "@/assets/cam.svg";
import { API_BASE_URL } from "@/utils/interviewUtils";

export default function LandingPage() {
  const navigate = useNavigate();
  const [hasInterviews, setHasInterviews] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/interviews`)
      .then(response => response.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setHasInterviews(true);
        }
      })
      .catch(error => console.error('Error fetching interviews:', error));
  }, []);

  const buttonText = hasInterviews ? "Go to dashboard" : "Add interview";

  const handleButtonClick = () => {
    if (hasInterviews) {
      navigate("/dashboard");
      return;
    }

    navigate("/dashboard", { state: { openAddModal: true } });
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/[0.96] antialiased overflow-hidden">
      <div
        className={cn(
          "absolute inset-0",
          "[background-size:40px_40px]",
          "[background-image:linear-gradient(to_right,rgba(228,228,231,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(228,228,231,0.1)_1px,transparent_1px)]",
          "dark:[background-image:linear-gradient(to_right,rgba(38,38,38,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(38,38,38,0.1)_1px,transparent_1px)]",
        )}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/[0.96] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <Spotlight />
      <div className="relative flex flex-col items-center justify-center gap-6 text-center px-6">
        <motion.div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <LayoutTextFlip
            text="Welcome to "
            words={["Midnight Investigator", "camspy", "straight up temu", "leo is guilty detector"]}
          />
        </motion.div>
        <p className="mt-1 text-center text-base text-neutral-600 dark:text-neutral-400">
          The ultimate tool to find out who killed your aunt.
        </p>
        <div className="mt-3 flex justify-center">
          <HoverBorderGradient
            containerClassName="rounded-full group"
            as="button"
            className="bg-black text-white flex items-center relative overflow-hidden"
            onClick={handleButtonClick}
          >
            <div className="flex items-center group-hover:translate-x-40 transition duration-500 z-10">
              <img src={CamIcon} alt="cam" className="w-3 h-3 mr-2" />
              <span>{buttonText}</span>
            </div>
            <div className="-translate-x-40 group-hover:translate-x-0 flex items-center justify-center absolute inset-0 transition duration-500 text-white z-20">
              ➡️
            </div>
          </HoverBorderGradient>
        </div>

      </div>

    </div>
  );
}