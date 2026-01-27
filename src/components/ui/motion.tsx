'use client';

import * as React from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';

// Fade in animation
const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// Scale and fade animation
const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

// Slide up animation
const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Staggered children animation
const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface MotionCardProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
  delay?: number;
}

export function MotionCard({ children, className, delay = 0, ...props }: MotionCardProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={scaleVariants}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={cn('', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface MotionListProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
}

export function MotionList({ children, className, ...props }: MotionListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
      className={cn('', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface MotionListItemProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
}

export function MotionListItem({ children, className, ...props }: MotionListItemProps) {
  return (
    <motion.div
      variants={staggerItemVariants}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface MotionPageProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
}

export function MotionPage({ children, className, ...props }: MotionPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn('', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface MotionFadeInProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
  delay?: number;
}

export function MotionFadeIn({ children, className, delay = 0, ...props }: MotionFadeInProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={cn('', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface MotionSlideUpProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
  delay?: number;
}

export function MotionSlideUp({ children, className, delay = 0, ...props }: MotionSlideUpProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={slideUpVariants}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={cn('', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence, motion };
