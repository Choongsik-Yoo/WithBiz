import type { Metadata, Viewport } from 'next';
import './globals.css';
import { config } from '@/lib/config';
export const metadata: Metadata = {
  title: 'WithBiz AI | 정부지원사업 매칭 플랫폼',
  description: '흩어진 정부지원사업을 한곳에서. 기업 조건에 맞는 지원사업을 찾고 마감을 관리하세요.',
  manifest: `${config.basePath}/manifest.webmanifest`,
  icons: { icon: `${config.basePath}/icon.svg` },
};
export const viewport: Viewport = { themeColor: '#173171', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
