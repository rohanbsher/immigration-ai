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
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <FileQuestion className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl text-slate-900">
            Page Not Found
          </CardTitle>
          <CardDescription className="text-slate-600">
            The page you are looking for does not exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-7xl font-bold text-slate-200">404</p>
            <p className="text-sm text-slate-500">
              Check the URL for typos, or navigate using the links below.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="gap-2 w-full">
              <Home size={16} />
              Go Home
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="gap-2 w-full">
              <ArrowLeft size={16} />
              Dashboard
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
