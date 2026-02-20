import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Shield,
  FileCheck,
  Brain,
  Clock,
  Users,
  ArrowRight,
  CheckCircle,
  Star,
  Lock,
  Award,
  Sparkles,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Sparkles className="text-primary-foreground" size={16} />
                </div>
                <span className="font-display text-lg tracking-tight text-foreground">
                  CaseFill
                </span>
              </Link>
              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
                <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </a>
                <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Testimonials
                </a>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.35_0.12_250/0.08),transparent)]" />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-8 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
            <p className="text-sm font-medium tracking-widest uppercase text-accent mb-6">
              AI-Powered Case Management
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6 leading-[1.1]">
              Practice immigration law with{' '}
              <span className="text-primary italic">confidence</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Streamline visa applications, automate document processing, and
              manage your entire caseload from one intelligent platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/register">
                <Button size="lg" className="gap-2 px-8">
                  Start Free Trial <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="px-8">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4 pt-10 border-t border-border/40">
              <TrustBadge icon={Shield} text="SOC 2 Compliant" />
              <TrustBadge icon={Lock} text="256-bit Encryption" />
              <TrustBadge icon={Award} text="AILA Recommended" />
              <TrustBadge icon={CheckCircle} text="HIPAA Ready" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">
              Platform Features
            </p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-foreground">
              Everything your practice needs
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Shield}
              title="Secure Document Vault"
              description="Bank-level encryption with multi-factor authentication protects every document at rest and in transit."
            />
            <FeatureCard
              icon={Brain}
              title="AI Document Analysis"
              description="Automatically extract data from passports, I-94s, and supporting documents with high accuracy."
            />
            <FeatureCard
              icon={FileCheck}
              title="Smart Form Auto-Fill"
              description="Pre-populate USCIS forms with extracted data. Review AI suggestions before submission."
            />
            <FeatureCard
              icon={Clock}
              title="Deadline Tracking"
              description="Automated reminders for filing deadlines, priority dates, and case milestones."
            />
            <FeatureCard
              icon={Users}
              title="Client Portal"
              description="Secure access for clients to upload documents, track progress, and communicate with your team."
            />
            <FeatureCard
              icon={FileCheck}
              title="Attorney Review"
              description="Efficient review workflow with AI confidence scores. Approve or flag issues with one click."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">
              Simple Workflow
            </p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-foreground mb-4">
              From upload to submission
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Get started in minutes with a streamlined three-step process.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto">
            <StepCard
              step={1}
              title="Upload Documents"
              description="Clients securely upload passports, visas, and supporting documents through the portal."
            />
            <StepCard
              step={2}
              title="AI Extracts Data"
              description="Our AI reads and extracts key information, pre-filling USCIS forms automatically."
            />
            <StepCard
              step={3}
              title="Review & Submit"
              description="Review AI suggestions with confidence scores, adjust as needed, and submit."
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">
              Testimonials
            </p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-foreground">
              Trusted by immigration attorneys
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <TestimonialCard
              quote="CaseFill has transformed how we handle H-1B cases. What used to take hours now takes minutes."
              author="Sarah Chen"
              title="Partner, Chen Immigration Law"
              rating={5}
            />
            <TestimonialCard
              quote="The AI document extraction is remarkably accurate. We've reduced data entry errors by over 90%."
              author="Michael Rodriguez"
              title="Managing Attorney, Rodriguez & Associates"
              rating={5}
            />
            <TestimonialCard
              quote="My clients love the portal. They can track their case progress 24/7, which means fewer status update calls."
              author="Emily Thompson"
              title="Solo Practitioner"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">
              Pricing
            </p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Start free with up to 3 cases. Upgrade as your practice grows.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <PricingCard
              plan="Free"
              price="$0"
              description="Try CaseFill risk-free"
              features={[
                'Up to 3 active cases',
                'Basic document analysis',
                'Client portal access',
                'Email support',
              ]}
              cta="Get Started"
              ctaVariant="outline"
            />
            <PricingCard
              plan="Professional"
              price="$99"
              period="/month"
              description="For growing practices"
              features={[
                'Up to 50 active cases',
                'Advanced AI extraction',
                'Form auto-fill',
                'Priority support',
                'Team collaboration',
              ]}
              cta="Start Free Trial"
              ctaVariant="default"
              highlighted
            />
            <PricingCard
              plan="Enterprise"
              price="Custom"
              description="For large firms"
              features={[
                'Unlimited cases',
                'Dedicated account manager',
                'API access',
                'SSO integration',
                'Custom SLA',
              ]}
              cta="Contact Sales"
              ctaVariant="outline"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-8 bg-primary/[0.03]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl tracking-tight text-foreground mb-4">
            Ready to modernize your practice?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
            Join immigration attorneys who are saving hours each week with
            intelligent case management.
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2 px-8">
              Get Started for Free <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-16 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                  <Sparkles className="text-primary-foreground" size={14} />
                </div>
                <span className="font-display text-base tracking-tight text-foreground">
                  CaseFill
                </span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered immigration case management for modern law practices.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/ai-disclaimer" className="hover:text-foreground transition-colors">AI & Security</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Compliance</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="mailto:support@casefill.ai" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="mailto:support@casefill.ai" className="hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} CaseFill. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            </div>
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
    <div className="group bg-card rounded-xl p-6 border border-border/40 hover:border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
      <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/12 transition-colors">
        <Icon className="text-primary" size={20} />
      </div>
      <h3 className="font-display text-lg text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function TrustBadge({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon size={16} className="text-primary/70" />
      <span className="text-xs font-medium tracking-wide uppercase">{text}</span>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full border-2 border-primary/20 text-primary flex items-center justify-center text-lg font-display mx-auto mb-5">
        {step}
      </div>
      <h3 className="font-display text-lg text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({
  quote,
  author,
  title,
  rating,
}: {
  quote: string;
  author: string;
  title: string;
  rating: number;
}) {
  return (
    <div className="bg-card rounded-xl p-6 border border-border/40">
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} size={14} className="text-accent fill-accent" />
        ))}
      </div>
      <p className="text-foreground mb-5 leading-relaxed">&ldquo;{quote}&rdquo;</p>
      <div>
        <p className="font-medium text-sm text-foreground">{author}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
      </div>
    </div>
  );
}

function PricingCard({
  plan,
  price,
  period,
  description,
  features,
  cta,
  ctaVariant,
  highlighted,
}: {
  plan: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaVariant: 'default' | 'outline';
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-6 border transition-shadow ${
        highlighted
          ? 'bg-primary/[0.03] border-primary/30 shadow-lg shadow-primary/5 ring-1 ring-primary/20'
          : 'bg-card border-border/40 hover:shadow-md'
      }`}
    >
      <h3 className="font-display text-lg text-foreground mb-1">{plan}</h3>
      <p className="text-sm text-muted-foreground mb-5">{description}</p>
      <div className="mb-6">
        <span className="font-display text-4xl tracking-tight text-foreground">{price}</span>
        {period && <span className="text-sm text-muted-foreground ml-1">{period}</span>}
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            <CheckCircle size={15} className="text-primary/70 shrink-0" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
      <Link href="/register" className="block">
        <Button variant={ctaVariant} className="w-full">
          {cta}
        </Button>
      </Link>
    </div>
  );
}
