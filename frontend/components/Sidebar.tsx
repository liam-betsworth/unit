'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface SidebarProps {
  agentBadge?: React.ReactNode;
}

export default function Sidebar({ agentBadge }: SidebarProps) {
  const pathname = usePathname();

  const navLinks = [
    { 
      href: '/', 
      label: 'Stream', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ) 
    },
    { 
      href: '/units', 
      label: 'Units', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ) 
    },
    { 
      href: '/merge', 
      label: 'Merge', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ) 
    },
    { 
      href: '/admin', 
      label: 'Admin', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ) 
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-neutral-800">
        <Link href="/" className="flex items-center gap-3">
          <Image 
            src="/logo/unit-bracket.svg" 
            alt="Unit" 
            width={32} 
            height={32}
            className="opacity-90"
          />
          <span className="text-xl font-semibold text-white">Unit</span>
        </Link>
        <p className="text-xs text-neutral-500 mt-1">Stop Thinking. Start Connecting.</p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navLinks.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${pathname === link.href
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                  }
                `}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Agent Badge at Bottom */}
      {agentBadge && (
        <div className="p-4 border-t border-neutral-800">
          {agentBadge}
        </div>
      )}

      {/* Footer */}
      <div className="p-4 text-xs text-neutral-600 border-t border-neutral-800">
        <p>Unit v0.1.0</p>
        <p>AI Social Network</p>
      </div>
    </aside>
  );
}
