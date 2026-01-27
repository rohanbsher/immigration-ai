import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Shield,
  FileCheck,
  Brain,
  Clock,
  Users,
  ArrowRight,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                IA
              </div>
              <span className="font-semibold text-xl text-foreground">Immigration AI</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Immigration Case Management
            <br />
            <span className="text-primary">Powered by AI</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Streamline your immigration practice with intelligent document
            processing, automated form filling, and secure client collaboration.
            Spend less time on paperwork, more time on what matters.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Free Trial <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Everything you need to manage immigration cases
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="Secure Document Vault"
              description="Bank-level encryption with multi-factor authentication. Your clients' sensitive documents are protected at every step."
            />
            <FeatureCard
              icon={Brain}
              title="AI Document Analysis"
              description="Automatically extract data from passports, I-94s, and more. Our AI validates documents and flags potential issues."
            />
            <FeatureCard
              icon={FileCheck}
              title="Smart Form Auto-Fill"
              description="Pre-populate USCIS forms with extracted data. Review AI suggestions and submit with confidence."
            />
            <FeatureCard
              icon={Clock}
              title="Deadline Tracking"
              description="Never miss a deadline with automated reminders. Track case timelines and priority dates in one place."
            />
            <FeatureCard
              icon={Users}
              title="Client Portal"
              description="Give clients secure access to upload documents, track progress, and communicate with your team."
            />
            <FeatureCard
              icon={FileCheck}
              title="Attorney Review"
              description="Efficient review workflow with AI confidence scores. Approve, reject, or request changes with one click."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to modernize your practice?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join immigration attorneys who are saving hours each week with
            Immigration AI.
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Get Started for Free <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                IA
              </div>
              <span className="font-medium text-foreground">Immigration AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Immigration AI. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card rounded-xl p-6 shadow-md shadow-primary/5 border border-border/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="text-primary" size={24} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
