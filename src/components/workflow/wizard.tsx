'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  isValid?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete?: () => void;
  className?: string;
  persistKey?: string;
}

export function Wizard({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  className,
  persistKey,
}: WizardProps) {
  const [direction, setDirection] = React.useState(0);

  React.useEffect(() => {
    if (persistKey) {
      localStorage.setItem(`wizard-${persistKey}`, String(currentStep));
    }
  }, [currentStep, persistKey]);

  React.useEffect(() => {
    if (persistKey) {
      const savedStep = localStorage.getItem(`wizard-${persistKey}`);
      if (savedStep !== null) {
        const step = parseInt(savedStep, 10);
        if (step >= 0 && step < steps.length) {
          onStepChange(step);
        }
      }
    }
  }, [persistKey, steps.length, onStepChange]);

  const goToStep = (step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    onStepChange(step);
  };

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => index < currentStep && goToStep(index)}
                disabled={index > currentStep}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                  index < currentStep
                    ? 'bg-primary border-primary text-primary-foreground cursor-pointer hover:bg-primary/90'
                    : index === currentStep
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-muted-foreground/30 text-muted-foreground cursor-not-allowed'
                )}
              >
                {index < currentStep ? (
                  <Check size={18} />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 transition-colors duration-300',
                    index < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <CardTitle>{currentStepData.title}</CardTitle>
        {currentStepData.description && (
          <CardDescription>{currentStepData.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="relative min-h-[200px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
          >
            {currentStepData.content}
          </motion.div>
        </AnimatePresence>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft size={16} />
          Previous
        </Button>
        <Button
          onClick={goNext}
          disabled={currentStepData.isValid === false}
          className="gap-2"
        >
          {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
          {currentStep < steps.length - 1 && <ChevronRight size={16} />}
        </Button>
      </CardFooter>
    </Card>
  );
}
