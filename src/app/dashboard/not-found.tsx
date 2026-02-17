import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { FolderSearch, ArrowLeft } from 'lucide-react';

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <FolderSearch className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Resource Not Found
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            The case, document, or resource you requested could not be found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-6xl font-bold text-muted">404</p>
            <p className="text-sm text-muted-foreground">
              It may have been deleted or you may not have permission to view
              it.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="gap-2 w-full">
              <ArrowLeft size={16} />
              Back to Dashboard
            </Button>
          </Link>
          <Link href="/dashboard/cases" className="w-full sm:w-auto">
            <Button variant="outline" className="gap-2 w-full">
              View Cases
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
