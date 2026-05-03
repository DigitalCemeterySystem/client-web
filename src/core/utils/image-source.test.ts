import {
  extractGoogleDriveFileId,
  normalizeExternalImageUrl,
  resolveImageSource,
} from './image-source';

describe('image-source utilities', () => {
  it('extracts Google Drive file ids from share links', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/file/d/abc_DEF-123456789012345678901234/view')).toBe(
      'abc_DEF-123456789012345678901234'
    );
  });

  it('normalizes bare domains to https urls', () => {
    expect(normalizeExternalImageUrl('example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
  });

  it('builds thumbnail and fallback urls for Google Drive images', () => {
    expect(resolveImageSource('https://drive.google.com/open?id=abc_DEF-123456789012345678901234')).toEqual({
      src: 'https://drive.google.com/thumbnail?id=abc_DEF-123456789012345678901234&sz=w1200',
      fallbackSrc: 'https://drive.google.com/uc?export=view&id=abc_DEF-123456789012345678901234',
      href: 'https://drive.google.com/uc?export=view&id=abc_DEF-123456789012345678901234',
    });
  });
});
