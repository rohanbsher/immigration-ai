import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './base';

type BillingEventType =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'trial_ending';

interface BillingUpdateEmailProps {
  userName: string;
  eventType: BillingEventType;
  planName?: string;
  amount?: number;
  currency?: string;
  nextBillingDate?: string;
  trialEndDate?: string;
  billingUrl: string;
}

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#1a1a1a',
  marginBottom: '24px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#484848',
  marginBottom: '16px',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  marginTop: '24px',
  marginBottom: '24px',
};

const successBox = {
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  marginBottom: '16px',
  borderLeft: '4px solid #22c55e',
};

const warningBox = {
  backgroundColor: '#fffbeb',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  marginBottom: '16px',
  borderLeft: '4px solid #f59e0b',
};

const errorBox = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '16px',
  marginBottom: '16px',
  borderLeft: '4px solid #ef4444',
};

const boxTitle = {
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '8px',
};

const boxText = {
  fontSize: '14px',
  marginBottom: '4px',
};

const EVENT_CONFIG: Record<
  BillingEventType,
  { title: string; getPreview: (props: BillingUpdateEmailProps) => string }
> = {
  subscription_created: {
    title: 'Welcome to Your New Plan!',
    getPreview: (props) => `Your ${props.planName} subscription is now active`,
  },
  subscription_updated: {
    title: 'Subscription Updated',
    getPreview: (props) => `Your subscription has been changed to ${props.planName}`,
  },
  subscription_cancelled: {
    title: 'Subscription Cancelled',
    getPreview: () => 'Your subscription has been cancelled',
  },
  payment_succeeded: {
    title: 'Payment Received',
    getPreview: () => 'Thank you for your payment',
  },
  payment_failed: {
    title: 'Payment Failed',
    getPreview: () => 'We were unable to process your payment',
  },
  trial_ending: {
    title: 'Your Trial is Ending Soon',
    getPreview: () => 'Your trial period is ending soon',
  },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function BillingUpdateEmail(props: BillingUpdateEmailProps) {
  const {
    userName,
    eventType,
    planName,
    amount,
    currency = 'usd',
    nextBillingDate,
    trialEndDate,
    billingUrl,
  } = props;

  const config = EVENT_CONFIG[eventType];
  const previewText = config.getPreview(props);

  const renderContent = () => {
    switch (eventType) {
      case 'subscription_created':
        return (
          <>
            <Text style={paragraph}>
              Thank you for subscribing to CaseFill! Your {planName} plan is now active.
            </Text>
            <div style={successBox}>
              <Text style={{ ...boxTitle, color: '#166534' }}>Subscription Active</Text>
              <Text style={{ ...boxText, color: '#15803d' }}>Plan: {planName}</Text>
              {amount && (
                <Text style={{ ...boxText, color: '#15803d' }}>
                  Amount: {formatCurrency(amount, currency)}
                </Text>
              )}
              {nextBillingDate && (
                <Text style={{ ...boxText, color: '#15803d' }}>
                  Next billing date: {nextBillingDate}
                </Text>
              )}
            </div>
          </>
        );

      case 'subscription_updated':
        return (
          <>
            <Text style={paragraph}>
              Your subscription has been updated to the {planName} plan.
            </Text>
            <div style={successBox}>
              <Text style={{ ...boxTitle, color: '#166534' }}>Plan Changed</Text>
              <Text style={{ ...boxText, color: '#15803d' }}>New plan: {planName}</Text>
              {nextBillingDate && (
                <Text style={{ ...boxText, color: '#15803d' }}>
                  Effective from: {nextBillingDate}
                </Text>
              )}
            </div>
          </>
        );

      case 'subscription_cancelled':
        return (
          <>
            <Text style={paragraph}>
              Your subscription has been cancelled. You will continue to have access to your current
              plan features until the end of your billing period.
            </Text>
            <div style={warningBox}>
              <Text style={{ ...boxTitle, color: '#92400e' }}>Subscription Ending</Text>
              {nextBillingDate && (
                <Text style={{ ...boxText, color: '#b45309' }}>
                  Access until: {nextBillingDate}
                </Text>
              )}
            </div>
            <Text style={paragraph}>
              Changed your mind? You can reactivate your subscription at any time from your billing
              settings.
            </Text>
          </>
        );

      case 'payment_succeeded':
        return (
          <>
            <Text style={paragraph}>
              We have successfully processed your payment. Thank you for your continued support!
            </Text>
            <div style={successBox}>
              <Text style={{ ...boxTitle, color: '#166534' }}>Payment Confirmed</Text>
              {amount && (
                <Text style={{ ...boxText, color: '#15803d' }}>
                  Amount: {formatCurrency(amount, currency)}
                </Text>
              )}
              {nextBillingDate && (
                <Text style={{ ...boxText, color: '#15803d' }}>
                  Next billing date: {nextBillingDate}
                </Text>
              )}
            </div>
          </>
        );

      case 'payment_failed':
        return (
          <>
            <Text style={paragraph}>
              We were unable to process your payment. Please update your payment method to continue
              using CaseFill.
            </Text>
            <div style={errorBox}>
              <Text style={{ ...boxTitle, color: '#991b1b' }}>Action Required</Text>
              <Text style={{ ...boxText, color: '#b91c1c' }}>
                Please update your payment method to avoid service interruption.
              </Text>
            </div>
          </>
        );

      case 'trial_ending':
        return (
          <>
            <Text style={paragraph}>
              Your free trial is ending soon. Subscribe now to continue using all CaseFill
              features without interruption.
            </Text>
            <div style={warningBox}>
              <Text style={{ ...boxTitle, color: '#92400e' }}>Trial Ending</Text>
              {trialEndDate && (
                <Text style={{ ...boxText, color: '#b45309' }}>
                  Trial ends: {trialEndDate}
                </Text>
              )}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <BaseEmail previewText={previewText}>
      <Heading style={heading}>{config.title}</Heading>

      <Text style={paragraph}>Hi {userName},</Text>

      {renderContent()}

      <Button href={billingUrl} style={button}>
        {eventType === 'payment_failed' ? 'Update Payment Method' : 'View Billing Details'}
      </Button>

      <Text style={paragraph}>
        Best regards,
        <br />
        The CaseFill Team
      </Text>
    </BaseEmail>
  );
}
