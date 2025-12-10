import QRCode from 'qrcode';

export async function generateQRCode(url: string, container: HTMLElement): Promise<void> {
  try {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Clear container and add canvas
    container.innerHTML = '';
    container.appendChild(canvas);
  } catch (error) {
    console.error('Error generating QR code:', error);
    container.innerHTML = '<p style="color: white;">Error generating QR code</p>';
  }
}


