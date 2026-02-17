'use client';

interface ReviewStepProps {
  isNewClient: boolean;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  visaType: string;
  title: string;
  deadline: string;
  priorityDate: string;
  description: string;
}

export function ReviewStep({
  isNewClient,
  clientFirstName,
  clientLastName,
  clientEmail,
  visaType,
  title,
  deadline,
  priorityDate,
  description,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Review Case</h2>
        <p className="text-slate-600">
          Review the case details before creating.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-slate-50">
          <h3 className="font-medium text-slate-700 mb-2">Client</h3>
          <p className="text-slate-900">
            {isNewClient
              ? `${clientFirstName} ${clientLastName}`
              : 'Existing client selected'}
          </p>
          {clientEmail && (
            <p className="text-sm text-slate-600">{clientEmail}</p>
          )}
        </div>

        <div className="p-4 rounded-lg bg-slate-50">
          <h3 className="font-medium text-slate-700 mb-2">Case Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Visa Type</p>
              <p className="font-medium">{visaType}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Title</p>
              <p className="font-medium">{title}</p>
            </div>
            {deadline && (
              <div>
                <p className="text-sm text-slate-500">Deadline</p>
                <p className="font-medium">
                  {new Date(deadline).toLocaleDateString()}
                </p>
              </div>
            )}
            {priorityDate && (
              <div>
                <p className="text-sm text-slate-500">Priority Date</p>
                <p className="font-medium">
                  {new Date(priorityDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          {description && (
            <div className="mt-4">
              <p className="text-sm text-slate-500">Description</p>
              <p className="text-slate-900">{description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
