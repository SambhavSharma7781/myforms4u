import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";

interface FloatingActionButtonProps {
  isSignedIn?: boolean;
}

export default function FloatingActionButton({ isSignedIn = false }: FloatingActionButtonProps) {
  if (isSignedIn) {
    return (
      <Link href="/forms/create">
        <button
          aria-label="Create new form"
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-2xl hover:shadow-3xl w-16 h-16 flex items-center justify-center transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 animate-pulse hover:animate-none"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </Link>
    );
  }

  return (
    <SignInButton mode="modal">
      <button
        aria-label="Create new form"
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-2xl hover:shadow-3xl w-16 h-16 flex items-center justify-center transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 animate-pulse hover:animate-none"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </SignInButton>
  );
}