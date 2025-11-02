'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Navbar() {
  return (
    <nav className="border-b border-white/20 shadow-sm" style={{ backgroundColor: '#121212' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-white">
              Julie
            </Link>
          </div>
          <div className="flex items-center space-x-8">
            <Link href="/about" className="text-gray-300 hover:text-white transition-colors">
              About
            </Link>
            <ConnectButton chainStatus="none" showBalance={false} />
          </div>
        </div>
      </div>
    </nav>
  );
}
