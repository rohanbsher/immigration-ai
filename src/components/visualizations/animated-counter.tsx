'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useSpring, useTransform, useInView } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({
  value,
  duration = 1,
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const hasAnimatedRef = useRef(false);

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const display = useTransform(spring, (current) => {
    return Math.round(current);
  });

  const [displayValue, setDisplayValue] = useState(0);

  const animateValue = useCallback(() => {
    if (isInView && !hasAnimatedRef.current) {
      spring.set(value);
      hasAnimatedRef.current = true;
    }
  }, [isInView, value, spring]);

  useEffect(() => {
    animateValue();
  }, [animateValue]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return () => unsubscribe();
  }, [display]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </motion.span>
  );
}
