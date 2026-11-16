"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface ArrowLeftRightIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface ArrowLeftRightIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const TOP_VARIANTS: Variants = {
  normal: { translateX: 0 },
  animate: {
    translateX: [0, 3, 0],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
};

const BOTTOM_VARIANTS: Variants = {
  normal: { translateX: 0 },
  animate: {
    translateX: [0, -3, 0],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
};

const ArrowLeftRightIcon = forwardRef<ArrowLeftRightIconHandle, ArrowLeftRightIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.g animate={controls} initial="normal" variants={TOP_VARIANTS}>
            <path d="m16 3 4 4-4 4" />
            <path d="M20 7H4" />
          </motion.g>
          <motion.g animate={controls} initial="normal" variants={BOTTOM_VARIANTS}>
            <path d="m8 21-4-4 4-4" />
            <path d="M4 17h16" />
          </motion.g>
        </svg>
      </div>
    );
  }
);

ArrowLeftRightIcon.displayName = "ArrowLeftRightIcon";

export { ArrowLeftRightIcon };
