"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface BeamOptions {
  initialX?: number;
  translateX?: number;
  initialY?: number | string;
  translateY?: number | string;
  rotate?: number;
  className?: string;
  duration?: number;
  delay?: number;
  repeatDelay?: number;
}

interface BackgroundBeamsWithCollisionProps {
  children: React.ReactNode;
  className?: string;
}

export function BackgroundBeamsWithCollision({
  children,
  className,
}: BackgroundBeamsWithCollisionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [beams, setBeams] = useState<BeamOptions[]>([]);

  useEffect(() => {
    // Generate multiple beams with different configurations
    const beamConfigs: BeamOptions[] = [
      {
        initialX: 10,
        translateX: 0,
        initialY: "-200px",
        translateY: "calc(100vh + 200px)",
        rotate: 0,
        duration: 8,
        delay: 0,
        repeatDelay: 0,
      },
      {
        initialX: 30,
        translateX: 0,
        initialY: "-200px",
        translateY: "calc(100vh + 200px)",
        rotate: 2,
        duration: 10,
        delay: 1,
        repeatDelay: 0,
      },
      {
        initialX: 50,
        translateX: 0,
        initialY: "-200px",
        translateY: "calc(100vh + 200px)",
        rotate: -2,
        duration: 9,
        delay: 2,
        repeatDelay: 0,
      },
      {
        initialX: 70,
        translateX: 0,
        initialY: "-200px",
        translateY: "calc(100vh + 200px)",
        rotate: 3,
        duration: 11,
        delay: 0.5,
        repeatDelay: 0,
      },
      {
        initialX: 90,
        translateX: 0,
        initialY: "-200px",
        translateY: "calc(100vh + 200px)",
        rotate: -3,
        duration: 12,
        delay: 1.5,
        repeatDelay: 0,
      },
    ];
    setBeams(beamConfigs);
  }, []);

  return (
    <div
      ref={parentRef}
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black",
        className
      )}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.02))",
        }}
      >
        {beams.map((beam, index) => (
          <Beam key={index} beamOptions={beam} />
        ))}
      </div>
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}

function Beam({ beamOptions }: { beamOptions: BeamOptions }) {
  const {
    initialX = 0,
    translateX = 0,
    initialY = "-200px",
    translateY = "calc(100vh + 200px)",
    rotate = 0,
    className,
    duration = 8,
    delay = 0,
    repeatDelay = 0,
  } = beamOptions;

  return (
    <motion.div
      className={cn(
        "absolute h-[2px] w-[200px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-40 blur-[1px]",
        className
      )}
      initial={{
        x: `${initialX}%`,
        y: initialY,
        rotate: rotate,
      }}
      animate={{
        x: `${initialX}%`,
        y: translateY,
        rotate: rotate,
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        repeatDelay: repeatDelay,
        ease: "linear",
      }}
    />
  );
}
