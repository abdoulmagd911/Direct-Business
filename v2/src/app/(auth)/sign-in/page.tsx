import type { Metadata } from 'next';
import { SignIn } from '@/modules/org/screens/SignIn';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <SignIn next={next ?? '/my-day'} />;
}
