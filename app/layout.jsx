import './globals.css'; // Global Styles
import { WebSocketProvider } from '@/components/WebSocketProvider';
import { ToastProvider } from '@/components/ToastSystem';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'XAU/USD Gold Scalper',
  description: 'Institutional Gold Scalping Intelligence System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-bg-primary text-text-primary antialiased min-h-screen flex flex-col`}>
        <ToastProvider>
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
