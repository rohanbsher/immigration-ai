import QRCode from 'qrcode';
import { createLogger } from '@/lib/logger';

const log = createLogger('2fa');

export async function generateQRCodeDataURL(uri: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (error) {
    log.logError('Failed to generate QR code', error);
    throw new Error('Failed to generate QR code');
  }
}

export async function generateQRCodeSVG(uri: string): Promise<string> {
  try {
    const svg = await QRCode.toString(uri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    });
    return svg;
  } catch (error) {
    log.logError('Failed to generate QR code SVG', error);
    throw new Error('Failed to generate QR code');
  }
}
