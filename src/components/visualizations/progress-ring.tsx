'use client';

import { motion, useSpring, useTransform, useInView } from 'motion/react';
import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  showValue?: boolean;
}

export function ProgressRing({
  value,
  max = 100,
  size = 120,
  strokeWidth = 10,
  className = '',
  label,
  showValue = true,
}: ProgressRingProps) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const hasAnimatedRef = useRef(false);

  const normalizedValue = Math.min(Math.max(value, 0), max);
  const percentage = (normalizedValue / max) * 100;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const spring = useSpring(circumference, {
    duration: 1000,
    bounce: 0,
  });

  const strokeDashoffset = useTransform(spring, (v) => v);

  const animateProgress = useCallback(() => {
    if (isInView && !hasAnimatedRef.current) {
      const targetOffset = circumference - (percentage / 100) * circumference;
      spring.set(targetOffset);
      hasAnimatedRef.current = true;
    }
  }, [isInView, percentage, circumference, spring]);

  useEffect(() => {
    animateProgress();
  }, [animateProgress]);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <svg
        ref={ref}
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          className="text-primary"
        />
      </svg>
      {showValue && (
        <motion.span
          className="absolute text-2xl font-bold text-foreground"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {Math.round(percentage)}%
        </motion.span>
      )}
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
