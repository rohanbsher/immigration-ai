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
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  IA
                </div>
                <span className="font-semibold text-xl text-foreground">Immigration AI</span>
              </div>
              <div className="hidden md:flex items-center gap-6">
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
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

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-8 pt-8 border-t border-border/50">
            <TrustBadge icon={Shield} text="SOC 2 Compliant" />
            <TrustBadge icon={Lock} text="256-bit Encryption" />
            <TrustBadge icon={Award} text="AILA Recommended" />
            <TrustBadge icon={CheckCircle} text="HIPAA Ready" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/50">
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

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Get started in minutes. Our streamlined workflow helps you process cases faster than ever.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              step={1}
              title="Upload Documents"
              description="Clients securely upload passports, visas, and supporting documents through the client portal."
            />
            <StepCard
              step={2}
              title="AI Extracts Data"
              description="Our AI automatically reads and extracts key information, pre-filling USCIS forms with high accuracy."
            />
            <StepCard
              step={3}
              title="Review & Submit"
              description="Review AI suggestions with confidence scores, make any adjustments, and submit error-free applications."
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Trusted by Immigration Attorneys
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            See why leading immigration practices choose Immigration AI to streamline their workflows.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="Immigration AI has transformed how we handle H-1B cases. What used to take hours now takes minutes."
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
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
            Start free with up to 5 cases. Upgrade as your practice grows.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              plan="Starter"
              price="Free"
              description="Perfect for trying out Immigration AI"
              features={[
                'Up to 5 active cases',
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
              description="For growing immigration practices"
              features={[
                'Up to 50 active cases',
                'Advanced AI extraction',
                'Form auto-fill',
                'Priority support',
                'Custom branding',
              ]}
              cta="Start Free Trial"
              ctaVariant="default"
              highlighted
            />
            <PricingCard
              plan="Enterprise"
              price="Custom"
              description="For large firms with custom needs"
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
      <footer className="border-t border-border/50 py-16 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  IA
                </div>
                <span className="font-semibold text-lg text-foreground">Immigration AI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered immigration case management for modern law practices.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/ai-disclaimer" className="hover:text-foreground transition-colors">AI & Security</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Compliance</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:support@immigrationai.app" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="mailto:support@immigrationai.app" className="hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Immigration AI. All rights reserved.
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
    <div className="bg-card rounded-xl p-6 shadow-md shadow-primary/5 border border-border/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="text-primary" size={24} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
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
      <Icon size={20} className="text-primary" />
      <span className="text-sm font-medium">{text}</span>
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
      <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
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
    <div className="bg-card rounded-xl p-6 shadow-md shadow-primary/5 border border-border/50">
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} size={18} className="text-warning fill-warning" />
        ))}
      </div>
      <p className="text-foreground mb-4 italic">&ldquo;{quote}&rdquo;</p>
      <div>
        <p className="font-semibold text-foreground">{author}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
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
      className={`rounded-xl p-6 border ${
        highlighted
          ? 'bg-primary/5 border-primary shadow-lg shadow-primary/10 ring-2 ring-primary'
          : 'bg-card border-border/50 shadow-md shadow-primary/5'
      }`}
    >
      <h3 className="text-lg font-semibold text-foreground mb-1">{plan}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="mb-6">
        <span className="text-4xl font-bold text-foreground">{price}</span>
        {period && <span className="text-muted-foreground">{period}</span>}
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <CheckCircle size={16} className="text-primary shrink-0" />
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
